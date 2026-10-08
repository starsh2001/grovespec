// recheck — the candidate ledger and the ONE step that judges reach (v0.17.0).
// Measured on the launcher: a contract change used to
// reopen every dependent on the spot — 48 commits across 12 nodes for a two-item
// revise, eleven of them closing with "the change does not reach me". The user's
// design inverts it: a contract change makes dependents CANDIDATES, not reopens.
// They keep their `done` and their seals. When the origin lands back at `done`,
// `next` names one recheck step that judges every armed candidate together, and it
// judges exactly one question — does the change reach this node's use? — nothing
// else. Untouched candidates close in place (their seals were never broken, so
// there is nothing to re-approve); touched ones open through grovespec-revise and
// the same procedure repeats one layer down.
//
// The machine's share is MATERIAL, never a verdict. v0.17.0 let a grep decide:
// a footprint spelling none of the origin's contract names closed mechanically as
// "provable non-use". The external review broke that premise the same day, twice —
// a consumer of the RENAMED (old) name greps absent for today's names while its
// import is already broken, and a consumer coupled through a file format spells no
// producer name at all yet breaks on the changed bytes. Absence of today's names
// proves nothing about yesterday's names or indirect coupling, so the auto-close
// branch is deleted, not improved: the grep line feeds the session's waves
// (differently-armed, ended by the same find_streak rule the gates use), and every
// settle is a judged one.
//
// Ledger: .grovespec/candidates.yaml — runtime-owned like waits.yaml, one live
// entry per (node, from) pair, re-declaration refreshes in place. History lives in
// git and the Change Logs; the ledger holds the CURRENT state.
import { git, repoState, log, touched } from './git.mjs'
import { writeAtomic } from './project.mjs'
import { listItems, itemValue } from './core.mjs'
import { contractIdents } from './cmd-fresh.mjs'
import { existsSync, readFileSync } from 'node:fs'

const say = s => process.stdout.write(s + '\n')
const ID = /^TASK-[0-9]+$/
const bare = v => String(v ?? '').replace(/^(['"])(.*)\1$/, '$2').replace(/''/g, "'").trim()
const quote = s => `'${String(s).replace(/'/g, "''")}'`

const ISO = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$/
function now () {
  const v = process.env.GROVESPEC_NOW ?? ''
  if (v === '') return new Date().toISOString()
  return ISO.test(v) ? v : null
}

export function candsPath (P) { return `${P.root}/.grovespec/candidates.yaml` }

export function readCands (P) {
  const text = P.read(candsPath(P))
  if (text === null) return { entries: [], present: false, broken: null }
  const top = text.match(/^candidates[ \t]*:(.*)$/m)
  if (top === null) return { entries: [], present: true, broken: `${candsPath(P)} has no top-level 'candidates:' list — the ledger exists but cannot be read` }
  // A scalar where the list belongs reads as an EMPTY list to a lenient parser —
  // which silently drops every obligation the ledger holds. Fail loud instead,
  // the same rule the wait ledger lives by.
  if (top[1].trim() !== '') return { entries: [], present: true, broken: `${candsPath(P)} carries a scalar value after 'candidates:' instead of a list — the ledger exists but cannot be read` }
  const entries = listItems(text, 'candidates').map(it => ({
    node: bare(itemValue(it, 'node')),
    from: bare(itemValue(it, 'from')),
    need: bare(itemValue(it, 'need')),
    declared: bare(itemValue(it, 'declared')),
    closed: bare(itemValue(it, 'closed')),
    verdict: bare(itemValue(it, 'verdict'))
  }))
  for (const e of entries) {
    if (!ID.test(e.node) || !ID.test(e.from)) return { entries: [], present: true, broken: `${candsPath(P)} carries an entry without a TASK-N node/from — repair it before scheduling on it` }
  }
  return { entries, present: true, broken: null }
}

function serialize (entries) {
  const lines = ['candidates:']
  for (const e of entries) {
    lines.push(`  - node: ${e.node}`)
    lines.push(`    from: ${e.from}`)
    lines.push(`    need: ${quote(e.need)}`)
    lines.push(`    declared: ${e.declared}`)
    lines.push(`    closed: ${e.closed === '' ? "''" : e.closed}`)
    lines.push(`    verdict: ${e.verdict === '' ? "''" : quote(e.verdict)}`)
  }
  return lines.join('\n') + '\n'
}
const writeCands = (P, entries) => { writeAtomic(candsPath(P), serialize(entries)); P.forget() }

// The scheduling truth for cmd-next and validate: open entries, split by whether
// their origin has landed back at done (armed) or is still mid-cycle (waiting).
// `broken` must be SAID by every caller — an unreadable ledger folded into "no
// candidates" would close the door the ledger exists to hold open.
export function recheckState (P) {
  const c = readCands(P)
  if (c.broken !== null) return { open: [], armed: [], waiting: [], broken: c.broken }
  const open = c.entries.filter(e => e.closed === '')
  const armed = open.filter(e => P.statusOf(e.from) === 'done')
  return { open, armed, waiting: open.filter(e => P.statusOf(e.from) !== 'done'), broken: null }
}

// Machine reach material: the origin's Contract names ∩ the candidate's footprint
// files (its TASK-N: commits' files, still tracked). 'uses' hands the waves their
// use sites; 'unfound' and 'unknown' hand them the reason the grep saw nothing —
// no kind closes anything (see the header: absence is not proof of non-use).
function reachOf (P, from, node) {
  const task = P.read(P.taskPath(from))
  const ids = task === null ? [] : contractIdents(task)
  if (!ids.length) return { kind: 'unknown', why: 'the origin Contract carries no identifier-shaped names — nothing to grep for' }
  const history = log(P.root)
  if (history === null) return { kind: 'unknown', why: 'git log failed' }
  const commits = history.filter(c => c.s.startsWith(`${node}: `))
  if (!commits.length) return { kind: 'unknown', why: `no '${node}:' commits — a mapped node's footprint is not derivable from history` }
  const files = new Set()
  for (const c of commits) for (const f of touched(P.root, c.h) ?? []) files.add(f)
  const hits = new Set()
  for (const f of files) {
    const p = `${P.root}/${f}`
    if (!existsSync(p)) continue
    let text = ''
    try { text = readFileSync(p, 'utf8') } catch { continue }
    for (const id of ids) if (text.includes(id)) hits.add(id)
  }
  return hits.size ? { kind: 'uses', names: [...hits].sort() } : { kind: 'unfound', why: `none of ${ids.length} current contract name(s) appear in its ${files.size} footprint file(s)` }
}

export function cmdRecheck (P, rest) {
  const sub = rest[0] ?? ''

  if (sub === 'declare') {
    const from = rest[1] ?? ''
    if (!ID.test(from)) { say('usage: grovespec recheck declare TASK-FROM TASK-N… <why the contract change could reach them>'); return 2 }
    if (P.read(P.taskPath(from)) === null) { say(`no such node: ${from}`); return 2 }
    let i = 2; const nodes = []
    while (i < rest.length && ID.test(rest[i])) nodes.push(rest[i++])
    const need = rest.slice(i).join(' ').trim()
    if (!nodes.length || need === '') { say('usage: grovespec recheck declare TASK-FROM TASK-N… <why the contract change could reach them> — at least one candidate and the reason'); return 2 }
    const t = now()
    if (t === null) { say('GROVESPEC_NOW is set but not strict ISO-8601 UTC — refused'); return 2 }
    const c = readCands(P)
    if (c.broken !== null) { say(c.broken); return 2 }
    const entries = c.entries
    const out = []
    for (const node of nodes) {
      if (node === from) { say(`${node}: a node is never its own candidate — skipped`); continue }
      if (P.read(P.taskPath(node)) === null) { say(`${node}: no such node — skipped`); continue }
      const st = P.statusOf(node)
      if (st !== 'done') { say(`${node}: ${st} — an open node is not a candidate; its own cycle reads the new contract when it runs — skipped`); continue }
      const live = entries.find(e => e.node === node && e.from === from && e.closed === '')
      if (live) { live.need = need; live.declared = t; out.push(`${node} (re-declared — need refreshed)`); continue }
      entries.push({ node, from, need, declared: t, closed: '', verdict: '' })
      out.push(node)
    }
    if (!out.length) { say('nothing declared'); return 2 }
    writeCands(P, entries)
    say(`candidates of ${from}: ${out.join(' · ')} — they keep done and their seals; when ${from} is done again, one recheck step judges them together (grovespec recheck)`)
    return 0
  }

  if (sub === 'close' || sub === 'open') {
    // A verdict settles ONE (node, origin) pair — the question judged was "does
    // THIS origin's change reach this node", so an entry from another origin is a
    // different question, and a waiting origin's question does not even exist yet
    // (its change has not landed). v0.17.0 settled by node alone and one verdict
    // erased another origin's pending obligation — the external review's F4.
    const node = rest[1] ?? ''
    const from = ID.test(rest[2] ?? '') ? rest[2] : ''
    const verdict = rest.slice(from === '' ? 2 : 3).join(' ').trim()
    if (!ID.test(node) || verdict === '') { say(`usage: grovespec recheck ${sub} TASK-N [TASK-FROM] <verdict — the shown reason, not a feeling>`); return 2 }
    const t = now()
    if (t === null) { say('GROVESPEC_NOW is set but not strict ISO-8601 UTC — refused'); return 2 }
    const c = readCands(P)
    if (c.broken !== null) { say(c.broken); return 2 }
    const live = c.entries.filter(e => e.node === node && e.closed === '')
    if (!live.length) { say(`${node}: no open candidate entry — nothing to ${sub}`); return 2 }
    const armed = live.filter(e => P.statusOf(e.from) === 'done')
    let entry
    if (from !== '') {
      entry = live.find(e => e.from === from)
      if (!entry) { say(`${node}: no open candidate entry from ${from} — nothing to ${sub}`); return 2 }
      if (P.statusOf(from) !== 'done') { say(`${node}: the entry from ${from} is waiting — its origin is ${P.statusOf(from) || 'missing'}, so the change to judge has not landed yet; a verdict here would judge a change that does not exist`); return 2 }
    } else {
      if (!armed.length) { say(`${node}: no ARMED entry — its open entr${live.length > 1 ? 'ies are' : 'y is'} waiting on ${[...new Set(live.map(e => e.from))].join(' · ')} landing back at done`); return 2 }
      if (new Set(armed.map(e => e.from)).size > 1) { say(`${node}: armed entries from ${[...new Set(armed.map(e => e.from))].join(' · ')} — one verdict cannot judge two different changes; name the origin: grovespec recheck ${sub} ${node} TASK-FROM "…"`); return 2 }
      entry = armed[0]
    }
    entry.closed = t
    entry.verdict = (sub === 'open' ? 'opened — ' : 'untouched — ') + verdict
    writeCands(P, c.entries)
    const left = live.length - 1
    const staying = left ? ` ${left} other open entr${left > 1 ? 'ies' : 'y'} on ${node} stay${left > 1 ? '' : 's'} — different origins, different questions.` : ''
    say(sub === 'open'
      ? `${node}: judged TOUCHED by ${entry.from}'s change — now reopen it through grovespec-revise; if ITS contract changes, its dependents become candidates the same way.${staying}`
      : `${node}: closed untouched against ${entry.from}'s change — its done and its seals were never disturbed; the verdict is the record.${staying}`)
    return 0
  }

  if (sub !== '') { say('usage: grovespec recheck [declare TASK-FROM TASK-N… <need> | close TASK-N [TASK-FROM] <verdict> | open TASK-N [TASK-FROM] <verdict>]'); return 2 }

  // report
  const s = recheckState(P)
  if (s.broken !== null) { say(`recheck: cannot read the ledger — ${s.broken}`); return 2 }
  if (!s.open.length) { say('recheck: no open candidates — contract changes with dependents declare them (grovespec recheck declare, from grovespec-revise)'); return 0 }
  const canGrep = repoState(P.root) === 'repo'
  const byFrom = new Map()
  for (const e of s.open) { if (!byFrom.has(e.from)) byFrom.set(e.from, []); byFrom.get(e.from).push(e) }
  for (const [from, list] of byFrom) {
    const st = P.statusOf(from)
    say(`from ${from} (${P.nameOf(from)}) — ${st === 'done' ? 'ARMED: the origin is done, the recheck step is due' : `waiting: the origin is ${st}`}`)
    for (const e of list) {
      say(`  ${e.node} (${P.nameOf(e.node)}) — declared ${e.declared}`)
      say(`    need: ${e.need}`)
      if (st === 'done' && canGrep) {
        const r = reachOf(P, from, e.node)
        if (r.kind === 'uses') say(`    machine: uses \`${r.names.join('` · `')}\` → the waves judge whether the change reaches those uses`)
        else if (r.kind === 'unfound') say(`    machine: names unfound — ${r.why}; absence proves nothing (a renamed name or a file-mediated consumer greps as absent while broken) → the waves judge it`)
        else say(`    machine: unknown — ${r.why} → the waves judge it`)
      }
    }
  }
  say(s.armed.length
    ? '→ one recheck step judges every ARMED candidate together (grovespec-recheck): differently-armed waves until the find streak — the machine lines above are material for those waves, never verdicts; only judged-touched nodes reopen.'
    : '→ nothing armed yet — candidates wait until their origin lands back at done.')
  return s.armed.length ? 1 : 0
}
