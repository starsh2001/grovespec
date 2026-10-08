// wait — the sideways-dependency ledger (2026-09-24 decision).
//
// Mid-step (verify·implement) a node discovers it needs a contract value another node
// has not defined yet. The old move — a sideways `[→ child/deferred: …]` note — closed
// the gate over a live obligation nobody ever re-read, and "every node is done" went
// false (proof-run measurement: the same promise slipped two rounds running). The new
// move: DECLARE the dependency and stop. The declaration is timestamped, so scheduling
// has one rule — **the turn follows the newest declaration**:
//   · a node with a live outgoing wait is asleep,
//   · UNLESS a live wait pointing AT it is newer than every live wait it holds —
//     the counter-declaration is what wakes it (a mutual wait is a turn-pass, never
//     a deadlock: exactly one node of a chain is awake).
//   · a wait whose target went `done` no longer blocks (the value landed); the waiter
//     resumes and formally resolves it — an unresolved entry is surfaced until then.
// Ownership is never decided here: who DEFINES a value stays with the value's owner;
// the ledger only decides who moves now. A value missing from a *done* contract is a
// revise (reopen), not a wait — declaring against a done target is refused.
//
// Ledger: .grovespec/waits.yaml — top-level `waits:` block list, one live entry per
// pair. It holds the CURRENT state, not the history: a re-declaration refreshes the
// entry's clock and wording in place (that is the turn-pass), and resolve fills
// `resolved`/`answer` without deleting. Superseded clocks and the full story live in
// the two Change Logs and in git — the ledger rides every freezing step's commit.
// All values are one strict-YAML line, same contract as the gate records.
import { writeAtomic } from './project.mjs'
import { listItems, itemValue } from './core.mjs'

const say = s => process.stdout.write(s + '\n')
// Full unquote, not just fence-stripping: serialize writes single-quoted scalars with
// `'` doubled (strict YAML), so reading MUST undo that doubling — a read that keeps
// the doubling feeds the next serialize, and every rewrite of the ledger re-doubled
// the text (measured: `user's` → `user''s` → `user''''s`).
const unq = s => {
  const t = s.trim()
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'")
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\(["\\])/g, '$1')
  return t
}
const ID = /^TASK-[0-9]+$/

// Timestamps order the turn, so they must be comparable as strings: strict ISO-8601
// UTC (what toISOString prints). GROVESPEC_NOW pins the clock for tests — same pattern
// as GROVESPEC_GIT: an env override, refused when malformed rather than half-obeyed.
const ISO = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$/
function now () {
  const v = process.env.GROVESPEC_NOW ?? ''
  if (v === '') return new Date().toISOString()
  if (!ISO.test(v)) return null
  return v
}

export function waitsPath (P) { return `${P.root}/.grovespec/waits.yaml` }

// Parse the ledger. Never throws: shape problems come back as text, because every
// caller (next·status·validate) must be able to SAY the ledger is unreadable instead
// of scheduling as if it were empty (an unreadable ledger folded into "no waits" would
// wake a frozen node).
export function readWaits (P) {
  const path = waitsPath(P)
  const text = P.read(path)
  if (text === null) return { entries: [], problems: [], present: false }
  const problems = []
  const entries = []
  const items = listItems(text, 'waits')
  if (items.length === 0 && !/^waits[ \t]*:/m.test(text)) {
    problems.push(`${path}  no top-level 'waits:' list — the ledger exists but cannot be read`)
    return { entries, problems, present: true }
  }
  const ids = new Set(P.treeIds())
  items.forEach((item, i) => {
    const e = {
      from: unq(itemValue(item, 'from')),
      to: unq(itemValue(item, 'to')),
      declared: unq(itemValue(item, 'declared')),
      step: unq(itemValue(item, 'step')),
      need: unq(itemValue(item, 'need')),
      resolved: unq(itemValue(item, 'resolved')),
      answer: unq(itemValue(item, 'answer')),
      n: i + 1
    }
    const at = `${path}  entry ${e.n}`
    // Tree membership is required of LIVE entries only: a live wait on a node that
    // is gone would sleep forever, so that is a problem — but a RESOLVED entry is
    // history, and history may name a node that was later legitimately deleted
    // (sketches are free to delete). Holding history to the current tree blocked
    // exactly that deletion. Shape checks (id form, timestamps) still apply to all.
    const live = e.resolved === ''
    if (!ID.test(e.from)) problems.push(`${at}  'from' is not a TASK id`)
    else if (live && !ids.has(e.from)) problems.push(`${at}  'from' names ${e.from}, which is not in the tree — a live wait cannot belong to a node that is gone (resolve the entry, or restore the node)`)
    if (!ID.test(e.to)) problems.push(`${at}  'to' is not a TASK id`)
    else if (live && !ids.has(e.to)) problems.push(`${at}  'to' names ${e.to}, which is not in the tree — a live wait on a deleted node would sleep forever (resolve the entry, or restore the node)`)
    if (e.from !== '' && e.from === e.to) problems.push(`${at}  a node cannot wait on itself`)
    if (!ISO.test(e.declared)) problems.push(`${at}  'declared' is not an ISO-8601 UTC timestamp — the turn cannot be ordered`)
    if (e.need === '') problems.push(`${at}  'need' is empty — a wait must say what it is waiting for`)
    if (e.resolved !== '' && !ISO.test(e.resolved)) problems.push(`${at}  'resolved' is neither empty nor an ISO-8601 UTC timestamp`)
    entries.push(e)
  })
  return { entries, problems, present: true }
}

// The scheduling view. A wait is LIVE while unresolved; it BLOCKS only while its
// target is not done (a done target means the value landed — the waiter must resume,
// and resolving the entry is the resume procedure's own first step).
export function waitState (P) {
  const { entries, problems } = readWaits(P)
  const live = entries.filter(e => e.resolved === '')
  const blocking = live.filter(e => P.statusOf(e.to) !== 'done')
  return {
    problems,
    live,
    // null = this node is not held by the ledger; else the wait it sleeps on.
    asleepOn (tid) {
      const out = blocking.filter(e => e.from === tid)
      if (out.length === 0) return null
      const newestOut = out.reduce((a, b) => (a.declared > b.declared ? a : b))
      const wake = blocking.filter(e => e.to === tid && e.declared > newestOut.declared)
      return wake.length ? null : newestOut
    },
    // The newest live declaration pointing at tid — next uses it to put the
    // yielded-to node first (the chain's frozen work is what the turn serves).
    wakePriority (tid) {
      const at = live.filter(e => e.to === tid)
      return at.length ? at.reduce((a, b) => (a.declared > b.declared ? a : b)).declared : ''
    }
  }
}

// Does `to`'s ability to run depend on `from` finishing? Walk to's parent +
// blocked_by chain; hitting `from` means the declared wait can never be served.
function holdsShut (P, from, to) {
  const seen = new Set()
  const stack = [to]
  while (stack.length) {
    const t = stack.pop()
    if (seen.has(t)) continue
    seen.add(t)
    const ups = [P.parentOf(t), ...P.blockedIdsOf(P.taskPath(t))].filter(u => u !== '')
    if (ups.includes(from)) return true
    stack.push(...ups)
  }
  return false
}

const quote = s => `'${s.replace(/'/g, "''")}'`

function serialize (entries) {
  const lines = ['waits:']
  for (const e of entries) {
    lines.push(`  - from: ${e.from}`)
    lines.push(`    to: ${e.to}`)
    lines.push(`    declared: ${e.declared}`)
    if (e.step !== '') lines.push(`    step: ${e.step}`)
    lines.push(`    need: ${quote(e.need)}`)
    lines.push(`    resolved: ${e.resolved === '' ? "''" : e.resolved}`)
    lines.push(`    answer: ${e.answer === '' ? "''" : quote(e.answer)}`)
  }
  return lines.join('\n') + '\n'
}

// Rewrite = parse + serialize. Hand-added fields outside the roster do not survive a
// write; the ledger is runtime-owned (unlike the gate records, nothing else edits it).
function writeWaits (P, entries) { writeAtomic(waitsPath(P), serialize(entries)) }

const USAGE = 'usage: grovespec wait                          — list live waits and whose turn it is\n' +
  '       grovespec wait TASK-A TASK-B <need…>    — TASK-A stops until TASK-B answers <need>\n' +
  '       grovespec wait resolve TASK-A TASK-B <answer…> — TASK-A closes its wait, saying what answered it\n'

export function cmdWait (P, args) {
  if (args.length === 0) return listWaits(P)
  if (args[0] === 'resolve') return resolveWait(P, args.slice(1))
  return declareWait(P, args)
}

function listWaits (P) {
  const st = waitState(P)
  for (const m of st.problems) say(m)
  if (st.problems.length) { say('the ledger cannot be scheduled from — fix the lines above first'); return 2 }
  if (st.live.length === 0) { say('no live waits'); return 0 }
  say('live waits (the turn follows the newest declaration):')
  for (const e of st.live) {
    const landed = P.statusOf(e.to) === 'done' ? ' — target is done: resume and resolve' : ''
    say(`  ${e.from} → ${e.to}  declared ${e.declared} — ${e.need}${landed}`)
  }
  for (const tid of P.treeIds()) {
    const on = st.asleepOn(tid)
    if (on === null && st.live.some(e => e.from === tid && P.statusOf(e.to) !== 'done')) {
      say(`turn: ${tid} — a newer wait points back at it (read that entry, answer it, then resolve or re-declare)`)
    }
  }
  return 1                                            // live waits = the build is not 100%
}

function declareWait (P, args) {
  const [from = '', to = '', ...needWords] = args
  const need = needWords.join(' ').trim()
  if (!ID.test(from) || !ID.test(to) || need === '') { say(USAGE.trimEnd()); return 2 }
  const ts = now()
  if (ts === null) { say(`GROVESPEC_NOW is not an ISO-8601 UTC timestamp: '${process.env.GROVESPEC_NOW}' — refused, the turn is ordered by this value`); return 2 }
  const ids = new Set(P.treeIds())
  if (!ids.has(from)) { say(`${from} is not in the tree`); return 2 }
  if (!ids.has(to)) { say(`${to} is not in the tree`); return 2 }
  if (from === to) { say(`${from} cannot wait on itself`); return 2 }
  if (P.statusOf(from) === 'done') { say(`${from} is done — a done node has nothing in flight to freeze; if its contract must change, that is grovespec-revise (reopen), not a wait`); return 2 }
  if (P.statusOf(to) === 'done') { say(`${to} is done — a value missing from a done contract is a revise: reopen ${to}, then declare the wait`); return 2 }
  // A wait onto a node the declarer itself holds shut (blocked_by/parent chain) could
  // never be served — the turn would pass to a node the scheduler cannot start until
  // the declarer finishes. That is not a wait, it is evidence the arrow is wrong:
  // either the value is the declarer's own to define, or the dependency direction /
  // node boundary needs a revise.
  if (holdsShut(P, from, to)) { say(`${to} cannot serve this wait — its blocked_by/parent chain runs through ${from}, so the turn could never reach it. The value is either ${from}'s own to define, or the dependency direction is wrong (grovespec-revise)`); return 2 }
  const { entries, problems } = readWaits(P)
  for (const m of problems) say(m)
  if (problems.length) { say('the ledger is unreadable — a declaration on top of it would schedule blind; fix the lines above first'); return 2 }
  const dup = entries.find(e => e.resolved === '' && e.from === from && e.to === to)
  if (dup) {
    // The ping-pong's return leg: the woken node answered the counter-need and now
    // yields again, its own need still open. One live entry per pair stays the rule —
    // re-declaring REFRESHES that entry's clock (and its wording), and because the
    // turn follows the newest declaration, this is exactly what passes the turn back.
    // Refusing here left the woken node "awake" forever: it could neither finish
    // (its need is unanswered) nor yield (the declaration was rejected).
    const was = dup.declared
    dup.declared = ts
    dup.need = need
    writeWaits(P, entries)
    say(`wait: ${from} → ${to} re-declared ${ts} (was ${was}) — the turn passes to ${to}`)
    say(`${from} is asleep again until ${to} answers or goes done — add a Change-Log line for what this turn answered`)
    return 0
  }
  entries.push({ from, to, declared: ts, step: '', need, resolved: '', answer: '' })
  writeWaits(P, entries)
  say(`wait: ${from} → ${to} declared ${ts}`)
  say(`${from} is asleep until ${to} answers or goes done — record the same fact in ${from}'s Change Log (one plain sentence)`)
  return 0
}

function resolveWait (P, args) {
  const [from = '', to = '', ...answerWords] = args
  const answer = answerWords.join(' ').trim()
  if (!ID.test(from) || !ID.test(to) || answer === '') { say(USAGE.trimEnd()); return 2 }
  const ts = now()
  if (ts === null) { say(`GROVESPEC_NOW is not an ISO-8601 UTC timestamp: '${process.env.GROVESPEC_NOW}' — refused, the turn is ordered by this value`); return 2 }
  const { entries, problems } = readWaits(P)
  for (const m of problems) say(m)
  if (problems.length) { say('the ledger is unreadable — resolving into it would schedule blind; fix the lines above first'); return 2 }
  const e = entries.find(e => e.resolved === '' && e.from === from && e.to === to)
  if (!e) { say(`no live wait ${from} → ${to} — nothing to resolve (grovespec wait lists what is live)`); return 2 }
  e.resolved = ts
  e.answer = answer
  writeWaits(P, entries)
  say(`resolved: ${from} → ${to} (declared ${e.declared}) — ${answer}`)
  say(`record what answered it in ${from}'s Change Log, then continue the step that froze`)
  return 0
}
