// shared — the state every worktree of ONE repository shares (v0.19.0).
//
// A project's ledger is branch-local on purpose: tree, Tasks and gate records are
// committed with the code and merge with it. Worktrees of one repository therefore read
// different ledgers at the same moment, and two facts fall between them:
//   · ids — `grovespec id` derives the next number from what it can see, and a number
//     another worktree handed out but has not committed yet is invisible to that scan:
//     two worktrees got the same TASK-N and met again as a merge conflict;
//   · who is working a node — `next` reads only its own branch, so two worktrees started
//     the same node at once.
// Both live here, in ONE runtime-owned file under the git COMMON dir — the directory
// every worktree of the repository shares (`git rev-parse --git-common-dir`; for a plain
// single checkout that is simply its .git). Nothing here is ever committed, and nothing
// else moves: run.lock stays per checkout (one writer per checkout — moving it here
// would serialize every worktree and end the parallelism this exists for).
//
//   <common>/grovespec/state.json   { version, ids: { <project>: N }, claims: [ … ] }
//   <common>/grovespec/lock/        the short mutex around every write of that file
//
// <project> is the project's path below the repository toplevel ('.' at the toplevel),
// so two GroveSpec projects in one repository never share a number line or a claim.
//
// The lock has run.lock's shape (mkdir + owner nonce, lib/lock.mjs) and run.lock's rule
// on corpses — NO automatic reclaim, ever: a lock still held after the wait is named by
// path for a person to delete. What differs is the wait: writers in two worktrees are
// the supported case here and the critical section is a read and a rename, so a second
// writer waits a few seconds instead of being refused on contact.
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { git } from './git.mjs'
import { acquireAt, release } from './lock.mjs'
import { writeAtomic } from './project.mjs'

export const STATE_VERSION = 1
const WAIT_MS = 5000
const fwd = p => p.replace(/\\/g, '/')
const sleep = ms => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) }

// Two spellings of one directory compare equal: git prints forward slashes, and the
// Windows and macOS default volumes ignore case.
const FOLD = process.platform === 'win32' || process.platform === 'darwin'
const canon = p => { const s = fwd(p).replace(/\/+$/, ''); return FOLD ? s.toLowerCase() : s }
export const samePath = (a, b) => canon(a) === canon(b)

// Three answers, like repoState: 'none' (git says this is no repository — no other
// worktree can exist, nothing to coordinate) · 'broken' (git did not answer; whether
// another worktree holds anything is unread, and an unread check is not a passed one)
// · 'repo' with the coordinates. One git call.
export function sharedContext (root) {
  const r = git(root, ['rev-parse', '--git-common-dir', '--show-toplevel', '--show-prefix'])
  if (!r.ok) {
    // the same marker rule as repoState: a .git that git denies is damage, not absence
    if (r.code === 128 && /not a git repository/i.test(r.err)) return existsSync(`${root}/.git`) ? { state: 'broken' } : { state: 'none' }
    return { state: 'broken' }
  }
  const [common = '', toplevel = '', prefix = ''] = r.out.replace(/\r?\n$/, '').split(/\r?\n/)
  if (common === '' || toplevel === '') return { state: 'broken' }
  const dir = `${fwd(resolve(root, common))}/grovespec`
  return {
    state: 'repo',
    dir,
    statePath: `${dir}/state.json`,
    lockPath: `${dir}/lock`,
    worktree: fwd(toplevel).replace(/\/+$/, ''),
    project: prefix === '' ? '.' : prefix.replace(/\/+$/, '')
  }
}

const ISO = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$/
const TARGET = /^(TASK-[0-9]+|tree)$/            // a node, or the whole tree (tree-wide steps)
const OID = /^([0-9a-f]{40}|[0-9a-f]{64})$/
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v)

// What a reader is told when the file cannot be trusted — the remedy and its cost in one.
export const STATE_REMEDY = 'it is runtime-owned state shared by every worktree of this repository: repair it, or delete it once no grovespec runs in any worktree — deleting drops every claim, and the id floor falls back to what each scan sees (safe only when every issued id is committed)'

// Never throws on content: a broken file comes back as text, because every reader must
// be able to SAY it instead of acting as if no claim and no issued number existed.
export function readState (ctx) {
  let text
  try { text = readFileSync(ctx.statePath, 'utf8') } catch (e) {
    if (e.code === 'ENOENT') return { data: { version: STATE_VERSION, ids: {}, claims: [] }, present: false }
    return { broken: `${ctx.statePath} cannot be read (${e.code ?? e.message})` }
  }
  let data
  try { data = JSON.parse(text) } catch { return { broken: `${ctx.statePath} is not valid JSON` } }
  if (!isObj(data)) return { broken: `${ctx.statePath} is not a JSON object` }
  if (data.version !== STATE_VERSION) {
    return { broken: `${ctx.statePath} has state version ${JSON.stringify(data.version)} — this runtime reads version ${STATE_VERSION}; a newer GroveSpec in another worktree wrote it (upgrade this worktree's runtime)` }
  }
  if (!isObj(data.ids)) return { broken: `${ctx.statePath} 'ids' is not an object` }
  for (const [k, v] of Object.entries(data.ids)) {
    if (!Number.isSafeInteger(v) || v < 0) return { broken: `${ctx.statePath} ids['${k}'] is not a whole number` }
  }
  if (!Array.isArray(data.claims)) return { broken: `${ctx.statePath} 'claims' is not a list` }
  const seen = new Set()
  for (const [i, c] of data.claims.entries()) {
    const ok = isObj(c) && typeof c.project === 'string' && typeof c.node === 'string' && TARGET.test(c.node) &&
      typeof c.worktree === 'string' && c.worktree !== '' && typeof c.branch === 'string' &&
      typeof c.step === 'string' && typeof c.since === 'string' && ISO.test(c.since) &&
      (c.done === undefined || (c.node !== 'tree' && isObj(c.done) && typeof c.done.commit === 'string' &&
        OID.test(c.done.commit) && typeof c.done.at === 'string' && ISO.test(c.done.at)))
    if (!ok) return { broken: `${ctx.statePath} claims[${i + 1}] is not a claim (project · node TASK-N|tree · worktree · branch · step · since · optional done { commit, at })` }
    const key = `${c.project}\0${c.node}`
    if (seen.has(key)) return { broken: `${ctx.statePath} claims[${i + 1}] repeats ${c.node} — one entry per node, or who holds it is ambiguous` }
    seen.add(key)
  }
  return { data, present: true }
}

// Unknown top-level keys ride along untouched — a newer runtime's additions must survive
// an older runtime's write.
export function writeState (ctx, data) {
  writeAtomic(ctx.statePath, JSON.stringify(data, null, 2) + '\n')
}

// Run fn() holding the shared lock. { value } on success, { refused } when the lock could
// not be taken within the wait (named by path, never reclaimed) or a test hook is malformed.
// GROVESPEC_HOLD_MS holds the lock that long before fn runs — a test hook (same family as
// GROVESPEC_NOW): it is what lets the regression suite prove two worktrees really overlap.
export function withSharedLock (ctx, fn) {
  const hold = process.env.GROVESPEC_HOLD_MS ?? ''
  if (hold !== '' && !/^[0-9]+$/.test(hold)) return { refused: `GROVESPEC_HOLD_MS is not a whole number of milliseconds: '${hold}' — refused, never half-obeyed` }
  mkdirSync(ctx.dir, { recursive: true })
  const deadline = Date.now() + WAIT_MS
  let held = null
  for (;;) {
    try { held = acquireAt(ctx.lockPath) } catch (e) {
      // Windows refuses a mkdir while the previous holder's lock directory is still
      // being deleted — busy, not broken. Anything else is a different, loud story.
      if (e.code !== 'EPERM' && e.code !== 'EACCES') throw e
    }
    if (held !== null) break
    if (Date.now() >= deadline) {
      return { refused: `the repository's shared GroveSpec state is locked: ${ctx.lockPath} — held for over ${WAIT_MS / 1000}s, longer than any issuance or claim takes. If no grovespec is running in any worktree of this repository, a crashed run left it; delete that directory yourself and re-run.` }
    }
    sleep(20 + Math.floor(Math.random() * 30))
  }
  try {
    if (hold !== '') sleep(Number(hold))
    return { value: fn() }
  } finally { release(held) }
}

// The worktrees that still exist, from git's own list, as { path, head } ('' head = no
// commit yet). A worktree whose directory was deleted without `git worktree remove` stays
// listed as `prunable` until a prune — its files are gone, so nothing can be working
// there: it counts as gone. A `locked` one (removable media) is never prunable, so it
// keeps its claims. null = git did not answer.
export function liveWorktrees (root) {
  const r = git(root, ['worktree', 'list', '--porcelain'])
  if (!r.ok) return null
  const live = []
  for (const block of r.out.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n').filter(l => l !== '')
    const path = lines.find(l => l.startsWith('worktree '))
    if (!path) continue
    if (lines.some(l => l === 'prunable' || l.startsWith('prunable '))) continue
    if (lines.includes('bare')) continue                    // a bare repository: nobody works there
    const head =(lines.find(l => l.startsWith('HEAD ')) ?? '').slice('HEAD '.length)
    live.push({ path: path.slice('worktree '.length), head: /^[0-9a-f]+$/.test(head) && !/^0+$/.test(head) ? head : '' })
  }
  return live
}

// The branch this worktree has checked out; '' when HEAD is detached.
export function currentBranch (root) {
  const r = git(root, ['symbolic-ref', '--short', '-q', 'HEAD'])
  return r.ok ? r.out.trim() : ''
}

// This worktree's HEAD commit, or null when there is none (or git did not answer).
export function headCommit (root) {
  const r = git(root, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'])
  return r.ok ? r.out.trim() : null
}

// Three answers each, like every git reader here: an answer git could not give is
// 'broken', never folded into the convenient one.
export function commitState (root, c) {            // 'present' | 'missing' | 'broken'
  const r = git(root, ['rev-parse', '--verify', '--quiet', `${c}^{commit}`])
  if (r.ok) return 'present'
  return r.code === 1 ? 'missing' : 'broken'
}
export function isAncestor (root, c, tip) {        // 'yes' | 'no' | 'broken'
  const r = git(root, ['merge-base', '--is-ancestor', c, tip])
  if (r.ok) return 'yes'
  return r.code === 1 ? 'no' : 'broken'
}
export function refContains (root, c) {            // any ref (branch · tag · remote) reaches c?
  const r = git(root, ['for-each-ref', '--contains', c, '--count=1', '--format=%(refname)'])
  if (!r.ok) return 'broken'
  return r.out.trim() === '' ? 'no' : 'yes'
}
