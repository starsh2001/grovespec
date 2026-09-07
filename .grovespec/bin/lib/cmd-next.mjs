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
import { treeGateMsg } from './project.mjs'
import { freshSignals } from './cmd-fresh.mjs'

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
    // The tree gates stay the human's even in auto mode: once per project (decomposition)
    // or once per adoption (survey fidelity), and a wrong tree is the most expensive
    // thing to build forty nodes on top of.
    const kind = P.treeGateKind()
    if (P.treeAwaitingHuman()) {
      say(`nothing runnable — waiting on you${auto ? ' (auto mode cannot take the tree gate)' : ''}:`)
      say(kind === 'fidelity'
        ? '  tree     survey passed its cold fidelity verify — look at the mapped tree, then: grovespec approve tree --human'
        : '  tree     decomposition passed its cold verify — look at the tree, then: grovespec approve tree --human')
      return 1
    }
    say(`next: tree → grovespec-verify (the ${kind === 'fidelity' ? 'survey fidelity' : 'decomposition'} gate)`)
    say(`  ${treeGateMsg(P)}`)
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
    // An installed project with no tree = the pre-plan state: the first planning pass
    // lays the tree (greenfield plan #0). Without even a config there is no project yet.
    if (P.configText !== '') { say('next: plan — the tree is empty; the first planning pass lays it (grovespec-plan)'); return 0 }
    say('nothing runnable — the tree is empty (run grovespec-init)')
  } else {
    // Every node done. Parked work (followups · brownfield backlogs · fresh hand-edits)
    // routes to the next planning pass — the driver must never end silently on top of
    // known work. fresh is asked only here: the terminal is the one spot a hand-edit
    // could otherwise slip out of the loop for good.
    const b = P.backlogCounts()
    const sig = freshSignals(P)
    // A broken git contributes zero signals but must not read as "no signals" —
    // the terminal below names it instead of ending quietly (or routing on it).
    const fresh = sig.broken === null ? sig.dirty.length + sig.offband.length : 0
    if (b.total + fresh > 0) {
      const parts = []
      if (b.followups) parts.push(`followups ${b.followups}`)
      if (b.findings) parts.push(`findings ${b.findings}`)
      if (b.restructuring) parts.push(`restructuring ${b.restructuring}`)
      if (fresh) parts.push(`fresh ${fresh}`)
      say(`next: plan — every node is done, parked work awaits: ${parts.join(' · ')} (grovespec-plan)`)
      return 0
    }
    // The quiet terminal must say what it did NOT look at. Committed history goes
    // unclassified when the project is nested in a larger repo, or when no adoption
    // anchor exists — routing on "can't know" would never terminate, but a bare
    // "every node is done" over that blind spot is a silent end on possibly-known work.
    if (sig.broken !== null) {
      say(`nothing decidable — every node is done but history cannot be classified (${sig.broken}); fix git, then re-run`)
      return 1
    }
    const blind = !sig.repo ? ''
      : sig.nested ? ' — committed hand-edits not classified (nested in a larger repository; grovespec fresh states the boundary)'
      : sig.adoption === null ? ' — committed hand-edits not classified (no adoption anchor in history; grovespec fresh states the boundary)'
      : ''
    say(`nothing runnable — every node is done${blind}`)
  }
  return 1
}
