// reopen — revise's state transition, atomic and mechanical: a node that already passed a
// gate goes back to draft (spec/contract changed → re-verify) or approved (spec valid,
// code changes → re-implement), and its gate records start a FRESH cycle — a past cycle's `passed` is
// history, never current evidence (that masquerade is how a reopened node used to look
// "already verified"). What survives the reset:
//   · reviewed_commit — the closed cycle's boundary, which `diff` uses as the next
//     cycle's base;
//   · adjudications — a settled call is a boundary ("don't re-raise"), not evidence;
//     a new cycle doesn't expire it. Wiping these forced a copy into the Task's Change
//     Log, and the cold reviewers' criteria come from that same file — the copy handed
//     every prior verdict to the reader whose blankness it existed to protect. On a
//     draft reopen the contract changed: the next cycle's caller prunes entries whose
//     written reason leaned on the old contract (reviewers.md) — kept here, judged there.
//   · the record's own config header (target · level · find_streak · plan_streak · max_rounds).
// Everything else — rounds, open_issues, followups, narrative — lives on in git history.
// A draft reopen drops spec_digest + task_evidence_digest +
// source_evidence_digest/source_evidence_round as one old seal: neither the old Task
// binding nor the old source packet enters the fresh cycle;
// prose (why it reopened) is the revise skill's job — this command owns only the state.
import { topValue, setFmValue, cfgValue } from './core.mjs'
import { writeAtomic } from './project.mjs'

const say = s => process.stdout.write(s + '\n')

// The whole block under a top-level key, verbatim — from its key line down to the next
// top-level key (comments and list items included). null when the record has no such key.
function blockOf (text, key) {
  const lines = text.split('\n')
  const start = lines.findIndex(l => l.startsWith(key + ':'))
  if (start === -1) return null
  let end = start + 1
  while (end < lines.length && !/^[A-Za-z_]+:/.test(lines[end])) end++
  while (end > start + 1 && lines[end - 1].trim() === '') end--
  return lines.slice(start, end).join('\n')
}

// A fresh cycle runs under the CURRENT rules: the 0.13 counters replace whatever a
// legacy record carried (strength/repeat are not copied forward — nothing reads them,
// and a fresh cycle wearing dead knobs would look configured by them). An explicit
// per-node counter in the old record carries over; a gap is filled from the PROJECT
// CONFIG for this gate (verify: for spec/tree · review: for result), template default
// last — a runtime-invented 2 must never masquerade as the user's setting. Returns
// { text, counters } so the caller can NAME what it wrote.
function freshCycle (P, text, keep = {}) {
  const targetType = topValue(text, 'target_type')
  const block = targetType === 'result' ? 'review' : 'verify'
  const cfgInt = key => {
    const v = cfgValue(P.configText, block, key)
    return /^[0-9]+$/.test(v) ? v : null
  }
  const head = ['target', 'target_type', 'level', 'find_streak', 'plan_streak', 'max_rounds']
    .map(k => [k, topValue(text, k)])
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}: ${v}`)
  const ensure = (k, dflt) => {
    if (!head.some(l => l.startsWith(`${k}:`))) head.push(`${k}: ${cfgInt(k) ?? dflt}`)
  }
  ensure('find_streak', 2)
  if (block === 'review') ensure('plan_streak', 2)   // spec/tree fixes take no M by design
  ensure('max_rounds', 30)
  const counters = ['find_streak', 'plan_streak']
    .map(k => head.find(l => l.startsWith(`${k}:`)))
    .filter(l => l !== undefined)
    .map(l => l.replace(':', ''))
    .join(' · ')
  const kept = Object.entries(keep)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}: ${v}`)
  const adjudications = blockOf(text, 'adjudications') ?? 'adjudications: []'
  // Some cycles keep the condensed shape list under its own `do_not_raise:` key —
  // same substance (a boundary, not evidence), so it survives the same way.
  const doNotRaise = blockOf(text, 'do_not_raise')
  const out = head.concat([
    '', 'round: 0', 'no_new_streak: 0', 'status: in-progress', 'approved_by: pending',
    ...kept.length ? kept : [],
    '', 'rounds: []', '', 'open_issues: []', '', 'followups: []', '', adjudications,
    ...doNotRaise ? ['', doNotRaise] : [],
    ''
  ]).join('\n')
  return { text: out, counters }
}

// `hint: false` — the caller says why on its own line (recheck open names the reached use).
export function cmdReopen (P, n, target, { hint = true } = {}) {
  if (n === 'tree') {
    if (target !== 'decomposition' && target !== 'fidelity') {
      say('usage: grovespec reopen tree decomposition|fidelity')
      return 2
    }
    const path = P.treeYamlPath()
    const text = P.read(path)
    if (text === null) {
      say(`tree: no prior tree gate record (${path} missing) — create the initial ${target} record in grovespec-verify`)
      return 2
    }
    const status = topValue(text, 'status')
    const approvedBy = topValue(text, 'approved_by')
    const mode = topValue(text, 'tree_evidence_mode')
    const unsealed = topValue(text, 'tree_digest') === '' && topValue(text, 'source_scope_digest') === '' &&
      topValue(text, 'tree_evidence_digest') === ''
    if (status === 'in-progress' && approvedBy === 'pending' && mode === target && unsealed) {
      say(`already reopened: tree ${target} cycle is in progress — no evidence was reset`)
      return 0
    }
    // Before approved_by existed, `status: passed` was the open-tree state. Project
    // routing still honors that compatibility rule, so the migration command must be
    // able to start its first explicit cycle too; otherwise validate can name a stale
    // legacy tree seal while no legal command can clear it.
    if (status !== 'passed' || (approvedBy !== 'human' && approvedBy !== '')) {
      say(`tree: reopen starts after a human-approved tree gate (or its pre-approved_by legacy equivalent) — current record is status '${status || 'unset'}', approved_by '${approvedBy || 'unset'}'; finish or repair that cycle first`)
      return 2
    }
    const fresh = freshCycle(P, text, { tree_evidence_mode: target })
    writeAtomic(path, fresh.text)
    P.forget()
    say(`reopened: tree → fresh ${target} cycle (adjudications kept; mode persisted before round 1; ${fresh.counters})`)
    return 0
  }
  if (n === '' || (target !== 'draft' && target !== 'approved')) {
    say('usage: grovespec reopen TASK-N draft|approved | reopen tree decomposition|fidelity   (draft = the spec changes; approved = only the code does)')
    return 2
  }
  const taskText = P.read(P.taskPath(n))
  if (taskText === null) { say(`no such node: ${n}`); return 2 }
  const st = P.statusOf(n)
  // reopen regresses a node past a gate it has ALREADY passed — that is what turns the old
  // verdict into stale evidence needing a fresh cycle. Two statuses qualify: `done` (the
  // result gate) and `approved` (the spec gate — sealed and human-decided, so editing that
  // spec is exactly what validate's digest check refuses to let pass unnoticed; refusing to
  // reopen it left that edit with no legal route at all). `sketch`/`draft` are
  // pre-commitment — edit them in place. `implemented`/`reviewed`/`fixed` sit mid-cycle:
  // their gate has not closed, so they continue it.
  if (st !== 'done' && st !== 'approved') {
    say(`${n}: reopen regresses a node past a gate it passed (done · approved) — it is '${st}': pre-commitment, so edit it in place, or mid-cycle, so let its gate finish`)
    return 2
  }
  // An approved node has only the spec gate behind it, so `approved` as a target would reset
  // nothing while reporting a change that did not happen.
  if (st === 'approved' && target !== 'draft') {
    say(`${n}: an approved node reopens to draft only — the spec gate is the one behind it (asked for '${target}')`)
    return 2
  }

  const flipped = setFmValue(taskText, 'status', target)
  if (flipped === null) { say(`${n}: cannot set status — frontmatter malformed (run grovespec validate)`); return 2 }

  const resets = []
  const vt = P.read(P.verifyYamlPath(n))
  if (target === 'draft' && vt !== null) {
    const fresh = freshCycle(P, vt)
    writeAtomic(P.verifyYamlPath(n), fresh.text)
    resets.push(`verify cycle reset (adjudications kept; ${fresh.counters})`)
  }
  const rt = P.read(P.reviewYamlPath(n))
  if (rt !== null) {
    const fresh = freshCycle(P, rt, { reviewed_commit: topValue(rt, 'reviewed_commit') })
    writeAtomic(P.reviewYamlPath(n), fresh.text)
    resets.push(`review cycle reset (reviewed_commit + adjudications kept; ${fresh.counters})`)
  }
  writeAtomic(P.taskPath(n), flipped)
  P.forget()

  say(`reopened: ${n} ${st} → ${target}${resets.length ? ` — ${resets.join(' · ')}` : ''}`)
  if (hint) say(`  a fresh cycle starts here; record why in the Change Log (grovespec-revise owns the prose)`)
  return 0
}
