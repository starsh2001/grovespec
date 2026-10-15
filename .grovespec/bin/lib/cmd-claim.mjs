// claim — which worktree of this repository is working which node, or the whole tree
// (v0.19.0). The state and its lock live in lib/shared.mjs; this file is the command plus
// its readers (next's skip list, the release when a node reaches done, the tree gate).
//
// The node steps (grow · verify · implement · review · fix · revise) run
// `grovespec claim TASK-N <step>` first, and the SAME worktree re-takes its own claim at
// every later step — so a claim spans the node's steps, not one of them. Between two
// steps a loop can sit at a decision for hours; a claim that lapsed there would hand
// the node to another worktree, which reads it at its own branch's stale status and
// starts it over. A live claim ends when its worktree is gone from `git worktree list`
// (removed — or deleted, i.e. prunable) or a person releases it. Never by age — the
// run.lock rule: an age cannot tell an abandoned worktree from a person still deciding.
//
// Done does not end the protection, it changes it. The node is done on THIS branch only;
// every other worktree still reads it at its old status, and lifting the claim at done
// handed it straight to the next loop that asked. So at done the claim becomes a DONE
// MARK — "done on branch X at commit C" — and a worktree skips the node until C is in its
// own HEAD. The mark stops applying to a worktree once (a) C is an ancestor of its HEAD
// (the merge arrived), and ends for everyone when (b) C is reachable from no ref and no
// worktree (the branch was deleted: that work is abandoned and the node open again) or
// (c) a person releases it. Not by age, and not when its worktree goes — merged work
// usually outlives the worktree that made it.
//
// The tree-wide steps (the tree gate · plan · recheck · retro) take the one claim `tree`
// (`grovespec claim tree <step>`): two of them at once edit the same ledger files from
// two branches. It follows the live-claim rules; plan · recheck · retro release it as
// their last act, and `approve tree --human` releases it when the tree gate is decided.
//
// The step mark (v0.24.0) is a different fact: which step is running in THIS checkout
// right now. A claim spans a node's steps, so it cannot tell a step mid-way from the gap
// between two — and that gap is where interjected work (a request outside any GroveSpec
// step, while the milestone is open) may land without polluting a step's working tree or
// its seal. A step's claim writes the mark; its close ends it (`claim end` after the
// step's commit, or the approve / amend / release that closes it); the next step's claim
// overwrites one a stopped session left. One file per worktree and project, beside the
// shared state but outside it, so no other worktree's runtime reads a new field.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { writeAtomic } from './project.mjs'
import {
  sharedContext, readState, writeState, withSharedLock, liveWorktrees, currentBranch, samePath,
  headCommit, commitState, isAncestor, refContains, STATE_REMEDY
} from './shared.mjs'

const say = s => process.stdout.write(s + '\n')
const ID = /^TASK-[0-9]+$/
const STEP = /^[a-z][a-z-]*$/
const ISO = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$/
function now () {
  const v = process.env.GROVESPEC_NOW ?? ''
  if (v === '') return new Date().toISOString()
  return ISO.test(v) ? v : null
}
const order = t => t === 'tree' ? -1 : Number(t.slice('TASK-'.length))
const short = c => c.slice(0, 7)
const branchOf = c => c.branch === '' ? 'detached HEAD' : `branch ${c.branch}`
const stepOf = c => c.step === '' ? '' : ` · step ${c.step}`
export const holderText = c => `worktree ${c.worktree} · ${branchOf(c)} · since ${c.since}${stepOf(c)}`
export const doneText = c => `done on ${branchOf(c)} at ${short(c.done.commit)} · worktree ${c.worktree}`
export const releaseHint = t => `if that worktree has stopped working it: grovespec claim release ${t}`
export const abandonHint = t => `if that work was abandoned: grovespec claim release ${t}`
export const MERGE_FIRST = 'take that merge in before working it here'
const GIT_SAY = 'git did not answer — whether another worktree holds a node is unread; an unread check is not a passed one'
const GIT_LIST = 'git worktree list failed — whether a claim\'s worktree still exists is unread; an unread check is not a passed one'
const GIT_MARK = 'git could not place a done mark\'s commit (rev-parse · merge-base · for-each-ref) — whether that node was finished elsewhere is unread; an unread check is not a passed one'
const isLiveIn = live => w => live.some(x => samePath(x.path, w))
const keyOf = c => `${c.project}\0${c.node}\0${c.done?.commit ?? ''}`

// Does another worktree's done mark still hold for the worktree at `root`? 'holds' ·
// 'merged' (a — C is in this HEAD) · 'abandoned' (b — C is reachable from no ref and no
// live worktree, or gone) · 'broken'.
function markVerdict (root, m, live) {
  const c = m.done.commit
  const cs = commitState(root, c)
  if (cs !== 'present') return cs === 'missing' ? 'abandoned' : 'broken'
  const here = isAncestor(root, c, 'HEAD')
  if (here !== 'no') return here === 'yes' ? 'merged' : 'broken'
  const ref = refContains(root, c)
  if (ref !== 'no') return ref === 'yes' ? 'holds' : 'broken'
  for (const w of live) {
    if (w.head === '') continue
    const a = isAncestor(root, c, w.head)
    if (a !== 'no') return a === 'yes' ? 'holds' : 'broken'
  }
  return 'abandoned'
}

// Marks nobody needs any more, by key → why: 'abandoned' (b), or 'merged' into every live
// worktree — none is left to protect (a worktree added later from an older commit is not
// covered; stated in README). Judged OUTSIDE the lock — a few git calls per mark must not
// stretch the critical section other worktrees wait on — and dropped inside it by
// identity, so a mark rewritten meanwhile survives. An unreadable answer keeps the mark.
function garbageMarks (root, claims) {
  const marks = claims.filter(c => c.done !== undefined)
  const out = new Map()
  if (!marks.length) return out
  const live = liveWorktrees(root)
  if (live === null) return out
  for (const m of marks) {
    const cs = commitState(root, m.done.commit)
    if (cs === 'missing') { out.set(keyOf(m), 'abandoned'); continue }
    if (cs !== 'present') continue
    const reached = refContains(root, m.done.commit)
    if (reached === 'broken') continue
    const inHeads = live.map(w => w.head === '' ? 'no' : isAncestor(root, m.done.commit, w.head))
    if (inHeads.includes('broken')) continue
    if (reached === 'no' && !inHeads.includes('yes')) out.set(keyOf(m), 'abandoned')
    else if (live.length && inHeads.every(a => a === 'yes')) out.set(keyOf(m), 'merged')
  }
  return out
}

// next's view: what another worktree holds. The state is read BEFORE the worktree list —
// a claim in the file was written by a worktree that existed by then, so it is on the list
// unless it has gone since. Marks are judged only for nodes still open in this ledger.
export function claimState (P) {
  const none = { broken: null, held: () => null, tree: () => null }
  const ctx = sharedContext(P.root)
  if (ctx.state === 'none') return none
  if (ctx.state === 'broken') return { broken: GIT_SAY }
  const st = readState(ctx)
  if (st.broken) return { broken: `${st.broken} — ${STATE_REMEDY}` }
  const others = st.data.claims.filter(c => c.project === ctx.project && !samePath(c.worktree, ctx.worktree))
  if (!others.length) return none
  const live = liveWorktrees(P.root)
  if (live === null) return { broken: GIT_LIST }
  const isLive = isLiveIn(live)
  const open = new Set(P.treeIds().filter(t => P.statusOf(t) !== 'done'))
  const held = new Map()
  for (const c of others) {
    if (c.done === undefined) { if (isLive(c.worktree)) held.set(c.node, { kind: 'claim', c }); continue }
    if (!open.has(c.node)) continue
    const v = markVerdict(P.root, c, live)
    if (v === 'broken') return { broken: GIT_MARK }
    if (v === 'holds') held.set(c.node, { kind: 'done', c })
  }
  return { broken: null, held: t => held.get(t) ?? null, tree: () => held.get('tree')?.c ?? null }
}

const USAGE = 'usage: grovespec claim [list]                 — who holds which node (and the tree) of this project\n' +
  '       grovespec claim <TASK-N|tree> [step]   — this worktree takes (or keeps) it; every node step, and every tree-wide step, runs it first\n' +
  '       grovespec claim end                    — the step running in this checkout has ended (its commit is made)\n' +
  '       grovespec claim release <TASK-N|tree>  — end a claim or a done mark: this worktree\'s own, or one a stopped worktree left\n'

const fold = s => (process.platform === 'win32' || process.platform === 'darwin') ? s.toLowerCase() : s
const markPath = ctx => `${ctx.dir}/step-${createHash('sha256').update(`${fold(ctx.worktree)}\0${ctx.project}`).digest('hex').slice(0, 16)}.json`

// The step running in this checkout: { node, step, since }, or null (none, or no repo).
export function stepMark (root) {
  const ctx = sharedContext(root)
  if (ctx.state !== 'repo') return null
  try {
    const m = JSON.parse(readFileSync(markPath(ctx), 'utf8'))
    return typeof m?.node === 'string' && typeof m?.step === 'string' && typeof m?.since === 'string' ? m : null
  } catch { return null }
}
// Ends the mark (only the given node's, when one is named); returns what it ended.
export function endStepMark (root, node = null) {
  const m = stepMark(root)
  if (m === null || (node !== null && m.node !== node)) return null
  try { unlinkSync(markPath(sharedContext(root))) } catch { return null }
  return m
}

export function cmdClaim (P, args) {
  const [a = '', b = ''] = args
  if ((a === '' || a === 'list') && b === '') return listClaims(P)
  if (a === 'end' && b === '') {
    const m = endStepMark(P.root)
    say(m === null ? 'no step is running in this checkout — nothing to end' : `step ended: ${m.node} ${m.step} (since ${m.since}) — interjected work may land now`)
    return 0
  }
  if (a === 'release' && (ID.test(b) || b === 'tree')) return releaseClaim(P, b)
  if ((ID.test(a) || a === 'tree') && (b === '' || STEP.test(b))) return takeClaim(P, a, b)
  say(USAGE.trimEnd())
  return 2
}

function takeClaim (P, t, step) {
  if (t !== 'tree' && !P.treeIds().includes(t)) { say(`${t} is not in this checkout's tree — nothing to claim`); return 2 }
  const ctx = sharedContext(P.root)
  if (ctx.state === 'none') { say(`${t}: not a git repository — no other worktree can exist, so there is nothing to coordinate`); return 0 }
  if (ctx.state === 'broken') { say(`cannot claim ${t} — git did not answer; whether another worktree holds it is unread`); return 2 }
  const since = now()
  if (since === null) { say(`GROVESPEC_NOW is not an ISO-8601 UTC timestamp: '${process.env.GROVESPEC_NOW}' — refused`); return 2 }
  const branch = currentBranch(P.root)
  const snap = readState(ctx)
  if (snap.broken) { say(`cannot claim ${t} — ${snap.broken} — ${STATE_REMEDY}`); return 2 }
  const gc = garbageMarks(P.root, snap.data.claims)
  const r = withSharedLock(ctx, () => {
    const st = readState(ctx)
    if (st.broken) return { broken: `${st.broken} — ${STATE_REMEDY}` }
    // Listed INSIDE the lock: a claim another worktree writes is written under this same
    // lock, so its worktree is on this list — a list taken earlier could miss a worktree
    // created a moment ago and prune its fresh claim as lapsed.
    const live = liveWorktrees(P.root)
    if (live === null) return { broken: GIT_LIST }
    const isLive = isLiveIn(live)
    const was = st.data.claims.find(c => c.project === ctx.project && c.node === t) ?? null
    const lapsed = was !== null && was.done === undefined && !isLive(was.worktree) ? was : null
    let replaced = was !== null && was.done !== undefined && gc.has(keyOf(was)) && !samePath(was.worktree, ctx.worktree)
      ? { mark: was, why: gc.get(keyOf(was)) } : null
    st.data.claims = st.data.claims.filter(c => c.done === undefined ? isLive(c.worktree) : !gc.has(keyOf(c)))
    const i = st.data.claims.findIndex(c => c.project === ctx.project && c.node === t)
    const cur = i === -1 ? null : st.data.claims[i]
    if (cur !== null && !samePath(cur.worktree, ctx.worktree)) {
      if (cur.done === undefined) return { heldBy: cur }
      const v = markVerdict(P.root, cur, live)
      if (v === 'broken') return { broken: GIT_MARK }
      if (v === 'holds') return { doneBy: cur }
      replaced = { mark: cur, why: v }
      st.data.claims.splice(i, 1)
    } else if (cur !== null) {
      const reopened = cur.done !== undefined
      if (reopened) { delete cur.done; cur.since = since }
      cur.branch = branch
      if (step !== '') cur.step = step
      writeState(ctx, st.data)
      return { kept: cur, reopened }
    }
    const c = { project: ctx.project, node: t, worktree: ctx.worktree, branch, step, since }
    st.data.claims.push(c)
    writeState(ctx, st.data)
    return { taken: c, lapsed, replaced }
  })
  if (r.refused) { say(r.refused); return 2 }
  const v = r.value
  if (v.broken) { say(`cannot claim ${t} — ${v.broken}`); return 2 }
  if ((v.kept || v.taken) && step !== '') {
    mkdirSync(ctx.dir, { recursive: true })
    writeAtomic(markPath(ctx), JSON.stringify({ node: t, step, since }) + '\n')
  }
  if (v.heldBy) {
    say(`${t} is held by another worktree: ${holderText(v.heldBy)}`)
    say(`a session there is working ${t === 'tree' ? 'a tree-wide step' : 'this node'} — leave it to that worktree${t === 'tree' ? '' : ' (grovespec next here picks other work)'}. Releasing it is the person's call, once that worktree has stopped working it: grovespec claim release ${t}`)
    return 1
  }
  if (v.doneBy) {
    say(`${t} is ${doneText(v.doneBy)} — not merged here: ${MERGE_FIRST}`)
    say(`starting it here would build it a second time on a branch that has not seen the first. If that work was abandoned, the person releases the mark: grovespec claim release ${t}`)
    return 1
  }
  if (v.kept) {
    say(v.reopened
      ? `claimed: ${t} — its done mark here is lifted; the node is open again in this worktree${stepOf(v.kept)}`
      : `claimed: ${t} — already held by this worktree since ${v.kept.since}${stepOf(v.kept)}`)
    return 0
  }
  say(`claimed: ${t} for this worktree (${v.taken.worktree} · ${branchOf(v.taken)}) — ${t === 'tree'
    ? 'another worktree\'s tree-wide step is refused until this one ends here, it is released, or this worktree is removed'
    : 'another worktree\'s grovespec next skips it until it is done here, released, or this worktree is removed'}`)
  if (v.lapsed) say(`(the earlier claim by ${v.lapsed.worktree} had lapsed — that worktree no longer exists)`)
  if (v.replaced) {
    say(v.replaced.why === 'merged'
      ? `(the done mark from ${v.replaced.mark.worktree} no longer applies here — ${short(v.replaced.mark.done.commit)} is merged into this branch)`
      : `(the done mark from ${v.replaced.mark.worktree} is void — ${short(v.replaced.mark.done.commit)} is reachable from no branch any more, so that work counts as abandoned and the node as open)`)
  }
  return 0
}

function releaseClaim (P, t) {
  const ctx = sharedContext(P.root)
  if (ctx.state === 'none') { say(`${t}: not a git repository — there are no claims here`); return 0 }
  if (ctx.state === 'broken') { say(`cannot release ${t} — git did not answer`); return 2 }
  const snap = readState(ctx)
  if (snap.broken) { say(`cannot release ${t} — ${snap.broken} — ${STATE_REMEDY}`); return 2 }
  const gc = garbageMarks(P.root, snap.data.claims)
  const r = withSharedLock(ctx, () => {
    const st = readState(ctx)
    if (st.broken) return { broken: `${st.broken} — ${STATE_REMEDY}` }
    const live = liveWorktrees(P.root)
    if (live === null) return { broken: GIT_LIST }
    const isLive = isLiveIn(live)
    const i = st.data.claims.findIndex(c => c.project === ctx.project && c.node === t)
    if (i === -1) return { none: true }
    const [c] = st.data.claims.splice(i, 1)
    st.data.claims = st.data.claims.filter(x => x.done === undefined ? isLive(x.worktree) : !gc.has(keyOf(x)))
    writeState(ctx, st.data)
    return { c, mine: samePath(c.worktree, ctx.worktree), live: isLive(c.worktree) }
  })
  if (r.refused) { say(r.refused); return 2 }
  const v = r.value
  if (v.broken) { say(`cannot release ${t} — ${v.broken}`); return 2 }
  endStepMark(P.root, t)
  if (v.none) { say(`${t}: no claim is held — nothing to release`); return 0 }
  if (v.c.done !== undefined) {
    say(`released: ${t}'s done mark (${doneText(v.c)}) — a worktree that has not merged that commit may start the node again`)
  } else if (v.mine) say(`released: ${t} (held by this worktree since ${v.c.since})`)
  else if (!v.live) say(`released: ${t} — its holder ${v.c.worktree} no longer exists; the claim had already lapsed`)
  else {
    say(`released: ${t} — it was held by a worktree that still exists: ${holderText(v.c)}`)
    say(`if a session is still working there, ${t === 'tree' ? 'the tree' : 'that node'} is no longer protected from another worktree`)
  }
  return 0
}

function listClaims (P) {
  const ctx = sharedContext(P.root)
  if (ctx.state === 'none') { say('not a git repository — claims coordinate the worktrees of one repository; there is nothing to list'); return 0 }
  if (ctx.state === 'broken') { say('cannot list claims — git did not answer'); return 2 }
  const st = readState(ctx)
  if (st.broken) { say(`${st.broken} — ${STATE_REMEDY}`); return 2 }
  const mine = st.data.claims.filter(c => c.project === ctx.project).sort((a, b) => order(a.node) - order(b.node))
  if (!mine.length) { say('no claims — no worktree of this repository holds a node or the tree of this project'); return 0 }
  const live = liveWorktrees(P.root)
  if (live === null) { say(GIT_LIST); return 2 }
  const isLive = isLiveIn(live)
  const lines = []
  for (const c of mine) {
    const own = samePath(c.worktree, ctx.worktree)
    if (c.done !== undefined) {
      if (own) { lines.push(`  ${c.node}  done in this worktree at ${short(c.done.commit)} · ${branchOf(c)} — a worktree without this commit skips the node until it takes it in`); continue }
      const v = markVerdict(P.root, c, live)
      if (v === 'broken') { say(GIT_MARK); return 2 }
      if (v === 'holds') lines.push(`  ${c.node}  ${doneText(c)} — not merged here: ${MERGE_FIRST}; ${abandonHint(c.node)}`)
      else if (v === 'merged') lines.push(`  ${c.node}  ${doneText(c)} — merged here; the mark stands for worktrees without that commit`)
      else lines.push(`  ${c.node}  ${doneText(c)} — that commit is reachable from no branch any more: the work counts as abandoned and the node as open; cleared at the next claim write`)
    } else if (own) lines.push(`  ${c.node}  this worktree · ${branchOf(c)} · since ${c.since}${stepOf(c)}`)
    else if (isLive(c.worktree)) lines.push(`  ${c.node}  ${holderText(c)} — ${releaseHint(c.node)}`)
    else lines.push(`  ${c.node}  lapsed — worktree ${c.worktree} is gone (removed, or its folder deleted); it counts as released and is cleared at the next claim write`)
  }
  say(`claims, shared by every worktree of this repository (${ctx.statePath}):`)
  for (const l of lines) say(l)
  return 0
}

// A node that reached done HERE: this worktree's claim becomes a done mark at this HEAD —
// unless no other live worktree lacks that commit (a single checkout, say), where there is
// nobody to protect and the claim simply ends. Best effort by design: the gate decision
// already stands, so what cannot happen is SAID (lines for the caller to print), never
// turned into a failed approval. A node with no claim is not touched at all — nothing is
// created under the git dir for it.
export function releaseOnDone (P, tid) {
  const ctx = sharedContext(P.root)
  if (ctx.state === 'none') return []
  const keep = why => [`note: ${tid}'s claim stays a plain claim — ${why}; other worktrees keep skipping the node until it is released (grovespec claim release ${tid})`]
  if (ctx.state === 'broken') return keep('git did not answer')
  const peek = readState(ctx)
  if (peek.broken) return keep(peek.broken)
  if (!peek.data.claims.some(c => c.project === ctx.project && c.node === tid)) return []
  const head = headCommit(P.root)
  const live = liveWorktrees(P.root)
  if (head === null || live === null) return keep('git did not answer (HEAD · worktree list)')
  let needMark = false
  for (const w of live) {
    if (samePath(w.path, ctx.worktree)) continue
    const a = w.head === '' ? 'no' : isAncestor(P.root, head, w.head)
    if (a === 'broken') return keep('git merge-base did not answer')
    if (a === 'no') { needMark = true; break }
  }
  const at = now() ?? new Date().toISOString()
  const branch = currentBranch(P.root)
  const gc = garbageMarks(P.root, peek.data.claims)
  const r = withSharedLock(ctx, () => {
    const st = readState(ctx)
    if (st.broken) return { broken: st.broken }
    st.data.claims = st.data.claims.filter(c => c.done === undefined || !gc.has(keyOf(c)))
    const i = st.data.claims.findIndex(c => c.project === ctx.project && c.node === tid && samePath(c.worktree, ctx.worktree))
    const other = st.data.claims.find(c => c.project === ctx.project && c.node === tid && !samePath(c.worktree, ctx.worktree)) ?? null
    if (i !== -1) {
      if (needMark) Object.assign(st.data.claims[i], { branch, done: { commit: head, at } })
      else st.data.claims.splice(i, 1)
    }
    writeState(ctx, st.data)
    return { mine: i !== -1, other }
  })
  if (r.refused) return keep(r.refused)
  if (r.value.broken) return keep(r.value.broken)
  const out = []
  if (r.value.mine) {
    out.push(needMark
      ? `claim on ${tid} is now a done mark at ${short(head)}: a worktree that has not taken this commit in skips the node until it does`
      : `claim released: ${tid} is done in this worktree`)
  }
  const o = r.value.other
  if (o !== null && o.done === undefined && live.some(w => samePath(w.path, o.worktree))) {
    out.push(`note: ${tid} is done here while another worktree holds its claim (${holderText(o)}) — two branches are finishing the same node; reconcile them at merge`)
  }
  return out
}

// The tree gate decided (approve tree --human): this worktree's tree claim ends.
export function releaseTree (P) {
  const ctx = sharedContext(P.root)
  if (ctx.state !== 'repo') return []
  const peek = readState(ctx)
  if (peek.broken || !peek.data.claims.some(c => c.project === ctx.project && c.node === 'tree' && samePath(c.worktree, ctx.worktree))) return []
  const r = withSharedLock(ctx, () => {
    const st = readState(ctx)
    if (st.broken) return { broken: st.broken }
    const i = st.data.claims.findIndex(c => c.project === ctx.project && c.node === 'tree' && samePath(c.worktree, ctx.worktree))
    if (i === -1) return { none: true }
    st.data.claims.splice(i, 1)
    writeState(ctx, st.data)
    return { done: true }
  })
  if (r.refused) return [`note: the tree claim was not released — ${r.refused}; release it with grovespec claim release tree`]
  if (r.value.broken) return [`note: the tree claim was not released — ${r.value.broken}; release it with grovespec claim release tree`]
  return r.value.done ? ['tree claim released — the tree gate is decided'] : []
}
