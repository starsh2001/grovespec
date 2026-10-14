// GroveSpec commands. Every message and exit code here is the contract tests/regress.sh
// pins — the bash runtime this ports was graded against the same goldens.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { cfgValue, findWaves, itemStuck, sectionsOf, badTreeLines, treeStrictProblems, pipes, langValue, topValue, listItemCount, listItems, itemValue, splitLines, flowListKeys, strictYamlProblems, MUST_FIX_CATEGORIES, RECORD_CATEGORIES, LEGACY_GRADE_FIELDS, completionProblems, frontmatterBoundaryProblem, readabilityFindings } from './core.mjs'
import { Project, treeGateMsg, scriptDir, FORMAT } from './project.mjs'
import { taskEvidenceDigest, specDigest, treeDigest } from './cmd-pin.mjs'
import { lastTest } from './cmd-approve.mjs'
import { git, repoState, ignoredState, ignoredUnder, shallowState, showPrefix, ancestorState, canonicalOidState, dirtyResultSubject, resultSealBreach, log, touched, trackedPaths, allSubjects, allTouchedPaths, gitFailure } from './git.mjs'
import { SourceEvidenceError, assertFindRound, parseSourcePacket, skippedIndexRows, sourceScopeDigest, taskRefAssignment, validateCompletedPacket, validateTaskRefsSyntax } from './source-evidence.mjs'
import { TreeEvidenceError, TREE_EVIDENCE_MODES, treeEvidenceDigest } from './tree-evidence.mjs'
import { readWaits, waitState, waitsPath } from './cmd-wait.mjs'
import { hooksState, HOOK_MARK } from './cmd-hooks.mjs'
import { readCands, candsPath, recheckState } from './cmd-recheck.mjs'
import { retroOwed } from './cmd-retro.mjs'
import { sharedContext, readState, writeState, withSharedLock, STATE_REMEDY } from './shared.mjs'

const say = s => process.stdout.write(s + '\n')
const pad = (s, n) => s.length >= n ? s : s + ' '.repeat(n - s.length)
const hasTop = (text, key) => splitLines(text).some(line => new RegExp(`^${key}[ \\t]*:`).test(line))

// ===================== validate =====================
// Every schema key this validator reads, as a roster — checked BEFORE any artifact is
// read, so the answer does not depend on what the project happens to contain. Checking
// a key at its use site only fires when something reaches that site: an empty project
// (no tasks, no review files) skipped every check AND every guard, and a wiped schema
// read as "all checks passed". tests/doccheck.sh pins this list against the schema-key
// call sites in both directions — a new key that skips the preflight fails the suite.
export const SCHEMA_KEYS = [
  'task.fm.required', 'task.fm.enum.role', 'task.fm.enum.status', 'task.fm.enum.origin',
  'task.sections', 'review.fm.required', 'review.enum.status', 'review.enum.target_type',
  'review.enum.level', 'review.enum.approved_by', 'review.enum.item_phase',
  'round.fm.required', 'round.fm.optional',
  'finding.fm.required',
  'finding.enum.kind', 'finding.enum.category',
  'brief.fm.required', 'brief.sections', 'conventions.sections',
  'read.item.max', 'read.paragraph.max', 'read.lede.max', 'read.jargon'
]

// A number the schema does not carry is a limit nobody agreed to — refuse to invent
// one, and let the preflight's own "key missing" problem be the single report. The
// key is spelled at the CALL site, never passed in: doccheck pins the roster above
// against the literal key strings in the schema-reading calls, and a key reached
// through a variable is a key that roster can no longer see.
const readLimit = raw => {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function cmdValidate (P) {
  let problems = 0
  const prob = m => { say(`  ${m}`); problems++ }
  const untrackedGates = []          // a notice, printed at the end — never a problem
  const readNotices = []             // readability of sealed (approved+) or done nodes — same
  const yamlNotices = []             // gate-record spots strict YAML can't read (or grovespec can't see) — same
  const markerNotices = []           // sideways deferral markers on sealed (approved+) nodes — same
  const ignoredOwn = []              // GroveSpec files git ignores — same
  const refNotices = []              // a sketch/draft node its next spec gate will refuse — same
  const streakNotices = []           // a running cycle with a lower find_streak than config — same

  // A schema key that resolves to nothing turns its checks OFF, not green — the
  // `for` loop it feeds runs zero times and the run stays clean. A renamed or lost
  // key must fail the run, never quietly shrink it. (One report per key, not per file.)
  const schWarned = new Set()
  const schList = key => {
    const l = pipes(P.sch(key))
    if (!l.length && !schWarned.has(key)) {
      schWarned.add(key)
      prob(`schema  '${key}' missing or empty — its checks cannot run (broken .grovespec/schema is not a clean pass)`)
    }
    return l
  }
  // The preflight: every key, before any artifact decides which ones get touched.
  for (const k of SCHEMA_KEYS) schList(k)

  // A stamp this runtime cannot read is refused at the dispatcher (project.mjs
  // versionRefusal) — every command, not just this one. What remains here is the
  // pre-versioning install: same format, no stamp, so it is advised, never refused.
  if (P.configText !== '' && topValue(P.configText, 'version') === '') {
    prob(`${P.configPath}  no version: line — pre-versioning install; add 'version: ${FORMAT}' (the format this runtime reads)`)
  }
  for (const m of P.pathProblems) prob(`${P.configPath}  ${m}`)
  for (const m of P.duplicateKeyProblems()) prob(m)
  for (const m of P.frontmatterProblems()) prob(m)

  // --- per task file ---
  for (const f of P.taskFiles()) {
    const tid = P.tidOf(f)
    const taskText = P.read(f) ?? ''
    // One boundary diagnostic is enough. Without a closing fence every body field
    // could masquerade as frontmatter, so none of the field/section verdicts below
    // are meaningful until the boundary is repaired.
    if (frontmatterBoundaryProblem(taskText) !== null) continue
    try { validateTaskRefsSyntax(taskText, f) } catch (e) {
      if (!(e instanceof SourceEvidenceError)) throw e
      prob(e.message)
    }
    for (const k of schList('task.fm.required')) {
      if (P.fm(f, k) === '') prob(`${f}  frontmatter '${k}' missing`)
    }
    if (P.fm(f, 'id') !== tid) prob(`${f}  id '${P.fm(f, 'id')}' != filename '${tid}' → set id to ${tid}`)
    let v = P.fm(f, 'role')
    if (v !== '' && !schList('task.fm.enum.role').includes(v)) prob(`${f}  role '${v}' invalid → use ${P.sch('task.fm.enum.role')}`)
    v = P.fm(f, 'status')
    if (v !== '' && !schList('task.fm.enum.status').includes(v)) prob(`${f}  status '${v}' invalid → use ${P.sch('task.fm.enum.status')}`)
    v = P.fm(f, 'tdd')
    if (v === 'true') { /* ok */ } else if (v === 'false') {
      if (P.fm(f, 'tdd_skip_reason') === '') prob(`${f}  tdd:false requires tdd_skip_reason`)
    } else prob(`${f}  tdd '${v}' must be true|false`)
    v = P.fm(f, 'origin')
    if (v !== '' && !schList('task.fm.enum.origin').includes(v)) prob(`${f}  origin '${v}' invalid → use ${P.sch('task.fm.enum.origin')}`)
    const want = schList('task.sections').join('\n')
    const got = sectionsOf(P.read(f) ?? '').join('\n')
    if (want !== got) prob(`${f}  sections mismatch → need (in order): ${P.sch('task.sections')}`)

    // How it reads to a PERSON in a renderer (FORMATS.md "How it reads when rendered").
    // A `done` node's bytes are historical — its gates are decided and nothing is going
    // to rewrite them — so those report as a notice; anything still being written must
    // come out readable, and blocks. That line is what lets a project in flight take
    // this runtime without every already-shipped node failing on upgrade day.
    const itemMax = readLimit(P.sch('read.item.max'))
    const paraMax = readLimit(P.sch('read.paragraph.max'))
    const ledeMax = readLimit(P.sch('read.lede.max'))
    if (itemMax && paraMax && ledeMax) {
      // Compare the title against the FRONTMATTER id, not the filename: an id that
      // disagrees with its filename is already one problem, and reporting it a second
      // time as a title fault sends the reader to fix the wrong line.
      const found = readabilityFindings(taskText, {
        id: P.fm(f, 'id') || tid, name: P.fm(f, 'name'), itemMax, paraMax, ledeMax, jargon: schList('read.jargon')
      })
      if (found.length) {
        const line = `${f}  hard to read rendered: ${found.join(' · ')}`
        // Same commitment line as the deferral markers below: readability BLOCKS only
        // where the text is free to edit — sketch/draft. From `approved` on the spec
        // span is sealed (spec_digest): demanding the tidy would demand breaking a
        // seal validate itself defends, so it reports as a notice until the node next
        // opens at draft (measured on the first external-review revise: four approved
        // propagation reopens were blocked by long lines their seals forbade fixing).
        const st = P.fm(f, 'status')
        if (st === 'sketch' || st === 'draft') prob(line)
        else readNotices.push(line)
      }
    }
    v = P.fm(f, 'blocked_by')
    if (v !== '') {
      // The lenient parser quietly drops a malformed dependency — a dropped dependency
      // is a dependency nobody waits for, so the malformation itself must be an error.
      if (!/^\[.*\]$/.test(v)) prob(`${f}  blocked_by '${v}' — write [] or [TASK-N, TASK-M]`)
      else {
        for (const tok of v.slice(1, -1).split(',').map(s => s.trim()).filter(s => s !== '')) {
          if (!/^TASK-[0-9]+$/.test(tok)) prob(`${f}  blocked_by token '${tok}' is not a TASK-N id`)
        }
      }
    }
    for (const b of P.blockedIdsOf(f)) {
      if (b === tid) prob(`${f}  blocked_by includes itself (${b})`)
      if (P.read(P.taskPath(b)) === null) prob(`${f}  blocked_by '${b}' has no task file`)
    }
    // A deferral marker may only point DOWN — this node's own child (grow re-enters it)
    // or its own implement. One naming a non-child node is a sideways IOU nobody ever
    // re-reads (the launcher incident). It BLOCKS only where the text
    // is free to edit — sketch/draft, pre-commitment: declare a wait instead. From
    // `approved` on, the spec is sealed (spec_digest): demanding the edit would demand
    // breaking a seal validate itself defends, so a sealed node reports as a notice
    // until the node next opens at draft (measured on the first live sync: two
    // approved specs mid-milestone would have needed a reopen just to reword a note).
    for (const m of taskText.matchAll(/\[[ \t]*→[ \t]*child\/deferred[ \t]*:([^\]]*)\]/g)) {
      for (const idm of m[1].matchAll(/TASK-[0-9]+/g)) {
        const named = idm[0]
        if (named === tid || P.childrenOf(tid).includes(named)) continue
        const line = `${f}  deferral marker names ${named}, which is not a child of ${tid} — a sideways obligation is a wait (grovespec wait ${tid} ${named} <need…>), never a deferral`
        const st = P.fm(f, 'status')
        if (st === 'sketch' || st === 'draft') prob(line)
        else markerNotices.push(line)
      }
    }
  }

  // --- tree.md line format + strict structure ---
  for (const bad of badTreeLines(P.treeText())) prob(`${P.treePath}:${bad}  not a '- TASK-N' line`)
  for (const m of treeStrictProblems(P.treeText())) prob(`${P.treePath}:${m}`)

  // --- tree <-> files (orphans both ways) ---
  const ids = P.treeIds()
  for (const t of ids) {
    if (P.read(P.taskPath(t)) === null) prob(`${P.treePath}  '${t}' has no task file (${P.taskPath(t)})`)
  }
  for (const f of P.taskFiles()) {
    if (!ids.includes(P.tidOf(f))) prob(`${f}  not in tree.md (orphan task)`)
  }

  // --- impossible states ---
  // A done node above an OPEN dependency used to be a problem unconditionally, and
  // satisfying it meant reopening the whole closure — the launcher measured 48
  // commits for a two-item revise, eleven nodes closing with "unaffected" (v0.17.0).
  // The lanes split it: a candidate entry EXPLAINS the
  // state (the node keeps done until the recheck step judges reach), an AC/doc-lane
  // reopen owes its dependents nothing, and only a `sketch` dependency below a done
  // node remains impossible (done was reached before the dependency was even
  // specified). An open dependency with no entry stays visible as a notice — the
  // contract lane should have declared candidates, and silence here is how a wrong
  // "unaffected" would hide.
  const cl = readCands(P)
  if (cl.broken !== null) prob(cl.broken)
  const explained = (node, from) => cl.broken === null && cl.entries.some(e => e.node === node && e.from === from)
  const candNotices = []
  for (const t of ids) {
    if (P.statusOf(t) !== 'done') continue
    const above = []
    const p = P.parentOf(t)
    if (p !== '') above.push(['parent', p])
    for (const b of P.blockedIdsOf(P.taskPath(t))) above.push(['blocked_by', b])
    for (const [kind, b] of above) {
      const st = P.statusOf(b)
      if (st === 'done') continue
      if (st === 'sketch') { prob(`${t} is done but ${kind} ${b} is sketch — done cannot predate its dependency's specification`); continue }
      if (explained(t, b)) continue
      candNotices.push(`${t} is done while ${kind} ${b} is ${st || 'missing'} and no candidate entry explains it — a contract-changing reopen declares its dependents (grovespec recheck declare ${b} ${t} <need>); an AC/doc-lane reopen owes nothing here`)
    }
  }
  if (cl.broken === null) {
    for (const e of cl.entries) {
      if (e.closed !== '') continue // settled entries naming gone nodes are history
      if (P.read(P.taskPath(e.node)) === null) prob(`${candsPath(P)}  open candidate names ${e.node}, which has no task file — settle or repair the entry`)
      else if (P.read(P.taskPath(e.from)) === null) prob(`${candsPath(P)}  open candidate of ${e.from}, which has no task file — settle or repair the entry`)
      // Advise only a command that can run: a verdict needs the origin's change to have
      // landed (recheck refuses a waiting origin), so an entry whose node reopened on its
      // own before its origin came back has nothing to do yet.
      else if (P.statusOf(e.node) !== 'done') candNotices.push(P.statusOf(e.from) === 'done'
        ? `${e.node} is ${P.statusOf(e.node)} but still holds an open candidate entry from ${e.from} — settle it (grovespec recheck open|close ${e.node} ${e.from} <verdict>), the ledger must not trail the state`
        : `${e.node} is ${P.statusOf(e.node)} and holds a candidate entry from ${e.from}, whose change has not landed (${e.from} is ${P.statusOf(e.from) || 'missing'}) — nothing to do now; the recheck step settles it once ${e.from} is done`)
    }
  }

  // --- blocked_by never names the node's own descendant ---
  // A child already waits for its parent (`unblocked`: the parent is done first), so a
  // parent whose blocked_by names a descendant waits on a node that waits on it — the
  // moment both are open, neither can start. A brownfield survey's mapped root listed 32
  // descendants (a facade "uses" every module it calls), and two later plans could not
  // reopen it at all: they built a bypass node and left the root's Contract knowingly
  // wrong — the drift this method exists to stop. The tree edge already orders the pair, and
  // revise finds consumers by grep as well as by blocked_by, so the entry carries nothing.
  const ancestorsOf = t => {
    const out = new Set()
    for (let p = P.parentOf(t); p !== '' && !out.has(p); p = P.parentOf(p)) out.add(p)
    return out
  }
  const downEdge = new Set()
  for (const t of ids) {
    const down = P.blockedIdsOf(P.taskPath(t)).filter(b => ancestorsOf(b).has(t))
    if (!down.length) continue
    for (const b of down) downEdge.add(`${t}>${b}`)
    const what = down.length === 1 ? `its own descendant ${down[0]}` : `${down.length} of its own descendants (${down.join(', ')})`
    prob(`${t} blocked_by lists ${what} — a child already waits for its parent, so the two wait on each other the moment both are open; drop ${down.length === 1 ? 'it' : 'them'} from ${t}'s blocked_by (the tree edge already orders them)`)
  }

  // --- wait cycle (Kahn): a node waits on its blocked_by AND its parent; leftovers = cycle ---
  // blocked_by alone missed a cycle that closes through the tree (a parent waiting on a
  // node that waits on one of its children); a descendant edge is named above, not twice.
  const resolved = new Set()
  for (;;) {
    let progress = false
    for (const t of ids) {
      if (resolved.has(t)) continue
      const waits = P.blockedIdsOf(P.taskPath(t)).filter(b => !downEdge.has(`${t}>${b}`))
      const p = P.parentOf(t)
      if (p !== '') waits.push(p)
      if (waits.every(b => resolved.has(b))) { resolved.add(t); progress = true }
    }
    if (!progress) break
  }
  // A leftover node either sits ON a cycle or only waits below one — with the parent edge
  // in, a cycle near the root would otherwise name its whole subtree as cyclic.
  const left = ids.filter(t => !resolved.has(t))
  const waitsLeft = t => {
    const w = P.blockedIdsOf(P.taskPath(t)).filter(b => !downEdge.has(`${t}>${b}`))
    const p = P.parentOf(t)
    if (p !== '') w.push(p)
    return w.filter(b => left.includes(b))
  }
  const onCycle = t => {
    const seen = new Set()
    const stack = waitsLeft(t)
    while (stack.length) {
      const u = stack.pop()
      if (u === t) return true
      if (!seen.has(u)) { seen.add(u); stack.push(...waitsLeft(u)) }
    }
    return false
  }
  const below = []
  for (const t of left) {
    if (onCycle(t)) prob(`${t} is in a blocked_by cycle (unresolvable)`)
    else below.push(t)
  }
  if (below.length) prob(`${below.join(', ')} can never start — ${below.length === 1 ? 'it waits' : 'they wait'} on a node above that can never finish (a cycle, or a missing node); repair that one`)

  // --- review-state files (the gates' evidence — format + identity) ---
  // A record IS evidence only for the node its filename names — a copied yaml whose
  // target points elsewhere would otherwise pass as another node's gate.
  const rel = p => p.startsWith(`${P.root}/`) ? p.slice(P.root.length + 1) : p
  for (const rf of P.reviewFiles()) {
    const text = P.read(rf) ?? ''
    const base = rf.slice(rf.lastIndexOf('/') + 1)
    const m = base.match(/^(TASK-[0-9]+)\.(verify|review)\.yaml$/)
    let expTarget = null; let expType = null
    if (base === 'tree.verify.yaml') { expTarget = rel(P.treePath); expType = 'tree' }
    else if (m) {
      expTarget = `${rel(P.tasksDir)}/${m[1]}.md`
      expType = m[2] === 'verify' ? 'spec' : 'result'
      if (P.read(P.taskPath(m[1])) === null) prob(`${rf}  no task file for ${m[1]} — an orphan record is evidence for nothing`)
    } else prob(`${rf}  unrecognized name — use TASK-N.verify.yaml · TASK-N.review.yaml · tree.verify.yaml`)
    for (const k of schList('review.fm.required')) {
      if (topValue(text, k) === '') prob(`${rf}  field '${k}' missing`)
    }
    let v = topValue(text, 'status')
    if (v !== '' && !schList('review.enum.status').includes(v)) prob(`${rf}  status '${v}' invalid → use ${P.sch('review.enum.status')}`)
    v = topValue(text, 'target_type')
    if (v !== '' && !schList('review.enum.target_type').includes(v)) prob(`${rf}  target_type '${v}' invalid → use ${P.sch('review.enum.target_type')}`)
    else if (v !== '' && expType !== null && v !== expType) prob(`${rf}  target_type '${v}' ≠ '${expType}' (what this filename is)`)
    const targetType = v
    v = topValue(text, 'target')
    if (v !== '' && expTarget !== null && v !== expTarget) prob(`${rf}  target '${v}' ≠ '${expTarget}' (what this filename names)`)
    v = topValue(text, 'level')
    if (v !== '' && !schList('review.enum.level').includes(v)) prob(`${rf}  level '${v}' invalid → use ${P.sch('review.enum.level')}`)
    for (const [k, lo] of [['find_streak', 1], ['plan_streak', 1], ['no_new_streak', 0], ['plan_clear_streak', 0], ['max_rounds', 1], ['round', 0], ['strength', 1], ['repeat', 0], ['consecutive_passes', 0]]) {
      v = topValue(text, k)
      if (v === '') continue
      if (!/^[0-9]+$/.test(v) || Number(v) < lo || (k === 'strength' && Number(v) > 3)) {
        prob(`${rf}  ${k} '${v}' out of range (${k === 'strength' ? '1–3' : `≥ ${lo}`})`)
      }
    }
    // A cycle may carry its own find_streak (overridable per node), but a LOWER one ends
    // find sooner than the project chose — and one was put to a person as "(recommended)".
    // Named while the cycle runs, never blocking: the person may have chosen it.
    if (topValue(text, 'status') === 'in-progress') {
      const block = targetType === 'result' ? 'review' : 'verify'
      const cfgN = cfgValue(P.configText, block, 'find_streak')
      const recN = topValue(text, 'find_streak')
      if (/^[0-9]+$/.test(cfgN) && /^[0-9]+$/.test(recN) && Number(recN) < Number(cfgN)) {
        streakNotices.push(`${rf}  find_streak ${recN} is below this project's ${block}.find_streak ${cfgN} — a lowered streak ends find sooner; keep it only if the person chose it`)
      }
    }
    v = topValue(text, 'item_phase')
    if (v !== '' && !schList('review.enum.item_phase').includes(v)) prob(`${rf}  item_phase '${v}' invalid → use ${P.sch('review.enum.item_phase')}`)
    // Migration marker: `find_streak` is what says a record runs under the 0.13 cycle
    // (streak-terminated find + per-item fix). An IN-PROGRESS record without it would be
    // driven by rules nothing reads anymore — name it once, here, instead of letting the
    // cycle run under whichever rulebook the session happens to remember. Decided records
    // (passed/escalated) are history and stay readable as written.
    if (topValue(text, 'status') === 'in-progress' && !hasTop(text, 'find_streak')) {
      prob(`${rf}  in-progress record has no find_streak — a pre-0.13 cycle: add find_streak/plan_streak (template review-state.yaml), reclassify its open findings by category, and re-enter find at no_new_streak 0 — the streak is earned under the new rules, never transplanted from the old cycle's closure; the reclassified list rides along as the found list (README Status, migration)`)
    }
    if (topValue(text, 'status') === 'passed' && listItemCount(text, 'open_issues') > 0) {
      prob(`${rf}  status: passed but open_issues is not empty`)
    }
    // `escalated` has two definitions, both a human's to rule: find spent its max_rounds
    // waves without closing, or the current item failed its confirmation twice in a row
    // (v0.23.0). A record wearing it otherwise contradicts itself, and the cost is a false
    // stop: `next` refuses to take the gate and the auto loop ends, while the real next
    // step (fix the open issues) was available all along. Measured — a review wrote
    // `escalated` at round 3 of 15 because judge had confirmed defects, which is the
    // ordinary `reviewed` + `open_issues` → `grovespec-fix` path.
    if (topValue(text, 'status') === 'escalated') {
      const w = findWaves(text); const mx = Number(topValue(text, 'max_rounds'))
      // `w < mx`, not `<=`: spending the budget exactly is the legitimate escalation.
      if (Number.isFinite(w) && Number.isFinite(mx) && mx > 0 && w < mx && !itemStuck(text)) {
        const oldCount = Number(topValue(text, 'round')) >= mx
          ? ` (it escalated under the old count, which spent the budget on fix passes too — set status back to ${targetType === 'result' ? 'in-progress and carry on with the review' : 'in-progress and carry on'})`
          : ''
        prob(`${rf}  status: escalated after ${w} find wave(s) of max_rounds ${mx}, and no item failed its confirmation twice in a row — escalation means find spent its budget or one fix does not converge${oldCount}. Confirmed defects are '${targetType === 'result' ? 'reviewed' : 'in-progress'}' + open_issues (→ ${targetType === 'result' ? 'grovespec-fix' : 'the fix phase of this cycle'}); raise max_rounds only by naming what the next find wave would learn`)
      }
    }
    v = topValue(text, 'approved_by')
    if (v !== '' && !schList('review.enum.approved_by').includes(v)) prob(`${rf}  approved_by '${v}' invalid → use ${P.sch('review.enum.approved_by')}`)

    // A source-evidence seal is optional only as a PAIR for legacy compatibility.
    // Once present, validate continuously re-opens the exact find round pin named and
    // proves that packet against today's Task, ref bytes and ref/index.md roster.
    const sourceSeal = topValue(text, 'source_evidence_digest')
    const sourceRound = topValue(text, 'source_evidence_round')
    const hasSourceSeal = hasTop(text, 'source_evidence_digest')
    const hasSourceRound = hasTop(text, 'source_evidence_round')
    if (hasSourceSeal || hasSourceRound) {
      if (!hasSourceSeal || !hasSourceRound || sourceSeal === '' || sourceRound === '') {
        prob(`${rf}  source evidence seal is partial — source_evidence_digest and source_evidence_round must appear together with non-empty values`)
      } else if (expType !== 'spec' || !m) {
        prob(`${rf}  source evidence fields belong only to TASK-N.verify.yaml spec records`)
      } else if (!/^[0-9a-f]{64}$/.test(sourceSeal)) {
        prob(`${rf}  source_evidence_digest '${sourceSeal}' is not a canonical sha256`)
      } else if (!/^[1-9][0-9]*$/.test(sourceRound) || !Number.isSafeInteger(Number(sourceRound))) {
        prob(`${rf}  source_evidence_round '${sourceRound}' is not a positive safe integer`)
      } else {
        try {
          const n = Number(sourceRound)
          assertFindRound(m[1], text, n)
          const briefPath = P.verifyRoundBriefPath(m[1], n)
          const brief = P.read(briefPath)
          if (brief === null) throw new SourceEvidenceError(`${briefPath} missing`)
          const packet = parseSourcePacket(brief, briefPath)
          const current = validateCompletedPacket(P, m[1], packet, text)
          if (current !== sourceSeal) prob(`${rf}  completed source-evidence packet changed after pin — digest mismatch; re-run the spec gate`)
        } catch (e) {
          if (!(e instanceof SourceEvidenceError)) throw e
          prob(`${rf}  source evidence no longer validates: ${e.message}`)
        }
      }
    }

    const scopeSeal = topValue(text, 'source_scope_digest')
    if (hasTop(text, 'source_scope_digest')) {
      if (expType !== 'tree') {
        prob(`${rf}  source_scope_digest belongs only to tree.verify.yaml`)
      } else if (!/^[0-9a-f]{64}$/.test(scopeSeal)) {
        prob(`${rf}  source_scope_digest '${scopeSeal}' is not a canonical sha256`)
      } else {
        try {
          if (scopeSeal !== sourceScopeDigest(P)) {
            prob(`${rf}  Task ref assignments changed after the tree pin — source_scope_digest mismatch; re-run the tree gate`)
          }
        } catch (e) {
          if (!(e instanceof SourceEvidenceError)) throw e
          prob(`${rf}  source scope no longer validates: ${e.message}`)
        }
      }
    }

    const structureSeal = topValue(text, 'tree_digest')
    if (hasTop(text, 'tree_digest')) {
      if (expType !== 'tree') {
        prob(`${rf}  tree_digest belongs only to tree.verify.yaml`)
      } else if (!/^[0-9a-f]{64}$/.test(structureSeal)) {
        prob(`${rf}  tree_digest '${structureSeal}' is not a canonical sha256`)
      } else if (structureSeal !== treeDigest(P.treeText())) {
        prob(`${rf}  tree structure changed after its pin — tree_digest mismatch; run grovespec reopen tree decomposition and re-run the tree gate`)
      }
    }

    // The tree verdict is taken over a mode-specific input projection, not merely
    // tree.md.  Keep checking it while the sealed verdict awaits its human decision;
    // after approval it is historical evidence, because fidelity's code/backlogs and
    // decomposition's brief legitimately evolve during later node cycles.
    const evidenceMode = topValue(text, 'tree_evidence_mode')
    const evidenceSeal = topValue(text, 'tree_evidence_digest')
    const hasEvidenceMode = hasTop(text, 'tree_evidence_mode')
    const hasEvidenceSeal = hasTop(text, 'tree_evidence_digest')
    if (expType === 'tree' && topValue(text, 'approved_by') === 'pending' &&
        (hasTop(text, 'tree_digest') || hasTop(text, 'source_scope_digest')) &&
        !hasEvidenceMode && !hasEvidenceSeal) {
      prob(`${rf}  pending legacy tree seal has no tree evidence for the reviewed brief/Tasks/code — restart the tree gate`)
    }
    if (hasEvidenceMode || hasEvidenceSeal) {
      const unsealedCycleMarker = expType === 'tree' && hasEvidenceMode && !hasEvidenceSeal &&
        !hasTop(text, 'tree_digest') && !hasTop(text, 'source_scope_digest')
      if (unsealedCycleMarker) {
        if (!TREE_EVIDENCE_MODES.includes(evidenceMode)) {
          prob(`${rf}  tree_evidence_mode '${evidenceMode}' invalid → use ${TREE_EVIDENCE_MODES.join('|')}`)
        }
      } else if (!hasEvidenceMode || !hasEvidenceSeal || evidenceMode === '' || evidenceSeal === '') {
        prob(`${rf}  tree evidence seal is partial — tree_evidence_mode and tree_evidence_digest must appear together with non-empty values`)
      } else if (expType !== 'tree') {
        prob(`${rf}  tree evidence fields belong only to tree.verify.yaml`)
      } else if (!TREE_EVIDENCE_MODES.includes(evidenceMode)) {
        prob(`${rf}  tree_evidence_mode '${evidenceMode}' invalid → use ${TREE_EVIDENCE_MODES.join('|')}`)
      } else if (!/^[0-9a-f]{64}$/.test(evidenceSeal)) {
        prob(`${rf}  tree_evidence_digest '${evidenceSeal}' is not a canonical sha256`)
      } else if (topValue(text, 'approved_by') === 'pending') {
        try {
          if (evidenceSeal !== treeEvidenceDigest(P, evidenceMode)) {
            prob(`${rf}  a reviewed tree input changed after pin — tree_evidence_digest mismatch; re-run the tree gate`)
          }
        } catch (e) {
          if (!(e instanceof TreeEvidenceError)) throw e
          prob(`${rf}  reviewed tree evidence no longer validates: ${e.message}`)
        }
      }
    }

    const taskSeal = topValue(text, 'task_evidence_digest')
    const hasTaskSeal = hasTop(text, 'task_evidence_digest')
    if (hasTaskSeal) {
      if (expType !== 'spec' && expType !== 'result') {
        prob(`${rf}  task_evidence_digest belongs only to TASK-N.verify.yaml or TASK-N.review.yaml`)
      } else if (!/^[0-9a-f]{64}$/.test(taskSeal)) {
        prob(`${rf}  task_evidence_digest '${taskSeal}' is not a canonical sha256`)
      } else if (!hasTop(text, 'spec_digest') || (expType === 'result' && !hasTop(text, 'reviewed_commit'))) {
        prob(`${rf}  task_evidence_digest is part of a complete Task seal — its spec_digest${expType === 'result' ? ' and reviewed_commit' : ''} must be present too`)
      // This is a TOCTOU seal for the decision window, not a permanent metadata
      // freeze. After a spec decision, implement may confirm a different role. After
      // a result decision, a later tree-only merge may legitimately rewrite another
      // done node's blocked_by without re-reviewing its unchanged product bytes.
      } else if (m && topValue(text, 'approved_by') === 'pending') {
        const taskText = P.read(P.taskPath(m[1]))
        if (taskText !== null && taskEvidenceDigest(taskText) !== taskSeal) {
          prob(`${rf}  Task evidence changed after pin — task_evidence_digest mismatch; re-run the ${expType} gate`)
        }
      }
    }

    // --- the category lanes, enforced ---
    // Every confirmed finding states its category, and the lane follows it mechanically:
    // a must-fix category blocks (open_issues), a record category never does (followups).
    // This replaced the severity ladder + gate arithmetic (2026-09-21 user decision):
    // "how serious does this look?" was re-answered every round and drifted — a test gap
    // rode a mechanism ruling into mandatory fixes for rounds; "which of these seven is
    // it?" is a definition, and there is no per-finding grade left to argue past.
    const cats = schList('finding.enum.category')
    const kinds = schList('finding.enum.kind')
    // An empty quoted string is an empty field — `requirement: ""` must not satisfy "cite it".
    const field = (it, k) => itemValue(it, k).replace(/^(['"])(.*)\1$/, '$2').trim()
    const seenFamilies = new Map()
    // Decided records (passed · escalated) were written under their own cycle's rules —
    // the same grandfather that keeps historical tree records readable. An in-progress
    // record must speak the current rules: its open items get worked next session.
    const undecided = topValue(text, 'status') === 'in-progress'
    const validateFindingList = key => {
      const items = listItems(text, key)
      items.forEach((it, i) => {
        const tag = `${key}[${i + 1}]${field(it, 'id') === '' ? '' : ` (${field(it, 'id')})`}`
        const at = `${rf}  ${tag}`
        const kind = field(it, 'kind')
        const family = field(it, 'family')
        const cat = field(it, 'category')
        if (kind !== '' && !kinds.includes(kind)) prob(`${at}  kind '${kind}' invalid → use ${P.sch('finding.enum.kind')}`)
        if (family !== '') {
          const seen = seenFamilies.get(family)
          if (seen) prob(`${at}  family '${family}' duplicates ${seen} — the same hole re-shown through a new path is one finding; merge it`)
          else seenFamilies.set(family, tag)
        }
        if (kind === 'concern' && key === 'open_issues') {
          prob(`${at}  kind 'concern' cannot block a gate → move it to followups`)
        } else if (kind === 'contract-gap' && key === 'open_issues' && targetType === 'result') {
          prob(`${at}  result reviews may block only on kind 'defect' → move this spec/contract issue to followups (or reopen via revise/verify)`)
        } else if (kind === 'defect' && key === 'followups' && !RECORD_CATEGORIES.includes(cat)) {
          // kind owns the LOCATION of the flaw; category decides the HANDLING. A defect
          // in a record category (a real but harmless slip in current code — a label
          // typo) is recorded here like any record item; a must-fix defect never parks.
          prob(`${at}  a defect parks in followups only in a record category (improvement · harmless-bug) → a must-fix defect belongs in open_issues, a settled one in adjudications`)
        }
        // Era split. A legacy-shaped finding (pre-0.13 grade fields, no category) stays
        // readable on a decided record; on an in-progress one it must be reclassified —
        // never bulk-translated (an old should-fix is not automatically must-fix).
        const legacy = LEGACY_GRADE_FIELDS.some(k => field(it, k) !== '')
        if (cat === '' && legacy) {
          if (undecided) prob(`${at}  pre-0.13 grade fields on an in-progress record — reclassify it by category (reviewers.md §Categories): a current must-fix stays here with category + condition + impact; the rest moves to followups (improvement · harmless-bug) or adjudications`)
          return
        }
        for (const k of schList('finding.fm.required')) {
          if (field(it, k) === '') prob(`${at}  field '${k}' missing or empty — a finding that states no category, condition, or impact cannot be classified`)
        }
        if (cat !== '' && !cats.includes(cat)) prob(`${at}  category '${cat}' invalid → use ${P.sch('finding.enum.category')}`)
        if (cat !== '' && legacy) prob(`${at}  carries both category and pre-0.13 grade fields — one classification per finding; drop the legacy fields`)
        if (key === 'open_issues' && RECORD_CATEGORIES.includes(cat)) {
          prob(`${at}  category '${cat}' is record-only — it never blocks a gate; move it to followups`)
        }
        if (key === 'followups' && MUST_FIX_CATEGORIES.includes(cat) && kind !== 'contract-gap') {
          prob(`${at}  a must-fix category parks in followups only as kind 'contract-gap' (a real problem routed to revise/verify) — otherwise it belongs in open_issues`)
        }
        if (kind === 'concern' && cat !== '' && !RECORD_CATEGORIES.includes(cat)) {
          prob(`${at}  kind 'concern' takes a record category (improvement · harmless-bug) — concerns are notes, never blockers`)
        }
        if (cat === 'requirement-unmet' && field(it, 'requirement') === '') {
          prob(`${at}  category requirement-unmet needs 'requirement' — name the user requirement / ref clause / Contract·AC line it fails; a duty no requirement states is an improvement, not a defect`)
        }
      })
    }
    validateFindingList('open_issues')
    validateFindingList('followups')

    // --- the 0.13 close conditions, as invariants (shared with approve — core.mjs) ---
    for (const m of completionProblems(text)) prob(`${rf}  ${m}`)
    // A fix loop's position must be real: an in-progress current_item that names no
    // open_issues entry is a resume pointer into nothing — the next session would
    // "continue" an item that does not exist.
    if (topValue(text, 'status') === 'in-progress' && hasTop(text, 'find_streak')) {
      const cur = topValue(text, 'current_item').replace(/^(['"])(.*)\1$/, '$2').trim()
      if (cur !== '' && !listItems(text, 'open_issues').some(it => field(it, 'id') === cur)) {
        prob(`${rf}  current_item '${cur}' names no open_issues entry — the fix loop's resume pointer must be a real item`)
      }
    }

    // Two silent gaps, one sweep (core.mjs strictYamlProblems): bytes grovespec reads
    // fine that strict YAML refuses (a malformed quoted value breaks only the OUTSIDE
    // consumer), and bytes grovespec silently LOSES whatever YAML thinks (a list item
    // fallen to column 0 ends the list for every reader here — the items below vanish
    // from every per-item check, so a settled adjudication can re-fire; a block
    // scalar's body is depth the readers skip). A notice, never a problem: decided
    // cycles' records are already written under these shapes, so blocking would fail
    // history no one is going to rewrite — the line reprints every run until the spot
    // is repaired (the same shape the untracked-gate notice uses).
    for (const q of strictYamlProblems(text)) yamlNotices.push(`${rf}:${q.line}  ${q.msg}`)

    // Flow style turns every per-item rule OFF rather than failing it — measured: a
    // `followups: [ { severity: critical, kind: concern } ]` passed the grade checks and
    // did not appear in `grovespec followups` at all. Found parked in one round, found
    // again in the next; a hole that reopens is a class, not a case, so it is named here
    // for every list in the record rather than per reader.
    for (const k of flowListKeys(text, ['strategies', 'checks', 'found', 'rounds', 'open_issues', 'followups', 'adjudications'])) {
      prob(`${rf}  '${k}' is a flow-style list ([...]) — these records are read line by line, so every per-item check skips it silently; write one '- ' item per line (an empty list stays '[]')`)
    }

    // --- rounds: the countable result, not the narrative ---
    // Left unbounded, `note` became where the story actually lived — block scalars of
    // 20-40 lines per round, 394 lines of them in one node (timelog-3 TASK-2.review.yaml),
    // carried by every later cold round that reads this file. The reasoning has a home
    // (<id>.round<N>.brief.md · .plan.md · .confirm.md — the result gate's own files as
    // <id>.review.round<N>.*, so a review round never overwrites the brief a spec seal
    // pinned); the note points at it in one line.
    // A round entry is FLAT: every line is one of the schema's fields, on one line, at the
    // entry's own indent. Checking only `note: >-` left the rule open to the same prose in
    // three other spellings — a plain multi-line scalar (`note:` then indented paragraphs),
    // a key the old `[a-z_]+` scan never saw (`Note:` · `note2:` · `"remarks":`), and a
    // nested mapping. Reading DEPTH instead of one field's marker closes all of them, and
    // it also stops the mirror error: a block-style `found:` was reported as three unknown
    // fields ('critical' · 'should_fix' · 'nice') — names the schema does list, under a
    // message that sent the reader to a list they were already following.
    const roundKeys = new Set([...schList('round.fm.required'), ...schList('round.fm.optional')])
    const home = base.replace(/\.verify\.yaml$/, '').replace(/\.yaml$/, '')
    listItems(text, 'rounds').forEach((it, i) => {
      const at = `${rf}  rounds[${i + 1}]`
      for (const k of schList('round.fm.required')) {
        if (itemValue(it, k) === '') prob(`${at}  field '${k}' missing`)
      }
      // One rule, one message. A separate block-scalar check said the same prescription
      // twice, and its early-return then MASKED any other depth violation in the entry —
      // an entry with both a block scalar and an indented `found` reported one of them
      // per pass, so migrating a long record took a validate→fix lap per round.
      // Comments are skipped the way every other list here skips them (listItemCount) —
      // a `# wave 2 — boundary walk` line above a field is ordinary YAML, and the shipped
      // template comments its own rounds entry.
      const lines = splitLines(it).filter(l => l.trim() !== '' && !/^[ \t]*#/.test(l))
      // The item's field column, measured — NOT `indexOf('- ') + 2`. A dash followed by a
      // TAB made that -1 and the whole check returned, reopening every spelling this rule
      // exists to refuse; a dash followed by TWO spaces shifted it one left and refused a
      // perfectly flat entry. Find the dash, then the first non-space after it.
      const dash = lines[0].search(/\S/)
      if (dash === -1 || lines[0][dash] !== '-') return     // not an item shape; listItems guarantees it, so this is belt
      const after = lines[0].slice(dash + 1).search(/\S/)
      // `- ` with the fields starting on the NEXT line is ordinary YAML, and listItems
      // reads it as an item — so the column comes from that next line. Returning here
      // instead switched the entry's whole check off, which is the same failure this
      // rule was written to close, one spelling further along: a 40-line block scalar
      // under a lone dash validated clean while the parent commit refused it.
      const indent = after === -1
        ? (lines.length > 1 ? lines[1].search(/\S/) : -1)
        : dash + 1 + after
      if (indent === -1) return                            // a dash and nothing else at all
      const KEY = /^(["']?)([A-Za-z0-9_-]+)\1[ \t]*:/
      let saidDeep = false                                 // one entry, one telling of it
      const dashOnly = after === -1                       // `- ` alone: that line carries no field
      lines.forEach((l, j) => {
        if (j === 0 && dashOnly) return
        const at2 = `${at}${j === 0 ? '' : ` line ${j + 1}`}`
        const col = j === 0 ? indent : l.search(/\S/)
        const body = l.slice(col)
        if (col !== indent) {
          if (saidDeep) return                             // one entry, one telling of it
          saidDeep = true
          prob(`${at2}  is indented past the entry's fields — an entry is a block item ('- n: 1', one field per line); a field's VALUE may be a one-line flow map ('found: { must_fix: 0, recorded: 0 }'), but nothing here spans lines: put a pass's reasoning in ${home}.round<n>.brief.md (plan/confirm: .plan.md · .confirm.md) and leave a one-line 'note' pointing at it`)
          return
        }
        const m = body.match(KEY)
        if (!m) { prob(`${at2}  is not a field line — a round entry is flat one-line fields (${P.sch('round.fm.required')} + optional ${P.sch('round.fm.optional')})`); return }
        // An EMPTY allow-list would reject every field — the schema preflight already named
        // that breakage, and a guard must not turn its own missing input into 500 findings.
        if (roundKeys.size && !roundKeys.has(m[2])) {
          prob(`${at2}  unknown field '${m[2]}' — a round entry is ${P.sch('round.fm.required')} (+ optional ${P.sch('round.fm.optional')})`)
        }
      })
    })
  }

  // --- status ↔ evidence: an advanced status must show the gate that let it advance ---
  // (origin: mapped nodes with no review files are exempt — brownfield init maps existing
  //  code straight to done; the rules apply from the first gate a reopened node enters.
  //  approved_by: pending on an advanced node = an interrupted approve or a hand flip —
  //  named here so it can't linger; legacy records (no field) keep their old meaning.)
  for (const t of ids) {
    const rank = P.rankOf(t)
    if (rank < 2 || P.mappedExempt(t)) continue
    const vp = P.verifyYamlPath(t)
    const vst = P.reviewStatus(vp)
    if (vst !== 'passed') prob(`${t} is ${P.statusOf(t)} but its spec verify is not passed (${vp}${vst === '' ? ' missing' : `: ${vst}`})`)
    else if (P.approvedBy(vp) === 'pending') prob(`${t} is ${P.statusOf(t)} but its spec approval is still pending — finish it (grovespec approve ${t} [--human]) or re-run the gate`)
    if (rank === 6) {
      const rp = P.reviewYamlPath(t)
      const rst = P.reviewStatus(rp)
      if (rst !== 'passed') prob(`${t} is done but its code review is not passed (${rp}${rst === '' ? ' missing' : `: ${rst}`})`)
      else if (P.approvedBy(rp) === 'pending') prob(`${t} is done but its result approval is still pending — finish it (grovespec approve ${t} [--human]) or re-run the gate`)
      else if (P.approvedBy(rp) === 'machine') {
        const lt = lastTest(P.read(rp) ?? '')
        if (lt === null || lt.exit !== '0' || !lt.commit) {
          prob(`${t} was machine-approved done without bound green test evidence (last_test exit 0 + commit) — a machine may only take a gate on machine evidence`)
        }
      }
    }
  }
  {
    const tab = P.approvedBy(P.treeYamlPath())
    if (tab === 'machine') prob(`${P.treeYamlPath()}  approved_by: machine — the tree gate is never machine-taken`)
  }

  // --- pins: the gated bytes must still be the bytes ---
  // (a record without a digest is legacy-unbound — shown nothing, binds nothing;
  //  pins written before the digest era are not violations, just not warranties.)
  // Three git answers: a genuine non-repo skips these checks legitimately; a git that
  // DID NOT ANSWER must not wear that skip — every history-bound check below would go
  // unread under a clean tick (a missing git binary read as "not a repo", measured).
  const rState = repoState(P.root)
  if (rState === 'broken') prob(`git did not answer (${gitFailure()}) — every history-bound check (pins · reviewed commits · tdd evidence · ignored-subtree) is unread; an unread check is not a passed one`)
  const repo = rState === 'repo'
  // A project inside an IGNORED subtree of a bigger repo answers `inRepo` yes while no
  // commit of its code can exist there — every result gate would bind to a foreign HEAD
  // that this code cannot move. Named here rather than at the gate so it surfaces before
  // a tree's worth of nodes is built on it. (Nesting in a TRACKED subdirectory is fine.)
  if (repo) {
    const ig = ignoredState(P.root)
    if (ig === 'broken') prob('git check-ignore did not answer — whether this project is gateable is unread; an unread check is not a passed one')
    else if (ig === 'yes') prob('this project sits inside a git repository that ignores it — no TASK- commit of this code can exist there, so result gates would bind to an unrelated history. Give the project its own repository (git init)')
  }
  // --- a PASSED gate's evidence, still outside git ---
  // A record git never tracked is evidence only until someone cleans the tree: the gate
  // passed, and WHAT it passed on is then unrecoverable. Measured — two records carried
  // their nodes through a gate and stayed untracked for the rest of the run (timelog-3:
  // TASK-7.review.yaml · TASK-8.verify.yaml, both still untracked at run's end).
  //
  // A NOTICE, not a problem — and that is the whole design of it. A record is born
  // untracked and every gate passes before anything stages it, so a check that FAILS here
  // fails at the exact moment each gate first succeeds: measured on all three gates, and
  // `grovespec next` stops on a non-zero validate, so the driver halted right after a
  // clean pass. (The skills now tell every step to commit what it wrote, gate records
  // included — but the birth moment is still untracked, so the reasoning stands.) The
  // real defect it was built
  // for — a record still outside git rounds later — is caught just as well by a line that
  // reprints on every run (the same shape the unratified-gate notice uses, which is what
  // surfaced 9 unratified nodes in review). So: never blocking, and no status-rank guard
  // either — that guard emptied the very window this exists for, the `passed` spec record
  // of a node still `draft` while a human takes days to look.
  if (repo) {
    const tracked = trackedPaths(P.root)
    const gpfx = showPrefix(P.root)
    if (tracked === null || gpfx === null) {
      prob('git ls-files / rev-parse did not answer — whether the gate records are tracked is unread; an unread check is not a passed one')
    } else {
      const claim = (p, whose) => {
        if (P.read(p) === null) return                      // absent is the other checks' business
        if (P.reviewStatus(p) !== 'passed') return           // no verdict yet — nothing to preserve
        if (!tracked.has(`${gpfx}${p.slice(P.root.length + 1)}`)) untrackedGates.push(`${rel(p)} (${whose})`)
      }
      for (const t of ids) {
        if (P.mappedExempt(t)) continue
        claim(P.verifyYamlPath(t), `${t} spec`)
        claim(P.reviewYamlPath(t), `${t} result`)
      }
      claim(P.treeYamlPath(), 'tree')
    }
  }
  // --- GroveSpec's own files that git ignores ---
  // A project's .gitignore was written for its stack, not for GroveSpec: .NET's `bin/`
  // swallowed .grovespec/bin (one project from install on, another for three months)
  // and a blanket `*.log` swallowed every review test log — validate passed throughout,
  // because it reads the files on disk. A clone or another worktree then opens with no
  // runtime, and a gate's test evidence never reaches history. The bundle's
  // .grovespec/.gitignore now re-includes those two; this names whatever else a project
  // rule catches. Run-time scratch (run.lock, a crashed write's .tmp-<pid>) is meant to
  // stay out. A NOTICE, like the untracked-record one above: the fix is the project's
  // .gitignore, and halting `next` would not write it. Asked only when the project itself
  // is visibly not ignored — the whole-project case and an unanswering git are named above.
  if (repo && ignoredState(P.root) === 'no') {
    const relp = p => p.startsWith(`${P.root}/`) ? p.slice(P.root.length + 1).replace(/\/+$/, '') : null
    const own = ['.grovespec', ...[P.tasksDir, P.treePath, P.briefPath, P.convPath, P.refDir, P.findingsPath, P.restructuringPath, P.reviewDir]
      .map(relp).filter(p => p !== null && p !== '')]
    for (const tree of ['.claude', '.agents']) if (existsSync(`${P.root}/${tree}/skills`)) own.push(`${tree}/skills/grovespec-*`)
    const ig = ignoredUnder(P.root, [...new Set(own)])
    if (ig === null) prob('git ls-files --ignored did not answer — whether git ignores GroveSpec files is unread; an unread check is not a passed one')
    else ignoredOwn.push(...ig.filter(f => f !== '.grovespec/run.lock' && !/\.tmp-[0-9]+$/.test(f)))
  }

  // --- the next spec gate's own refusal, said before it runs ---
  // A tree gate sealed with source_scope_digest re-proves every Task's ref assignment
  // above (a refusal there is a problem). Without that seal nothing reads the
  // assignments until `grovespec source` runs inside the next spec verify — a project
  // migrated an older install, validate passed, and that verify then refused for a
  // missing `refs` (40 nodes assigned by hand). Each sketch/draft node is asked now, the
  // same way.
  if (!hasTop(P.read(P.treeYamlPath()) ?? '', 'source_scope_digest')) {
    for (const t of new Set(ids)) {
      const st = P.statusOf(t)
      if (st !== 'sketch' && st !== 'draft') continue
      try { taskRefAssignment(P, t, { requireCurrent: true }) } catch (e) {
        if (!(e instanceof SourceEvidenceError)) throw e
        refNotices.push(`${t} (${st}): ${e.message.replace(`${t}: `, '')}`)
      }
    }
  }
  // Catalog rows whose Location reads as prose are skipped by every reader, so no Task can
  // cite them — and nothing said so: one project's whole regulation was indexed that way
  // ("Part 2 Article 8 (L636~L758)") while validate stayed green (v0.23.0).
  let skippedRows = null
  try { skippedRows = skippedIndexRows(P) } catch (e) {
    if (!(e instanceof SourceEvidenceError)) throw e
    skippedRows = { broken: e.message }
  }

  for (const t of ids) {
    const tt = P.read(P.taskPath(t))
    if (tt === null) continue
    const cur = specDigest(tt)
    const vd = topValue(P.read(P.verifyYamlPath(t)) ?? '', 'spec_digest')
    const rd = topValue(P.read(P.reviewYamlPath(t)) ?? '', 'spec_digest')
    if (cur !== null) {
      if (vd !== '' && vd !== cur) prob(`${t} spec changed after its verify pin — digest mismatch (reopen via grovespec-revise, re-verify)`)
      else if (rd !== '' && rd !== cur) prob(`${t} spec changed after its review pin — digest mismatch (reopen via grovespec-revise)`)
    }
    const rc = topValue(P.read(P.reviewYamlPath(t)) ?? '', 'reviewed_commit')
    if (rc !== '' && repo) {
      // A seal names immutable bytes ('HEAD'/branch/short-sha resolve today and move
      // tomorrow — a HEAD seal hid the whole live cycle behind an empty window), and
      // must be an ancestor of THIS history (a sibling-branch commit exists while
      // bounding nothing here). Canonical first, then ancestry; three answers each.
      let currentAncestor = false
      const oid = canonicalOidState(P.root, rc)
      if (oid === 'broken') prob(`${t} reviewed_commit ${rc.slice(0, 7)} cannot be resolved (unknown commit, or git failed) — an unread check is not a passed one`)
      else if (oid === 'no') prob(`${t} reviewed_commit '${rc}' is not a canonical full commit id — a seal names immutable bytes, never a moving name (re-run the gate so pin seals a real commit)`)
      else {
        const anc = ancestorState(P.root, rc)
        if (anc === 'broken') prob(`${t} reviewed_commit ${rc.slice(0, 7)} cannot be checked (git merge-base failed) — an unread check is not a passed one`)
        else if (anc === 'no') prob(`${t} reviewed_commit ${rc.slice(0, 7)} is not an ancestor of HEAD — a seal from another line of history binds nothing here (re-run the gate)`)
        else currentAncestor = true
      }

      // A pending result is a short hand-off window between cold review and the
      // decision.  Hold the whole project still there (except this gate's Task and
      // review evidence), because the reviewed diff may include package/build inputs
      // outside src/tests.  After approval the commit remains historical evidence;
      // later node work must not make every old record a permanent project freeze.
      // `reopen ... approved` deliberately keeps the prior reviewed_commit as the
      // next cycle's diff base while resetting the record to in-progress.  That is
      // not a pending decision seal: only the terminal pass + pin supplies the two
      // digests that make this wider input binding current again.
      if (P.reviewStatus(P.reviewYamlPath(t)) === 'passed' &&
          P.approvedBy(P.reviewYamlPath(t)) === 'pending' &&
          P.resultSealReady(t) && currentAncestor) {
        const breach = resultSealBreach(P, t, rc)
        if (breach !== null) prob(`${t} pending result seal no longer covers the reviewed project input — ${breach}`)
        const dirty = dirtyResultSubject(P, t)
        if (dirty === null) prob(`${t} pending result working-tree state is unreadable — an unread check is not a passed one`)
        else if (dirty.length) prob(`${t} pending result has uncommitted project changes outside its Task/review evidence — re-run the result gate`)
      }
    }
  }

  // --- tdd vs the cycle's commits: claimed TDD must show test files ---
  // touched() speaks repo-root-relative; a nested project's tests live behind the
  // prefix, so the bare compare read every nested cycle as "touched no tests".
  if (repo) {
    const sState = shallowState(P.root)
    if (sState !== 'full') {
      prob(sState === 'shallow'
        ? 'history is cut (shallow clone) — tdd evidence and pins are unread; unshallow it (git fetch --unshallow); an unread check is not a passed one'
        : 'git rev-parse --is-shallow-repository failed — history-bound checks are unread; an unread check is not a passed one')
    }
    const pfx = showPrefix(P.root)
    const relProj = (P.pathProblems.length === 0 && P.testsDir.startsWith(`${P.root}/`)) ? P.testsDir.slice(P.root.length + 1) : null
    const relTests = (relProj !== null && pfx !== null) ? `${pfx}${relProj}` : null
    if (relProj !== null && pfx === null) {
      prob('git rev-parse --show-prefix failed — tdd evidence is unread; an unread check is not a passed one')
    }
    const history = (relTests !== null && sState === 'full') ? log(P.root) : null
    if (relTests !== null && sState === 'full' && history === null) {
      prob('git log failed — tdd evidence is unread for every done node; an unread check is not a passed one')
    } else if (history !== null) {
      const byTask = new Map()
      for (const c of history) {
        const m = c.s.match(/^(TASK-[0-9]+): /)
        if (m) { if (!byTask.has(m[1])) byTask.set(m[1], []); byTask.get(m[1]).push(c.h) }
      }
      for (const t of ids) {
        if (P.statusOf(t) !== 'done' || P.fmOf(t, 'tdd') !== 'true') continue
        const hs = byTask.get(t)
        if (!hs) continue                                  // no commits at all (mapped / pre-runtime)
        const files = new Set()
        let unreadable = false
        for (const h of hs) {
          const tf = touched(P.root, h)
          if (tf === null) { unreadable = true; break }
          for (const f of tf) files.add(f)
        }
        if (unreadable) {
          prob(`${t} tdd evidence unreadable — git show failed on a cycle commit (git >= 2.31 required); an unread check is not a passed one`)
        } else if (![...files].some(f => f === relTests || f.startsWith(`${relTests}/`))) {
          prob(`${t} tdd: true but its cycle commits touch nothing under ${relTests}/ (claimed TDD, no tests)`)
        }
      }
    }
  }

  // --- brief / conventions ---
  const briefText = P.read(P.briefPath)
  if (briefText !== null) {
    for (const k of schList('brief.fm.required')) {
      if (P.fm(P.briefPath, k) === '') prob(`${P.briefPath}  frontmatter '${k}' missing`)
    }
    const want = schList('brief.sections').join('\n')
    if (want !== sectionsOf(briefText).join('\n')) prob(`${P.briefPath}  sections → need: ${P.sch('brief.sections')}`)
  } else if (ids.length) prob(`${P.briefPath}  missing`)
  // (no tree yet = the pre-plan state — a freshly initialized project has no brief
  // until the first planning pass writes one; that is not a defect.)
  const convText = P.read(P.convPath)
  if (convText !== null) {
    const want = schList('conventions.sections').join('\n')
    if (want !== sectionsOf(convText).join('\n')) prob(`${P.convPath}  sections → need: ${P.sch('conventions.sections')}`)
  }

  // --- the sideways-dependency ledger (waits.yaml) ---
  const waitNotices = []
  {
    const wsv = readWaits(P)
    for (const m of wsv.problems) prob(m)
    if (wsv.problems.length === 0 && wsv.present) {
      const liveW = wsv.entries.filter(e => e.resolved === '')
      const seen = new Set()
      for (const e of liveW) {
        // done + live wait is the exact state this ledger exists to make impossible:
        // "finished" over an open obligation is the unearned 100%.
        if (P.statusOf(e.from) === 'done') prob(`${e.from} is done but still waits on ${e.to} (declared ${e.declared}) — a node cannot finish holding a live wait: resume and resolve it, or the done is unearned (reopen)`)
        const k = `${e.from} → ${e.to}`
        if (seen.has(k)) prob(`${waitsPath(P)}  two live waits ${k} — one live wait per pair, or which need is open goes ambiguous (resolve one)`)
        seen.add(k)
        if (P.statusOf(e.to) === 'done' && P.statusOf(e.from) !== 'done') {
          waitNotices.push(`${e.from} → ${e.to}  declared ${e.declared} — ${e.need}`)
        }
      }
    }
  }

  // What this run actually looked at — so "I did not look" (a wrong path, an empty
  // tasks dir) can never read as "I looked and found nothing".
  say(`examined: tasks ${P.taskFiles().length} · tree nodes ${ids.length} · review files ${P.reviewFiles().length}`)
  // A notice, not a problem: an auto-taken gate is a legitimate state, but it is never
  // allowed to look like a human-taken one — so every run says how many are outstanding.
  const unratified = ids.filter(t => P.unratified(t).length)
  if (unratified.length) {
    say(`notice: ${unratified.length} node(s) taken by the machine on the cold verdict, not yet ratified — ${unratified.join(', ')} (grovespec ratify <id>…)`)
  }
  if (untrackedGates.length) {
    say(`notice: ${untrackedGates.length} passed gate record(s) not tracked by git — the verdict stands, but what it passed on is one clean-up away from gone: ${untrackedGates.join(', ')} (git add them with the gate's commit)`)
  }
  if (ignoredOwn.length) {
    // grouped by directory — a whole ignored bin/ reads as one entry, not twenty-six
    const groups = new Map()
    for (const f of ignoredOwn) {
      const d = f.slice(0, f.lastIndexOf('/') + 1)
      groups.set(d, [...(groups.get(d) ?? []), f])
    }
    const shown = [...groups].map(([d, fs]) => fs.length > 1 ? `${d} (${fs.length} files)` : fs[0])
    say(`notice: ${ignoredOwn.length} GroveSpec file(s) ignored by git — they never reach a commit, so a clone or another worktree runs without them: ${shown.join(', ')} (add '!' exceptions for them to the project's .gitignore, then commit them)`)
  }
  if (streakNotices.length) {
    say(`notice: ${streakNotices.length} running cycle(s) with a lower find_streak than the project's config:`)
    for (const m of streakNotices) say(`  ${m}`)
  }
  if (skippedRows?.broken) say(`notice: the ref catalog cannot be read — ${skippedRows.broken}; every spec verify that cites a ref refuses until it is repaired`)
  else if (skippedRows?.skipped.length) {
    const sk = skippedRows.skipped
    const shown = sk.slice(0, 3).map(r => `:${r.n} '${r.location}'`).join(', ')
    say(`notice: ${sk.length} row(s) of ${skippedRows.path.slice(P.root.length + 1)} have a Location that is not a coordinate, so no Task can cite them — write a numbered heading (4, 5.4) or a line range (L636-758) there; the Topic column carries the label: ${shown}${sk.length > 3 ? ` (+${sk.length - 3} more)` : ''}`)
  }
  if (refNotices.length) {
    say(`notice: ${refNotices.length} sketch/draft node(s) that the next spec verify will refuse as they stand — it reads each one's ref assignment through grovespec source; settle it before that gate (an older install's layout is the usual cause):`)
    for (const m of refNotices) say(`  ${m}`)
  }
  if (readNotices.length) {
    say(`notice: ${readNotices.length} sealed or done node(s) not yet in the reading rules — a person opening these meets a wall of text. Not blocking (the spec is sealed, or its gates are decided); tidy each the next time it opens at draft:`)
    for (const m of readNotices) say(`  ${m}`)
  }
  if (yamlNotices.length) {
    say(`notice: ${yamlNotices.length} spot(s) in gate records that strict YAML cannot read, or that grovespec's own line readers cannot see — an outside YAML consumer (a dashboard, js-yaml) fails or drops the block, and a broken list shape hides its items from every per-item check here, so a settled finding can re-fire. Each line says its own repair:`)
    for (const m of yamlNotices) say(`  ${m}`)
  }
  if (waitNotices.length) {
    say(`notice: ${waitNotices.length} live wait(s) whose target is already done — the value landed; the waiter resumes there (read the entry, use the value, grovespec wait resolve):`)
    for (const m of waitNotices) say(`  ${m}`)
  }
  if (markerNotices.length) {
    say(`notice: ${markerNotices.length} sideways deferral marker(s) on sealed nodes — the text is bound by a seal, so this does not block; nothing re-reads a sideways note, so convert each (a wait, or a revise) when its node next opens at draft:`)
    for (const m of markerNotices) say(`  ${m}`)
  }
  if (candNotices.length) {
    say(`notice: ${candNotices.length} candidate-lane state(s) worth a look — never blocking, each line names its repair:`)
    for (const m of candNotices) say(`  ${m}`)
  }
  // Routing-hook tripwire (v0.15.0) — the soft switch (config `hooks:`), the
  // registrations (.claude/settings.json · .codex/hooks.json) and the script must
  // tell one story. Drift here is environment, not project state, so it reprints as a notice.
  const hookNotes = []
  const hs = hooksState(P)
  for (const r of hs.registrations) {
    if (r.registered === null) hookNotes.push(`${r.file} exists but is not readable JSON — the hook registration state is unknowable (fix or remove the file, then grovespec hooks status)`)
    else if (hs.config === 'on' && !r.registered) hookNotes.push(`config says hooks: on but ${r.file} carries no registration — grovespec hooks install puts them back in step`)
  }
  const anyReg = hs.registrations.some(r => r.registered === true)
  if (anyReg && hs.config !== 'on') hookNotes.push(`the routing hook is registered but config says hooks: ${hs.config} — the hook stays silent; hooks install re-arms it, hooks remove clears the registration`)
  if (anyReg && !hs.script) hookNotes.push(`the routing hook is registered but ${HOOK_MARK} is missing — every edit prints a cannot-find-module warning until grovespec hooks remove clears it`)
  if (hookNotes.length) {
    say(`notice: ${hookNotes.length} routing-hook state drift — the switch, the registration and the script disagree (never blocks; each line names its repair):`)
    for (const m of hookNotes) say(`  ${m}`)
  }
  if (problems === 0) { say('✓ validate: all checks passed'); return 0 }
  say(`✗ validate: ${problems} problem(s)`)
  return 1
}

// ===================== status =====================
// One model, two renderings: the text below, and `status --json` (v0.23.0) — what a
// dashboard reads instead of importing this runtime's modules from a bundle pinned at a
// version path, which every release had to move. Both come from the one per-node
// classification here, so they cannot disagree.
function statusModel (P) {
  const gate = P.treeGatePending()
  // The sideways-dependency ledger colors the per-node lines: an asleep node is not
  // runnable and must not read as one. Unreadable ledger = say so and keep going —
  // status informs, validate owns the verdict.
  const ws = waitState(P)
  const nodes = P.treeIds().map(t => {
    const st = P.statusOf(t); const ub = P.unblocked(t)
    const asleep = ws.problems.length ? null : ws.asleepOn(t)
    const waits = P.humanWaits(t)
    let state; let next = null
    if (st === 'done') state = 'done'
    else if (gate) state = 'awaiting-tree-gate'
    else if (ub !== 'yes') state = 'blocked'
    else if (asleep !== null) state = 'asleep'
    else if (waits.some(w => w.kind === 'escalated')) state = 'waiting-on-human'
    // A sealed clean gate is a step, not a wait (v0.18.0): nothing in it is the
    // person's to decide, so the next driver turn takes it on the record.
    else if (waits.length) { state = 'approve'; next = 'approve' } else { state = 'runnable'; next = P.nextAction(t) }
    return {
      id: t,
      name: P.nameOf(t),
      status: st,
      role: P.roleOf(t),
      parent: P.parentOf(t) || null,
      state,
      next,
      blocked: ub === 'yes' ? null : ub.slice(3),
      asleepOn: asleep === null ? null : { to: asleep.to, declared: asleep.declared, need: asleep.need },
      escalations: waits.filter(w => w.kind === 'escalated').map(w => w.text),
      unratified: P.unratified(t),
      followups: P.followupCounts(t)
    }
  })
  const b = P.backlogCounts()
  return {
    gate,
    ws,
    nodes,
    treeEscalated: gate && P.reviewStatus(`${P.reviewDir}/tree.verify.yaml`) === 'escalated',
    backlog: b,
    // Every node done — parked work must not be invisible at the terminal line.
    planDue: !gate && nodes.length > 0 && nodes.every(n => n.status === 'done') && b.total > 0
  }
}

export function cmdStatus (P, json = false) {
  const m = statusModel(P)
  if (json) {
    const rc = recheckState(P)
    const retro = retroOwed(P)
    say(JSON.stringify({
      protocol: 'grovespec-status/v1',
      treeGate: m.gate ? { kind: P.treeGateKind(), awaitingHuman: P.treeAwaitingHuman(), escalated: m.treeEscalated } : null,
      nodes: m.nodes.map(n => ({ ...n, followups: Object.fromEntries(n.followups.map(f => { const [lane, count] = f.split(' '); return [lane, Number(count)] })) })),
      next: m.gate ? [] : m.nodes.filter(n => n.next !== null).map(n => n.id),
      waits: { problems: m.ws.problems, live: m.ws.live.map(e => ({ from: e.from, to: e.to, need: e.need, declared: e.declared })) },
      recheck: { broken: rc.broken, open: rc.open.map(e => ({ ...e, armed: P.statusOf(e.from) === 'done' })) },
      retro: { owed: retro.owed, n: retro.n, anchor: retro.anchor, adopted: retro.adopted ?? null, broken: retro.broken },
      backlog: m.backlog,
      planDue: m.planDue
    }, null, 2))
    return 0
  }
  if (m.gate) say(`! ${treeGateMsg(P)}`)
  for (const msg of m.ws.problems) say(`! ${msg}`)
  for (const n of m.nodes) {
    const t = n.id; const fu = n.followups
    if (n.state === 'done') {
      if (n.role === 'skeleton') say(`${pad(t, 8)} done        (children already sketched → work them; grow only to add beyond the spec${fu.length ? `; followups noted: ${fu.join(' · ')} via revise/verify` : ''})`)
      else if (fu.length) say(`${pad(t, 8)} done        (followups noted: ${fu.join(' · ')} via revise/verify)`)
      else say(`${pad(t, 8)} done`)
    } else if (n.state === 'awaiting-tree-gate') say(`${pad(t, 8)} ${pad(n.status, 12)} (awaiting the tree gate)`)
    else if (n.state === 'blocked') say(`${pad(t, 8)} ${pad(n.status, 12)} (${n.blocked})`)
    else if (n.state === 'asleep') say(`${pad(t, 8)} ${pad(n.status, 12)} (waiting on ${n.asleepOn.to} — declared ${n.asleepOn.declared})`)
    else if (n.state === 'waiting-on-human') say(`${pad(t, 8)} ${pad(n.status, 12)} (waiting on you — below)`)
    else if (n.state === 'approve') say(`${pad(t, 8)} ${pad(n.status, 12)} → approve (sealed clean gate, nothing to decide — grovespec approve ${t})`)
    else say(`${pad(t, 8)} ${pad(n.status, 12)} → ${n.next}`)
  }
  // Rulings parked on the human, split out — so "nothing ready" can never hide an
  // escalation that is actually waiting on the user.
  const waiting = []
  if (m.treeEscalated) {
    const kind = P.treeGateKind() === 'fidelity' ? 'survey fidelity' : 'decomposition'
    waiting.push(`${pad('tree', 8)} ${kind} verify escalated — needs a human ruling (${P.reviewDir}/tree.verify.yaml)`)
  }
  for (const n of m.nodes) for (const text of n.escalations) waiting.push(`${pad(n.id, 8)} ${text}`)
  if (waiting.length) {
    say('waiting on human:')
    for (const w of waiting) say(`  ${w}`)
  }
  // One line, not one per node: ~120 machine-taken gates across the audited projects
  // were ratified 0 times, and a block per node repeated on every status buried the rest
  // of the report. Nor "no human has looked" — a gate whose cycle carried the person's own
  // rulings was still printed that way; what the record knows is only that the person
  // has not ratified it.
  const unratified = m.nodes.filter(n => n.unratified.length)
  if (unratified.length) {
    say(`taken by the machine on the cold verdict, not yet ratified by you (${unratified.length}): ${unratified.map(n => `${n.id} ${n.unratified.join('·')}`).join(', ')} — grovespec ratify <id>… records your own look`)
  }
  // Live waits are open obligations — while one exists the build is not "all done",
  // whatever the per-node statuses say (the frozen node cannot reach done asleep).
  if (m.ws.problems.length === 0 && m.ws.live.length) {
    say('live waits (the turn follows the newest declaration):')
    for (const e of m.ws.live) {
      const landed = P.statusOf(e.to) === 'done' ? ' — target is done: resume and resolve' : ''
      say(`  ${e.from} → ${e.to}  declared ${e.declared} — ${e.need}${landed}`)
    }
  }
  if (m.gate) { say(`next: grovespec-verify the tree (the ${P.treeGateKind() === 'fidelity' ? 'survey fidelity' : 'decomposition'} gate)`); return 0 }
  const nexts = m.nodes.filter(n => n.next !== null).map(n => ` ${n.id}`).join('')
  if (nexts !== '') say(`next:${nexts}`)
  else if (m.planDue) say(`next: plan — parked work awaits: ${backlogLine(m.backlog)} (grovespec-plan)`)
  return 0
}

// "followups 2 · findings 1 · restructuring 1" — zero components omitted.
function backlogLine (b) {
  const parts = []
  if (b.followups) parts.push(`followups ${b.followups}`)
  if (b.findings) parts.push(`findings ${b.findings}`)
  if (b.restructuring) parts.push(`restructuring ${b.restructuring}`)
  return parts.join(' · ')
}

// ===================== followups (the parked record list, in one sweep) =====================
// Non-blocking findings survive their gate and land in each record's `followups` — the
// RECORD list: improvement · harmless-bug, plus must-fix work routed to another gate
// (kind contract-gap). This lists them all — the aggregate surface that keeps parked work
// visible after the gates close. It is a record, never an automatic queue: an item becomes
// work only when the user picks it at grovespec-plan (a single item: grovespec-revise);
// this command only shows.
// Ordered by what a planning pass must rule on first: routed must-fix work item by item,
// then the record categories in bulk, with unclassified legacy items last.
const FOLLOWUP_GROUPS = [
  ['routed', 'must-fix routed to revise/verify (kind contract-gap) — rule on these item by item'],
  ['improvement', 'could be better — structure · performance · tests · readability; worked only on your pick'],
  ['harmless-bug', 'wrong but harmless — no real effect on results, data, or security; worked only on your pick'],
  ['legacy', 'pre-0.13 grades — reclassify by category when the node next reopens']
]

export function cmdFollowups (P) {
  // The SAME unquoting `validate` applies (both quote forms) — one spelling of a value
  // cannot mean two things to two readers of the same bytes (measured: a single-quoted
  // field landed a fully valid item in the wrong group here).
  const unq = s => s.replace(/^(['"])(.*)\1$/, '$2').trim()
  const all = P.allFollowups()
  const groupOf = f => {
    const cat = unq(f.category)
    if (MUST_FIX_CATEGORIES.includes(cat)) return 'routed'
    if (RECORD_CATEGORIES.includes(cat)) return cat
    return 'legacy'
  }
  const label = f => unq(f.category) !== '' ? unq(f.category) : unq(f.severity) !== '' ? unq(f.severity) : '(unclassified)'
  const line = f => `  ${pad(f.tid, 8)} ${pad(f.lane, 7)} ${pad(`[${label(f)}]`, 19)} ${pad(unq(f.kind), 13)} ${unq(f.family)}`
  for (const [g, why] of FOLLOWUP_GROUPS) {
    const group = all.filter(f => groupOf(f) === g)
    if (!group.length) continue
    say(`${g === 'routed' ? 'routed must-fix' : g} — ${why} (${group.length})`)
    for (const f of group) say(line(f))
  }
  const b = P.backlogCounts()
  if (b.findings) say(`findings backlog: ${b.findings} unchecked (${P.findingsPath})`)
  if (b.restructuring) say(`restructuring backlog: ${b.restructuring} unchecked (${P.restructuringPath})`)
  if (b.total === 0) { say('no parked work — every followups list is empty, no backlog items'); return 0 }
  say(`total: ${backlogLine(b)} — grovespec-plan structures these into the next milestone; nothing here is worked without your pick`)
  return 0
}

// ===================== check (the top-down gate) =====================
export function cmdCheck (P, n) {
  if (P.treeGatePending()) {
    say(n === '' ? `✗ ${treeGateMsg(P)}` : `✗ ${n}: ${treeGateMsg(P)}`)
    return 1
  }
  // A frozen node must never read as ready — a skill auto-routing off this list
  // would resume work the ledger deliberately parked. Unreadable ledger = refuse to
  // answer, same reason as cmd-next.
  const ws = waitState(P)
  if (ws.problems.length) {
    for (const m of ws.problems) say(m)
    say('✗ readiness cannot be answered — the wait ledger is unreadable; fix it, then re-run')
    return 2
  }
  if (n === '') {
    say('ready to work now (top-down):')
    let any = false; let doneskel = false
    for (const t of P.treeIds()) {
      if (P.statusOf(t) === 'done') {
        if (P.roleOf(t) === 'skeleton') doneskel = true
        continue
      }
      if (P.unblocked(t) === 'yes' && ws.asleepOn(t) === null) { say(`  ${pad(t, 8)} ${pad(P.statusOf(t), 12)} → ${P.nextAction(t)}`); any = true }
    }
    if (!any) say('  (none — every non-done node is blocked)')
    if (doneskel) say("  + done skeletons: their children are already sketched (work them above); 'grow' only adds children beyond the spec")
    return 0
  }
  if (P.read(P.taskPath(n)) === null) { say(`✗ ${n}: no task file`); return 2 }
  const ub = P.unblocked(n)
  if (ub === 'yes') {
    const asleep = ws.asleepOn(n)
    if (asleep !== null) {
      say(`✗ ${n} is NOT ready — waiting on ${asleep.to} (declared ${asleep.declared}): ${asleep.need}. The turn returns when ${asleep.to} answers or goes done.`)
      return 1
    }
    say(`✓ ${n} is ready (${P.statusOf(n)}) — parent done, blocked_by done → next: ${P.nextAction(n)}`)
    return 0
  }
  say(`✗ ${n} is NOT ready — ${ub.slice(3)}. Do NOT work it (that's bottom-up). Work a node 'grovespec check' lists as ready.`)
  return 1
}

// ===================== lang / locale =====================
export function cmdLang (P) {
  const v = langValue(P.configText)
  if (v !== '') say(v)
  else say('(no config.language yet — run grovespec-init)')
  return 0
}

// ===================== interview =====================
// The fixed setup questionnaire (Q2 find streak · Q3 models) as a paste-ready AskUserQuestion
// payload. The runtime owns these strings because an agent re-typing them into tool-call
// JSON corrupted single characters twice (proof runs #1·#3: 가벼운→가버운, 나뉩니다→나뉜니다)
// by hand-encoding \uXXXX codepoints — so the Claude form is pre-escaped pure ASCII: pasting
// it verbatim has no encoding step left to get wrong (the Codex form below is plain UTF-8,
// for a reason of its own). Q1 (language) is composed from the
// detected locale instead — see grovespec-init references/setup.md.
const INTERVIEW = [
  {
    question: '재검토 횟수 — GroveSpec은 스펙과 코드를 여러 AI가 반복해서 검토해 문제를 찾아요. 무엇을 반드시 고칠지는 문제의 종류로 정해져 있어요(실행 불가·요구사항 미충족·일반 사용 버그·손쉬운 오남용·보안 구멍은 반드시 수정, 개선점·사용에 지장 없는 버그는 기록만). 여기서 정하는 건 하나예요: "새로운 필수 수정 문제가 연속 몇 번 안 나와야 탐색을 끝낼까?" 횟수가 클수록 꼼꼼하지만 그만큼 느리고 비싸요.',
    header: '재검토 횟수',
    multiSelect: false,
    options: [
      { label: '2 — 연속 2회 무발견 (추천)', description: '새 필수 문제가 두 번 연속 안 나오면 목록 확정. 발견율과 비용의 균형이 맞는 기본값.' },
      { label: '1 — 연속 1회', description: '한 번 조용하면 바로 확정. 가장 빠르지만, 한 번의 운에 좌우될 수 있음.' },
      { label: '3 — 연속 3회', description: '세 번 연속 조용해야 확정. 가장 꼼꼼하지만 가장 느리고 비쌈.' }
    ]
  },
  {
    question: "리뷰어 모델 — 그 검토는 여러 AI가 서로 다른 관점으로 나눠서 해요 (한쪽은 '결과가 맞나', 다른 쪽은 '보안 구멍은 없나'). AI는 똑똑할수록 더 잘 잡지만 그만큼 비싸요. 검토 AI를 전부 같은 걸로 둘까요, 아니면 깊이 파고드는 쪽만 더 센(비싼) 걸로 올릴까요?",
    header: '리뷰어 모델',
    multiSelect: false,
    options: [
      { label: '전부 같은 AI로', description: '검토 AI 전부 지금 이 대화에서 쓰는 모델 그대로. 따로 설정 없이 바로 됨. 단, 지금 비싼 모델(Opus 등)을 쓰고 있다면 검토 비용도 높아짐 — 넓게 훑는 쪽은 싼 모델로도 충분하기 때문에, 그 경우엔 아래 혼합이 오히려 비용도 낮고 효율적임.' },
      { label: '깊은 검토만 센 AI로', description: '넓게 훑는 쪽은 싼 AI, 깊이 파고드는 쪽만 더 똑똑하고 비싼 AI. 역할별로 필요한 만큼만 쓰므로 비용 대비 검토 품질이 가장 좋음. 다만 모델을 나눠 설정하고, 그 비싼 AI를 쓸 수 있어야 함.' }
    ]
  },
  {
    question: '편집 라우팅 훅 — GroveSpec을 거치지 않은 코드 수정도 나중에 감지되지만(fresh), 훅을 설치하면 편집하는 그 순간 "이 파일은 어느 노드 소유이고, 이 수정이 그 계약에 닿는지"를 계산해 에이전트에게 알려줘요. 아무것도 막지 않는 조언형이고, 이 프로젝트의 .claude/settings.json(Claude Code)과 .codex/hooks.json(Codex)에만 등록돼요. 끄는 건 언제든 config 한 줄(hooks: off), 제거도 명령 하나(grovespec hooks remove)예요.',
    header: '편집 라우팅 훅',
    multiSelect: false,
    options: [
      { label: '설치 (추천)', description: '수정하는 순간에 라우팅 판단 재료가 주입됨 — 에이전트가 계약 변경을 놓칠 확률이 줄어듦. 다음 세션에서 호스트가 새 프로젝트 훅의 승인을 한 번 물어봄(정상 절차).' },
      { label: '설치 안 함', description: '훅 없이 사후 감지(fresh)만으로 운영. 나중에 마음이 바뀌면 grovespec hooks install 한 줄.' }
    ]
  }
]
// Codex form: request_user_input_async, the question tool Codex offers in its default
// mode — request_user_input is refused outside Plan mode, and init writes files, so it
// never runs in Plan mode (measured, codex-cli 0.159.3). Its schema is
// { title, options: [string] } with no per-option description, so each option's
// explanation joins the title as a list. The labels stay byte-identical to the Claude
// form, so one set of Write: rules maps an answer from either host.
// The Codex form is plain UTF-8, not escaped: Codex shows a command's output inside a
// JSON string, so \uXXXX arrives doubled and the agent cannot tell which form to pass \u2014
// it sent trial questions to find out in 3 of 4 measured runs and corrupted the payload
// in the fourth. A lone native command's UTF-8 passes through PowerShell unchanged (measured).
export function cmdInterview (surface) {
  if (!['', 'claude', 'codex'].includes(surface)) { say('usage: grovespec interview [claude|codex]'); return 2 }
  if (surface === 'codex') {
    say(JSON.stringify(INTERVIEW.map(q => ({
      title: `${q.question}\n\n${q.options.map(o => `- ${o.label}: ${o.description}`).join('\n')}`,
      options: q.options.map(o => o.label)
    })), null, 2))
    return 0
  }
  const json = JSON.stringify(INTERVIEW, null, 2)
  say(json.replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')))
  return 0
}

export function cmdLocale () {
  let l = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || ''
  l = l.replace(/\..*$/, '').replace(/@.*$/, '')
  if (l === 'C' || l === 'POSIX') l = ''
  if (l === '') {
    // The OS user locale, asked without spawning anything (the bash runtime read the
    // Windows registry here; Intl reads the same setting and works everywhere).
    try { l = new Intl.DateTimeFormat().resolvedOptions().locale || '' } catch { l = '' }
  }
  if (l === '') return 1
  say(l.replace(/[-_].*$/, '').toLowerCase())
  return 0
}

// ===================== version =====================
// The date label says which bundle this claims to be; the fingerprint says which bytes
// it actually is — two installs can share a label while their behavior differs (a
// testbed once ran two weeks ahead of its distribution repo). Compare THIS.
function fingerprint (P) {
  const entries = []
  const schemaFile = `${P.root}/.grovespec/schema`
  const core = []
  if (existsSync(schemaFile) && statSync(schemaFile).isFile()) core.push(schemaFile)
  walkFiles(`${P.root}/.grovespec/bin`, core)
  walkFiles(`${P.root}/.grovespec/templates`, core)
  for (const p of core) entries.push([p.slice(P.root.length + 1), p])

  // Claude Code and Codex discover the same skills under different host-owned
  // directories. Hash either tree under one logical path so a Claude-only install,
  // a Codex-only install and a dual-host install have the same fingerprint. When a
  // dual install drifts, refusing the fingerprint is safer than blessing whichever
  // directory happened to be checked first.
  const bundles = []
  for (const host of ['.claude', '.agents']) {
    const base = `${P.root}/${host}/skills`
    let skills = []
    try { skills = readdirSync(base).filter(n => n.startsWith('grovespec-')) } catch { /* none */ }
    const files = []
    for (const s of skills.sort()) walkFiles(`${base}/${s}`, files)
    if (files.length) bundles.push({ host, base, files: files.sort() })
  }
  if (bundles.length === 2) {
    const [a, b] = bundles
    const left = new Map(a.files.map(p => [p.slice(a.base.length + 1), p]))
    const right = new Map(b.files.map(p => [p.slice(b.base.length + 1), p]))
    const names = [...new Set([...left.keys(), ...right.keys()])].sort()
    for (const name of names) {
      const ap = left.get(name); const bp = right.get(name)
      let same = ap !== undefined && bp !== undefined
      try { same = same && readFileSync(ap).equals(readFileSync(bp)) } catch { same = false }
      if (!same) throw new Error(`${a.host}/skills and ${b.host}/skills differ at ${name}`)
    }
  }
  if (bundles.length) {
    const chosen = bundles[0]
    for (const p of chosen.files) {
      const name = p.slice(chosen.base.length + 1)
      entries.push([`.claude/skills/${name}`, p]) // canonical logical path preserves existing fingerprints
    }
  }

  entries.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
  // Nothing to hash is not a fingerprint — an empty walk would print sha256("") and two
  // directories holding no runtime at all would "match", which is the one comparison this
  // number exists for (project instructions: compare installs by fingerprint, not label).
  if (!entries.length) return null
  const h = createHash('sha256')
  for (const [name, p] of entries) {
    h.update(name + '\0')
    try { h.update(readFileSync(p)) } catch { /* unreadable — path alone */ }
    h.update('\0')
  }
  return h.digest('hex').slice(0, 16)
}
// What this runtime can do that an older one cannot, by name — a host checks for a word
// here instead of comparing version labels. parallel-worktrees (v0.19.0): the shared id
// floor and node claims across the worktrees of one repository (lib/shared.mjs).
export const CAPABILITIES = ['parallel-worktrees']

export function cmdVersion (P) {
  let found = false
  const rootV = `${P.root}/.grovespec/VERSION`
  const installV = `${dirname(scriptDir()).replace(/\\/g, '/')}/../VERSION`
  for (const p of [rootV, installV]) {
    try { process.stdout.write(readFileSync(p, 'utf8')); found = true; break } catch { /* next */ }
  }
  if (!found) say('(no VERSION file)')
  say(`capabilities: ${CAPABILITIES.join(' ')}`)
  let fp
  try { fp = fingerprint(P) } catch (e) {
    say(`fingerprint: conflict — ${e.message}`)
    return 1
  }
  say(fp === null
    ? 'fingerprint: none — no runtime files here (bin · schema · templates · skills/grovespec-*); this directory is not an install'
    : `fingerprint: ${fp} (bin + schema + templates + skills/grovespec-*)`)
  return found ? 0 : 1
}

// ===================== id =====================
// The next node id, derived — never improvised by the skill that needs one. It is the
// highest number that leaves a trace anywhere this runtime can look: the current
// tree · task files · gate records, plus — across ALL reachable refs, not just this
// branch — every convention subject (`TASK-N: …`, `grow TASK-N: …`) and every task-file
// PATH any commit ever touched. A number that ever existed stays burned after its node
// is merged away: reissued, it would hand the new node the dead node's commits (`diff`
// collects by that prefix) and its stale records.
// Derivation over a counter file on purpose: history is append-only, so the maximum
// cannot move backwards, and there is no second record to drift from reality. What it
// therefore cannot see is history that no longer exists — a commit on a deleted branch,
// or one dropped by a rewrite. That residue is stated, not papered over: the command
// prints where it looked.
// Nor can it see a number issued but not yet committed — taken by another worktree of
// this repository, whose tree and files this checkout never reads, or by an earlier call
// here whose node was never written. So a git repository also keeps a FLOOR in its
// shared state (lib/shared.mjs, v0.19.0): every issuance records itself there inside the
// shared lock, and the answer is max(scan, floor) + 1. The scan stays the truth for what
// exists; the floor can only raise the answer, never lower it.
export function cmdId (P) {
  let hi = 0
  const seen = tid => {
    const m = /^TASK-([0-9]+)$/.exec(tid)
    if (m) hi = Math.max(hi, Number(m[1]))
  }
  for (const t of P.treeIds()) seen(t)
  for (const f of P.taskFiles()) seen(P.tidOf(f))
  for (const f of P.reviewFiles()) {
    const m = f.match(/\/(TASK-[0-9]+)\.(?:verify|review)\.yaml$/)
    if (m) seen(m[1])
  }
  const rs = repoState(P.root)
  if (rs === 'broken') {
    say(`cannot derive an id — git did not answer (${gitFailure()}); an id issued over unread history could collide`)
    return 2
  }
  const repo = rs === 'repo'
  let floor = 0
  if (repo) {
    // Cut history reads SUCCESSFULLY and is wrong — a depth-1 clone re-issued a
    // burned number with exit 0. ids need the full clone (the refusal names it).
    const sh = shallowState(P.root)
    if (sh === 'broken') { say('cannot derive an id — git rev-parse --is-shallow-repository failed'); return 2 }
    if (sh === 'shallow') { say('cannot derive an id — this is a shallow clone, so burned numbers behind the cut are invisible; unshallow it (git fetch --unshallow), then re-run'); return 2 }
    const subjects = allSubjects(P.root)
    const paths = allTouchedPaths(P.root)
    if (subjects === null || paths === null) {
      say('cannot derive an id — reading history failed (git >= 2.31 is required for merge-aware paths); an id issued over unread history could collide')
      return 2
    }
    for (const s of subjects) {
      const m = /^(?:grow |verify |review |revise |approve |ratify )?(TASK-[0-9]+): /.exec(s)
      if (m) seen(m[1])
    }
    for (const p of paths) {
      const m = /(?:^|\/)(TASK-[0-9]+)\.md$/.exec(p)
      if (m) seen(m[1])
    }
    const ctx = sharedContext(P.root)
    if (ctx.state === 'broken') { say('cannot derive an id — git did not answer where the repository\'s shared state lives (git rev-parse --git-common-dir)'); return 2 }
    if (ctx.state === 'repo') {
      const r = withSharedLock(ctx, () => {
        const st = readState(ctx)
        if (st.broken) return { broken: st.broken }
        const f = st.data.ids[ctx.project] ?? 0
        st.data.ids[ctx.project] = Math.max(hi, f) + 1
        writeState(ctx, st.data)
        return { floor: f }
      })
      if (r.refused) { say(`cannot issue an id — ${r.refused}`); return 2 }
      if (r.value.broken) { say(`cannot issue an id — ${r.value.broken} — ${STATE_REMEDY}`); return 2 }
      floor = r.value.floor
    }
  }
  say(`next id: TASK-${Math.max(hi, floor) + 1}`)
  say(hi === 0 ? 'highest seen: none' : `highest seen: TASK-${hi}`)
  // Printed only when the floor, not the scan, decided the number — the ordinary single
  // checkout (id → write the node → id) never meets it, so its output is unchanged.
  if (floor > hi) say(`already issued: ${floor === hi + 1 ? `TASK-${floor}` : `TASK-${hi + 1}…TASK-${floor}`} — by another worktree of this repository or an earlier id here, and not in this checkout yet; a number is never issued twice`)
  say(repo
    ? 'looked at: tree · task files · gate records · every reachable commit (subjects + task-file paths). History no ref reaches — a deleted branch, a dropped commit — cannot be read by anything.'
    : 'looked at: tree · task files · gate records. Not a git repository, so no history was scanned.')
  return 0
}

// ===================== impact =====================
function walkFiles (dir, out) {                      // sorted, depth-first — grep -r's shape
  let names
  try { names = readdirSync(dir).sort() } catch { return }
  for (const n of names) {
    const p = `${dir}/${n}`
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) walkFiles(p, out)
    else out.push(p)
  }
}
export function cmdImpact (P, n) {
  if (n === '') { say('usage: grovespec impact TASK-N'); return 2 }
  if (P.read(P.taskPath(n)) === null) { say(`no such node: ${n}`); return 2 }
  say(`impact of a contract change on ${n} (${P.nameOf(n)}):`)
  say('  -- exact (depend on it) --')
  for (const c of P.childrenOf(n)) say(`  child     ${c}  ${P.nameOf(c)}`)
  for (const f of P.taskFiles()) {
    const tid = P.tidOf(f)
    for (const b of P.blockedIdsOf(f)) {
      if (b === n) say(`  consumer  ${tid}  ${P.nameOf(tid)}`)
    }
  }
  say("  -- hint: name-grep only (authoritative = the node's exported symbols, grepped from its code — see grovespec-revise) --")
  const name = P.nameOf(n)
  const files = []
  walkFiles(P.srcDir, files)
  walkFiles(P.tasksDir, files)
  for (const p of files) {
    if (p.endsWith(`/${n}.md`)) continue
    let t
    try { t = readFileSync(p, 'utf8') } catch { continue }
    if (t.includes(name)) say(`  ${p}`)
  }
  return 0
}

// ===================== tree =====================
export function cmdTree (P) {
  for (const { tid, depth } of P.rows()) {
    say(`${'  '.repeat(depth)}- ${tid}  ${P.nameOf(tid)} [${P.roleOf(tid)}, ${P.statusOf(tid)}]`)
  }
  return 0
}
