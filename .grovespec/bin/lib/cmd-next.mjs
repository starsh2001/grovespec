// next — the ONE step to run now, decided mechanically so a driver never has to
// assemble it from `check` + `status` by hand (and never picks differently twice).
//
// Two rules make it safe to automate:
//   · it stops at DECISIONS, never at stages (v0.18.0): a sealed clean gate — passed, no
//     open issues, no escalation — holds nothing a person must decide, so it is named as
//     a step (`grovespec approve`, recorded approved_by: machine — the verification
//     result, never the person's approval) in EVERY mode. What is skipped, never picked,
//     is a ruling only a human can make: an escalation, and the tree gate (a
//     decomposition is a scope choice). Decisions inside a step (a gap ruling, an
//     ambiguity) are the step skill's to ask, before the seal — a sealed verdict carries
//     no open decision;
//   · it names one step and stops. Repetition belongs to the caller (a fresh session per
//     step is what keeps each step's context bounded — WORKFLOW §5).
// --auto still changes two things: the step skill takes a decision that carries a
// recommended option, and the all-done terminal ends on a record-only followup list
// instead of routing to plan (where, in ask mode, the user's pick is the decision).
//
// Wording note: this command never prints the driver's stop token. A machine loop watches
// the SKILL's final line for it, and a runtime that echoed it would stop the loop early.
import { listItemCount, RECORD_CATEGORIES } from './core.mjs'
import { treeGateMsg } from './project.mjs'
import { freshSignals } from './cmd-fresh.mjs'
import { retroOwed } from './cmd-retro.mjs'
import { waitState } from './cmd-wait.mjs'
import { recheckState } from './cmd-recheck.mjs'
import { claimState, holderText, doneText, releaseHint, abandonHint, MERGE_FIRST } from './cmd-claim.mjs'

const say = s => process.stdout.write(s + '\n')

function stepFor (P, tid) {
  switch (P.statusOf(tid)) {
    case 'sketch': return 'grovespec-grow'
    case 'draft': return P.needsGrow(tid) ? 'grovespec-grow' : 'grovespec-verify'
    case 'approved': return 'grovespec-implement'
    case 'implemented': return 'grovespec-review'
    case 'fixed': return 'grovespec-review'
    // reviewed = a round finished: open issues are fix's, an empty list is another round.
    // (A sealed passed review is the approve step — humanWaits routed it above.)
    case 'reviewed':
      return listItemCount(P.read(P.reviewYamlPath(tid)) ?? '', 'open_issues') > 0
        ? 'grovespec-fix' : 'grovespec-review'
    default: return null
  }
}

// A sealed clean gate the driver takes in either mode: no escalation, and the record it
// would stamp holds no open issues. An escalation is the one wait that stays the human's.
function takeable (P, tid, waits) {
  if (!waits.length || waits.some(w => w.kind === 'escalated')) return false
  const p = waits[0].kind === 'approve' ? P.verifyYamlPath(tid) : P.reviewYamlPath(tid)
  return listItemCount(P.read(p) ?? '', 'open_issues') === 0
}

export function cmdNext (P, auto) {
  // Worktree claims (v0.19.0), read lazily and once: what another worktree of this
  // repository holds — a node, a node it finished on a branch not merged here, or the
  // tree — is never picked here. Unreadable is a stop, never an empty list (the rule the
  // two ledgers below live by); a run that never reaches a claim question (every node
  // done, nothing tree-wide due) asks git nothing new.
  let cs = null
  const claims = () => (cs ??= claimState(P))
  const unreadable = () => {
    say(claims().broken)
    say('nothing decidable — whether another worktree holds a node or the tree cannot be read; fix that, then re-run')
    return 1
  }
  // A tree-wide step (tree gate · recheck · retro · plan) waits while another worktree
  // holds the tree — two at once edit the same ledger files from two branches. null = go
  // ahead; a number = the exit code (it has already said why).
  const treeHeld = what => {
    if (claims().broken !== null) return unreadable()
    const t = claims().tree()
    if (t === null) return null
    say(`nothing runnable — ${what} is due, but another worktree holds the tree-wide step: ${holderText(t)} — ${releaseHint('tree')}`)
    return 1
  }

  if (P.treeGatePending()) {
    // The tree gates stay the human's even in auto mode: once per project (decomposition)
    // or once per adoption (survey fidelity), and a wrong tree is the most expensive
    // thing to build forty nodes on top of.
    const kind = P.treeGateKind()
    if (P.treeAwaitingHuman()) {
      say('nothing runnable — waiting on you (the tree gate is yours in every mode):')
      say(kind === 'fidelity'
        ? '  tree     survey passed its cold fidelity verify — look at the mapped tree, then: grovespec approve tree --human'
        : '  tree     decomposition passed its cold verify — first cycle: look at the tree; re-verify: look at the delta since your last approval (the verify record and step report name it), then: grovespec approve tree --human')
      return 1
    }
    const stop = treeHeld(`the ${kind === 'fidelity' ? 'survey fidelity' : 'decomposition'} gate (grovespec-verify on the tree)`)
    if (stop !== null) return stop
    say(`next: tree → grovespec-verify (the ${kind === 'fidelity' ? 'survey fidelity' : 'decomposition'} gate)`)
    say(`  ${treeGateMsg(P)}`)
    return 0
  }

  // The sideways-dependency ledger gates scheduling BEFORE anything is picked: a
  // half-read ledger folded into "no waits" would wake a frozen node, so unreadable
  // is a stop, not an empty list.
  const ws = waitState(P)
  if (ws.problems.length) {
    for (const m of ws.problems) say(m)
    say('nothing decidable — the wait ledger cannot be read; fix it, then re-run')
    return 1
  }

  // An ARMED recheck outranks new node work (v0.17.0): its candidates are done
  // nodes whose done became provisional the moment their origin's contract changed
  // — building more on top before the reach question is answered is how one wrong
  // "untouched" compounds. One step judges every armed candidate together; nothing
  // reopens unless that step says touched. Same fail-loud rule as the wait ledger:
  // unreadable is a stop, never an empty list.
  const rc = recheckState(P)
  if (rc.broken !== null) {
    say(rc.broken)
    say('nothing decidable — the candidate ledger cannot be read; fix it, then re-run')
    return 1
  }
  if (rc.armed.length) {
    const stop = treeHeld('a recheck (grovespec-recheck)')
    if (stop !== null) return stop
    const froms = [...new Set(rc.armed.map(e => e.from))].join(' · ')
    say(`next: recheck — ${rc.armed.length} candidate(s) from ${froms} are armed (origin done); one step judges whether the change reaches each, and only judged-touched nodes reopen (grovespec-recheck)`)
    return 0
  }

  const ids = P.treeIds()
  // A node another worktree holds is skipped — its progress lives on that worktree's
  // branch, while this ledger still shows the status it had when the branches split. So
  // is one it finished on a branch not merged here: picking it would build it twice.
  if (ids.some(t => P.statusOf(t) !== 'done') && claims().broken !== null) return unreadable()
  const waiting = []
  const blocked = []
  let depBlocked = 0
  const held = []
  const landed = []
  const sayHeld = () => {
    if (held.length) {
      say('also held by another worktree (skipped — not runnable here):')
      for (const h of held) say(`  ${h}`)
    }
    if (landed.length) {
      say(`also done on a branch not merged here (skipped — ${MERGE_FIRST}):`)
      for (const h of landed) say(`  ${h}`)
    }
  }
  let pick = null
  let pickStep = null
  let pickPrio = ''
  // The turn follows the newest declaration: among runnable nodes, one that a live
  // wait points AT outranks tree order (the chain's frozen work is what the turn
  // serves), newest declaration first. '' = nobody waits on it.
  const take = (t, step) => {
    const prio = ws.wakePriority(t)
    if (pick === null || prio > pickPrio) { pick = t; pickStep = step; pickPrio = prio }
  }
  for (const t of ids) {
    if (P.statusOf(t) === 'done') continue
    const ub = P.unblocked(t)
    if (ub !== 'yes') { blocked.push(`${t} (${ub.slice(3)})`); depBlocked++; continue }
    const asleep = ws.asleepOn(t)
    if (asleep !== null) { blocked.push(`${t} (waiting on ${asleep.to} — declared ${asleep.declared})`); depBlocked++; continue }
    const h = claims().held(t)
    if (h !== null && h.kind === 'claim') {
      held.push(`${t} (${holderText(h.c)}) — ${releaseHint(t)}`)
      blocked.push(`${t} (held by ${holderText(h.c)} — ${releaseHint(t)})`)
      continue
    }
    if (h !== null) {
      landed.push(`${t} (${doneText(h.c)}) — ${abandonHint(t)}`)
      blocked.push(`${t} (${doneText(h.c)} — not merged here: ${MERGE_FIRST}; ${abandonHint(t)})`)
      continue
    }
    const w = P.humanWaits(t)
    if (w.length) {
      if (takeable(P, t, w)) {
        take(t, 'grovespec approve (sealed clean gate, nothing to decide — the machine takes it)')
        continue
      }
      // Not takeable and not escalated = a passed record still listing open issues (a
      // state validate names). Say that, not "nothing to decide" — no mode approves past it.
      const esc = w.find(x => x.kind === 'escalated')
      waiting.push(esc ? `${t} ${esc.text}` : `${t} ${w[0].kind === 'approve' ? 'spec verify' : 'review'} passed but its record still lists open issues — no mode approves past them (grovespec validate; clear them first)`)
      continue
    }
    take(t, stepFor(P, t))
  }

  if (pick !== null) {
    const step = pickStep
    if (step === null) { say(`nothing runnable — ${pick} has an unknown status '${P.statusOf(pick)}' (run grovespec validate)`); return 1 }
    say(`next: ${pick} (${P.nameOf(pick)}) ${P.statusOf(pick)} → ${step}`)
    sayHeld()
    if (waiting.length) {
      say('also waiting on you (not runnable):')
      for (const w of waiting) say(`  ${w}`)
    }
    return 0
  }

  if (waiting.length) {
    say('nothing runnable — waiting on you (a ruling no mode takes):')
    for (const w of waiting) say(`  ${w}`)
    sayHeld()
  } else if (blocked.length) {
    const kinds = []
    if (depBlocked) kinds.push('blocked')
    if (held.length) kinds.push('held by another worktree')
    if (landed.length) kinds.push('done on a branch not merged here')
    say(`nothing runnable — every remaining node is ${kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} or ${kinds.at(-1)}` : kinds[0]}:`)
    for (const b of blocked) say(`  ${b}`)
  } else if (ids.length === 0) {
    // An installed project with no tree = the pre-plan state: the first planning pass
    // lays the tree (greenfield plan #0). Without even a config there is no project yet.
    if (P.configText !== '') {
      const stop = treeHeld('the first planning pass (grovespec-plan)')
      if (stop !== null) return stop
      say('next: plan — the tree is empty; the first planning pass lays it (grovespec-plan)')
      return 0
    }
    say('nothing runnable — the tree is empty (run grovespec-init)')
  } else {
    // Every node done. Before anything routes to plan, the milestone owes its CLOSING
    // LOOK (v0.16.0): node-scoped gates structurally miss defects composed across
    // nodes (the launcher's startup-timeout dead-end had every ingredient recorded
    // in three Tasks and was found only by a whole-tree review after all gates were
    // green). A retro is owed when TASK- work landed since the last retro record;
    // it never reopens anything — its must-fix findings land in the backlogs, which
    // the plan routing below already reads.
    const ro = retroOwed(P)
    // An uncomputable owed-state must be SAID, never folded into "not owed" — a
    // retro record with a broken anchor read as "every node is done" and the debt
    // question vanished (external review 2026-09-25, K2). Same shape as the fresh
    // broken-git terminal below. A non-repo project stays broken:null — it has no
    // history to owe a retro on, and the fresh terminal already names that state.
    if (ro.broken !== null) {
      say(`nothing decidable — every node is done but the retro owed-state cannot be computed (${ro.broken}); repair that, then re-run`)
      return 1
    }
    if (ro.owed) {
      const stop = treeHeld("the milestone's retrospective (grovespec-retro)")
      if (stop !== null) return stop
      say(`next: retro — every node is done, and ${ro.work.length} TASK commit(s) landed since ${ro.anchor === null ? 'the milestone began' : `retro-${ro.n}`}; the milestone owes its closing look before the next plan (grovespec-retro)`)
      return 0
    }
    // Parked work (followups · the backlogs, interjected requests included · fresh hand-edits) routes to the
    // next planning pass — the driver must never end silently on top of known work.
    // fresh is asked only here: the terminal is the one spot a hand-edit could
    // otherwise slip out of the loop for good.
    const b = P.backlogCounts()
    const sig = freshSignals(P)
    // A broken git contributes zero signals but must not read as "no signals" —
    // the terminal below names it instead of ending quietly (or routing on it).
    const fresh = sig.broken === null ? sig.dirty.length + sig.offband.length : 0
    // The record list is not auto's queue (2026-09-21 decision): improvement ·
    // harmless-bug followups are worked only on the user's pick, so in --auto they END
    // the run instead of opening a planning session on top of them. The judgment axis
    // is CATEGORY, never kind — contract-gap + improvement is still record-only, while
    // a must-fix category routed as contract-gap is real pending work. Unclassified
    // legacy items are conservatively real work (a human must re-read them), as are
    // the brownfield backlogs and fresh signals — in every mode.
    const unq = s => s.replace(/^(['"])(.*)\1$/, '$2').trim()
    const recordOnly = P.allFollowups().filter(f => RECORD_CATEGORIES.includes(unq(f.category))).length
    const fuWork = auto ? b.followups - recordOnly : b.followups
    if (fuWork + b.findings + b.restructuring + b.requests + fresh > 0) {
      const stop = treeHeld('a planning pass (grovespec-plan)')
      if (stop !== null) return stop
      const parts = []
      if (fuWork) parts.push(`followups ${fuWork}`)
      if (b.findings) parts.push(`findings ${b.findings}`)
      if (b.restructuring) parts.push(`restructuring ${b.restructuring}`)
      if (b.requests) parts.push(`requests ${b.requests}`)
      if (fresh) parts.push(`fresh ${fresh}`)
      say(`next: plan — every node is done, parked work awaits: ${parts.join(' · ')}${auto && recordOnly ? ` (+ ${recordOnly} record-only item(s), on your pick)` : ''} (grovespec-plan)`)
      return 0
    }
    // EVERY quiet terminal must say what it did NOT look at — the record-only end
    // included (a review of the first cut caught it stating less than `fresh` does).
    // Committed history goes unclassified when the project is nested in a larger repo,
    // or when no adoption anchor exists — routing on "can't know" would never
    // terminate, but a bare "every node is done" over that blind spot is a silent end
    // on possibly-known work. A broken git outranks the record-only end too: fresh
    // signals are unreadable, so "only the record list remains" is not established.
    if (sig.broken !== null) {
      say(`nothing decidable — every node is done but history cannot be classified (${sig.broken}); fix git, then re-run`)
      return 1
    }
    const blind = !sig.repo ? ''
      : sig.nested ? ' — committed hand-edits not classified (nested in a larger repository; grovespec fresh states the boundary)'
      : sig.adoption === null ? ' — committed hand-edits not classified (no adoption anchor in history; grovespec fresh states the boundary)'
      : ''
    if (auto && recordOnly > 0) {
      say(`nothing runnable — every node is done; the record list holds ${recordOnly} improvement/harmless item(s), worked only on your pick (grovespec-plan when you want them)${blind}`)
      return 1
    }
    say(`nothing runnable — every node is done${blind}`)
  }
  return 1
}
