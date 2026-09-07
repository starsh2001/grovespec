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
//   · the record's own config header (target · level · strength · repeat · max_rounds).
// Everything else — rounds, open_issues, followups, narrative — lives on in git history;
// prose (why it reopened) is the revise skill's job — this command owns only the state.
import { topValue, setFmValue } from './core.mjs'
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

function freshCycle (text, keep = {}) {
  const head = ['target', 'target_type', 'level', 'strength', 'repeat', 'max_rounds']
    .map(k => [k, topValue(text, k)])
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}: ${v}`)
  const kept = Object.entries(keep)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}: ${v}`)
  const adjudications = blockOf(text, 'adjudications') ?? 'adjudications: []'
  // Some cycles keep the condensed category list under its own `do_not_raise:` key —
  // same substance (a boundary, not evidence), so it survives the same way.
  const doNotRaise = blockOf(text, 'do_not_raise')
  return head.concat([
    '', 'round: 0', 'consecutive_passes: 0', 'status: in-progress', 'approved_by: pending',
    ...kept.length ? kept : [],
    '', 'rounds: []', '', 'open_issues: []', '', 'followups: []', '', adjudications,
    ...doNotRaise ? ['', doNotRaise] : [],
    ''
  ]).join('\n')
}

export function cmdReopen (P, n, target) {
  if (n === '' || (target !== 'draft' && target !== 'approved')) {
    say('usage: grovespec reopen TASK-N draft|approved   (draft = the spec changes; approved = only the code does)')
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
    writeAtomic(P.verifyYamlPath(n), freshCycle(vt))
    resets.push('verify cycle reset (adjudications kept)')
  }
  const rt = P.read(P.reviewYamlPath(n))
  if (rt !== null) {
    writeAtomic(P.reviewYamlPath(n), freshCycle(rt, { reviewed_commit: topValue(rt, 'reviewed_commit') }))
    resets.push('review cycle reset (reviewed_commit + adjudications kept)')
  }
  writeAtomic(P.taskPath(n), flipped)
  P.forget()

  say(`reopened: ${n} ${st} → ${target}${resets.length ? ` — ${resets.join(' · ')}` : ''}`)
  say(`  a fresh cycle starts here; record why in the Change Log (grovespec-revise owns the prose)`)
  return 0
}
