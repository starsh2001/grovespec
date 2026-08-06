// next — the ONE step to run now, decided mechanically so a driver never has to
// assemble it from `check` + `status` by hand (and never picks differently twice).
//
// Two rules make it safe to automate:
//   · human-owned transitions are SKIPPED, never picked — approving a spec, confirming a
//     result and approving the tree are the human's, and a driver that performs them is
//     the rubber stamp the whole method exists to prevent;
//   · it names one step and stops. Repetition belongs to the caller (a fresh session per
//     step is what keeps each step's context bounded — WORKFLOW §5).
//
// Wording note: this command never prints the driver's stop token. A machine loop watches
// the SKILL's final line for it, and a runtime that echoed it would stop the loop early.
import { listItemCount } from './core.mjs'
import { GATE_MSG } from './project.mjs'

const say = s => process.stdout.write(s + '\n')

function stepFor (P, tid) {
  switch (P.statusOf(tid)) {
    case 'sketch': return 'grovespec-grow'
    case 'draft': return 'grovespec-verify'
    case 'approved': return 'grovespec-implement'
    case 'implemented': return 'grovespec-review'
    case 'fixed': return 'grovespec-review'
    // reviewed = a round finished: open issues are fix's, an empty list is another round.
    // (A passed review is the human's confirm — humanWaits already skipped it.)
    case 'reviewed':
      return listItemCount(P.read(P.reviewYamlPath(tid)) ?? '', 'open_issues') > 0
        ? 'grovespec-fix' : 'grovespec-review'
    default: return null
  }
}

// A clean gate the machine may take in auto mode: no escalation, and the record it would
// stamp holds no open issues. Anything else stays the human's.
function autoTakeable (P, tid, waits) {
  if (!waits.length || waits.some(w => w.kind === 'escalated')) return false
  const p = waits[0].kind === 'approve' ? P.verifyYamlPath(tid) : P.reviewYamlPath(tid)
  return listItemCount(P.read(p) ?? '', 'open_issues') === 0
}

export function cmdNext (P, auto) {
  if (P.treeGatePending()) {
    // The decomposition gate stays the human's even in auto mode: it is once per project,
    // and a wrong tree is the most expensive thing to build forty nodes on top of.
    say('next: tree → grovespec-verify (the decomposition gate)')
    say(`  ${GATE_MSG}`)
    return 0
  }

  const ids = P.treeIds()
  const waiting = []
  const blocked = []
  let pick = null
  let pickStep = null
  for (const t of ids) {
    if (P.statusOf(t) === 'done') continue
    const ub = P.unblocked(t)
    if (ub !== 'yes') { blocked.push(`${t} (${ub.slice(3)})`); continue }
    const w = P.humanWaits(t)
    if (w.length) {
      if (auto && autoTakeable(P, t, w)) {
        if (pick === null) { pick = t; pickStep = 'grovespec approve (machine takes the clean gate)' }
        continue
      }
      waiting.push(`${t} ${w[0].text}`)
      continue
    }
    if (pick === null) { pick = t; pickStep = stepFor(P, t) }
  }

  if (pick !== null) {
    const step = pickStep
    if (step === null) { say(`nothing runnable — ${pick} has an unknown status '${P.statusOf(pick)}' (run grovespec validate)`); return 1 }
    say(`next: ${pick} (${P.nameOf(pick)}) ${P.statusOf(pick)} → ${step}`)
    if (waiting.length) {
      say('also waiting on you (not runnable):')
      for (const w of waiting) say(`  ${w}`)
    }
    return 0
  }

  if (waiting.length) {
    say(`nothing runnable — waiting on you${auto ? ' (auto mode cannot take these)' : ''}:`)
    for (const w of waiting) say(`  ${w}`)
  } else if (blocked.length) {
    say('nothing runnable — every remaining node is blocked:')
    for (const b of blocked) say(`  ${b}`)
  } else if (ids.length === 0) {
    say('nothing runnable — the tree is empty (run grovespec-init)')
  } else {
    say('nothing runnable — every node is done')
  }
  return 1
}
