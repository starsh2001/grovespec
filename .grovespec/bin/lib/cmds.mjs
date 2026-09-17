// GroveSpec commands. Every message and exit code here is the contract tests/regress.sh
// pins — the bash runtime this ports was graded against the same goldens.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { sectionsOf, badTreeLines, treeStrictProblems, pipes, langValue, topValue, listItemCount, listItems, itemValue, splitLines, flowListKeys, severityCap, SEVERITY_RANK, frontmatterBoundaryProblem } from './core.mjs'
import { Project, treeGateMsg, scriptDir, FORMAT } from './project.mjs'
import { taskEvidenceDigest, specDigest, treeDigest } from './cmd-pin.mjs'
import { lastTest } from './cmd-approve.mjs'
import { git, repoState, ignoredState, shallowState, showPrefix, ancestorState, canonicalOidState, dirtyResultSubject, resultSealBreach, log, touched, trackedPaths, allSubjects, allTouchedPaths } from './git.mjs'
import { SourceEvidenceError, assertFindRound, parseSourcePacket, sourceScopeDigest, validateCompletedPacket, validateTaskRefsSyntax } from './source-evidence.mjs'
import { TreeEvidenceError, TREE_EVIDENCE_MODES, treeEvidenceDigest } from './tree-evidence.mjs'

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
  'review.enum.level', 'review.enum.approved_by', 'round.fm.required', 'round.fm.optional',
  'finding.fm.required',
  'finding.enum.kind', 'finding.enum.severity', 'finding.enum.gate1', 'finding.enum.gate',
  'brief.fm.required', 'brief.sections', 'conventions.sections'
]

export function cmdValidate (P) {
  let problems = 0
  const prob = m => { say(`  ${m}`); problems++ }
  const untrackedGates = []          // a notice, printed at the end — never a problem

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
  for (const t of ids) {
    if (P.statusOf(t) !== 'done') continue
    const p = P.parentOf(t)
    if (p !== '' && P.statusOf(p) !== 'done') prob(`${t} is done but parent ${p} is ${P.statusOf(p)}`)
    for (const b of P.blockedIdsOf(P.taskPath(t))) {
      if (P.statusOf(b) !== 'done') prob(`${t} is done but blocked_by ${b} is ${P.statusOf(b)}`)
    }
  }

  // --- blocked_by cycle (Kahn): resolve nodes whose deps are all resolved; leftovers = cycle ---
  const resolved = new Set()
  for (;;) {
    let progress = false
    for (const t of ids) {
      if (resolved.has(t)) continue
      if (P.blockedIdsOf(P.taskPath(t)).every(b => resolved.has(b))) { resolved.add(t); progress = true }
    }
    if (!progress) break
  }
  for (const t of ids) {
    if (!resolved.has(t)) prob(`${t} is in a blocked_by cycle (unresolvable)`)
  }

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
    for (const [k, lo] of [['strength', 1], ['repeat', 0], ['max_rounds', 1], ['round', 0], ['consecutive_passes', 0]]) {
      v = topValue(text, k)
      if (v === '') continue
      if (!/^[0-9]+$/.test(v) || Number(v) < lo || (k === 'strength' && Number(v) > 3)) {
        prob(`${rf}  ${k} '${v}' out of range (${k === 'strength' ? '1–3' : `≥ ${lo}`})`)
      }
    }
    if (topValue(text, 'status') === 'passed' && listItemCount(text, 'open_issues') > 0) {
      prob(`${rf}  status: passed but open_issues is not empty`)
    }
    // `escalated` has ONE definition — the cycle ran past its round budget and a human
    // must rule. A record wearing it inside the budget contradicts itself, and the cost
    // is a false stop: `next` refuses to take the gate and the auto loop ends, while the
    // real next step (fix the open issues) was available all along. Measured — a review
    // wrote `escalated` at round 3 of 15 because judge had confirmed defects, which is
    // the ordinary `reviewed` + `open_issues` → `grovespec-fix` path.
    if (topValue(text, 'status') === 'escalated') {
      const r = Number(topValue(text, 'round')); const mx = Number(topValue(text, 'max_rounds'))
      // `r < mx`, not `<=`: spending the budget exactly (round == max_rounds) is the
      // legitimate escalation — rounds remaining is what makes the word false.
      if (Number.isFinite(r) && Number.isFinite(mx) && mx > 0 && r < mx) {
        prob(`${rf}  status: escalated at round ${r} with max_rounds ${mx} — ${mx - r} round(s) still budgeted, and escalation means the budget ran out. Confirmed defects are '${targetType === 'result' ? 'reviewed' : 'in-progress'}' + open_issues (→ ${targetType === 'result' ? 'grovespec-fix' : 'the fix phase of this cycle'}); raise max_rounds only by naming what the next round would learn`)
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

    // --- the severity gates, enforced ---
    // Every confirmed finding states its gate answers, and the grade must not exceed what
    // they compute. This is the one rule a round cannot talk its way past: the loop that
    // made this necessary ran sixteen rounds writing gate answers it then didn't follow.
    const sevs = schList('finding.enum.severity')
    const kinds = schList('finding.enum.kind')
    const g1s = schList('finding.enum.gate1')
    const yn = schList('finding.enum.gate')
    // An empty quoted string is an empty field — `clause: ""` must not satisfy "name the clause".
    const field = (it, k) => itemValue(it, k).replace(/^(['"])(.*)\1$/, '$2').trim()
    const seenFamilies = new Map()
    const validateFindingList = key => {
      const items = listItems(text, key)
      items.forEach((it, i) => {
        const tag = `${key}[${i + 1}]${field(it, 'id') === '' ? '' : ` (${field(it, 'id')})`}`
        const at = `${rf}  ${tag}`
        for (const k of schList('finding.fm.required')) {
          if (field(it, k) === '') prob(`${at}  field '${k}' missing or empty — a grade with no stated gates is an opinion`)
        }
        const kind = field(it, 'kind')
        const family = field(it, 'family')
        const sev = field(it, 'severity'); const prop = field(it, 'proposed')
        if (kind !== '' && !kinds.includes(kind)) prob(`${at}  kind '${kind}' invalid → use ${P.sch('finding.enum.kind')}`)
        if (family !== '') {
          const seen = seenFamilies.get(family)
          if (seen) prob(`${at}  family '${family}' duplicates ${seen} — the same hole re-shown through a new path is one finding; merge it`)
          else seenFamilies.set(family, tag)
        }
        for (const [k, val] of [['severity', sev], ['proposed', prop]]) {
          if (val !== '' && !sevs.includes(val)) prob(`${at}  ${k} '${val}' invalid → use ${P.sch('finding.enum.severity')}`)
        }
        const g = { gate1: field(it, 'gate1'), gate2: field(it, 'gate2'), gate3: field(it, 'gate3') }
        if (g.gate1 !== '' && !g1s.includes(g.gate1)) prob(`${at}  gate1 '${g.gate1}' invalid → use ${P.sch('finding.enum.gate1')} (what can you exhibit TODAY by running committed code?)`)
        for (const k of ['gate2', 'gate3']) {
          if (g[k] !== '' && !yn.includes(g[k])) prob(`${at}  ${k} '${g[k]}' invalid → use ${P.sch('finding.enum.gate')}`)
        }
        if (kind === 'concern' && key === 'open_issues') {
          prob(`${at}  kind 'concern' cannot block a gate → move it to followups`)
        } else if (kind === 'contract-gap' && key === 'open_issues' && targetType === 'result') {
          prob(`${at}  result reviews may block only on kind 'defect' → move this spec/contract issue to followups (or reopen via revise/verify)`)
        } else if (kind === 'defect' && key === 'followups') {
          prob(`${at}  kind 'defect' belongs in open_issues or adjudications → followups are for later revise/verify work, not a current target defect`)
        }
        if (kind === 'concern' && sev !== '' && sev !== 'nice-to-have') {
          prob(`${at}  kind 'concern' must grade as 'nice-to-have' → concerns are notes, never blockers`)
        }
        // The followups entry bar: a parked pool is a future planning pass's mandatory
        // reading list, and a measured 87-item pool lost 76 at disposition — what dies
        // there should die at entry. contrived/story is recorded (adjudications), not queued.
        // Scope: undecided records only (in-progress · escalated · passed-pending). A record
        // whose gate is already decided was written under the rules of its own cycle — the
        // same grandfather that keeps historical tree records readable; its parked items
        // still surface in `followups` and dry out at the next plan disposition.
        if (key === 'followups' && (g.gate1 === 'contrived' || g.gate1 === 'story')
            && !(topValue(text, 'status') === 'passed' && topValue(text, 'approved_by') !== 'pending')) {
          prob(`${at}  followups take gate1 'behavior' or 'mechanism' only — a '${g.gate1}' finding is recorded, not queued: move it to adjudications (accepted-gap, reason included); it re-enters only with live measurement`)
        }
        if (g.gate1 === 'mechanism' && field(it, 'trigger') === '') prob(`${at}  gate1: mechanism needs 'trigger' — name the ONE ordinary step (a natural future edit, an in-scope consumer doing the documented thing) that turns the hole into wrong behavior; if naming it takes deliberate rule-breaking or a coincidence of edits, the honest answer is 'contrived'`)
        if (g.gate2 === 'yes' && field(it, 'clause') === '') prob(`${at}  gate2: yes needs 'clause' — name the Contract/AC line it breaks`)
        if (g.gate3 === 'yes' && field(it, 'workaround') === '') prob(`${at}  gate3: yes needs 'workaround' — name the documented way around it`)
        if (prop === 'critical' && g.gate2 !== 'yes' && field(it, 'harm') === '') {
          prob(`${at}  proposed: critical needs gate2: yes (a promised clause) or 'harm' — name the data lost/corrupted or the required input that fails`)
        }
        if (sev !== '' && prop !== '' && sevs.includes(sev) && sevs.includes(prop) && g1s.includes(g.gate1) && yn.includes(g.gate2) && yn.includes(g.gate3)) {
          const cap = severityCap(prop, g.gate1, g.gate2, g.gate3)
          const capName = Object.keys(SEVERITY_RANK).find(k => SEVERITY_RANK[k] === cap)
          if (SEVERITY_RANK[sev] > cap) {
            prob(`${at}  severity '${sev}' exceeds what its gates allow — proposed ${prop} + (gate1 ${g.gate1} · gate2 ${g.gate2} · gate3 ${g.gate3}) caps it at '${capName}'`)
          }
        }
      })
    }
    validateFindingList('open_issues')
    validateFindingList('followups')

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
    // (<id>.round<N>.brief.md · .judge.md · .confirm.md); the note points at it in one line.
    // A round entry is FLAT: every line is one of the schema's fields, on one line, at the
    // entry's own indent. Checking only `note: >-` left the rule open to the same prose in
    // three other spellings — a plain multi-line scalar (`note:` then indented paragraphs),
    // a key the old `[a-z_]+` scan never saw (`Note:` · `note2:` · `"remarks":`), and a
    // nested mapping. Reading DEPTH instead of one field's marker closes all of them, and
    // it also stops the mirror error: a block-style `found:` was reported as three unknown
    // fields ('critical' · 'should_fix' · 'nice') — names the schema does list, under a
    // message that sent the reader to a list they were already following.
    const roundKeys = new Set([...schList('round.fm.required'), ...schList('round.fm.optional')])
    const home = base.replace(/\.(verify|review)\.yaml$/, '')
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
          prob(`${at2}  is indented past the entry's fields — an entry is a block item ('- n: 1', one field per line); a field's VALUE may be a one-line flow map ('found: { critical: 0, should_fix: 0, nice: 0 }'), but nothing here spans lines: put a pass's reasoning in ${home}.round<n>.brief.md (judge/confirm: .judge.md · .confirm.md) and leave a one-line 'note' pointing at it`)
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
  if (rState === 'broken') prob('git did not answer (missing or failing git) — every history-bound check (pins · reviewed commits · tdd evidence · ignored-subtree) is unread; an unread check is not a passed one')
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

  // What this run actually looked at — so "I did not look" (a wrong path, an empty
  // tasks dir) can never read as "I looked and found nothing".
  say(`examined: tasks ${P.taskFiles().length} · tree nodes ${ids.length} · review files ${P.reviewFiles().length}`)
  // A notice, not a problem: an auto-taken gate is a legitimate state, but it is never
  // allowed to look like a human-taken one — so every run says how many are outstanding.
  const unratified = ids.filter(t => P.unratified(t).length)
  if (unratified.length) {
    say(`notice: ${unratified.length} node(s) auto-approved by machine, not yet ratified — ${unratified.join(', ')} (grovespec ratify <id>…)`)
  }
  if (untrackedGates.length) {
    say(`notice: ${untrackedGates.length} passed gate record(s) not tracked by git — the verdict stands, but what it passed on is one clean-up away from gone: ${untrackedGates.join(', ')} (git add them with the gate's commit)`)
  }
  if (problems === 0) { say('✓ validate: all checks passed'); return 0 }
  say(`✗ validate: ${problems} problem(s)`)
  return 1
}

// ===================== status =====================
export function cmdStatus (P) {
  const gate = P.treeGatePending()
  if (gate) say(`! ${treeGateMsg(P)}`)
  let nexts = ''
  for (const t of P.treeIds()) {
    const st = P.statusOf(t); const ub = P.unblocked(t); const rl = P.roleOf(t)
    const fu = P.followupCounts(t)
    if (st === 'done') {
      if (rl === 'skeleton') say(`${pad(t, 8)} done        (children already sketched → work them; grow only to add beyond the spec${fu.length ? `; followups noted: ${fu.join(' · ')} via revise/verify` : ''})`)
      else if (fu.length) say(`${pad(t, 8)} done        (followups noted: ${fu.join(' · ')} via revise/verify)`)
      else say(`${pad(t, 8)} done`)
    } else if (gate) say(`${pad(t, 8)} ${pad(st, 12)} (awaiting the tree gate)`)
    else if (ub !== 'yes') say(`${pad(t, 8)} ${pad(st, 12)} (${ub.slice(3)})`)
    else if (P.humanWaits(t).length) say(`${pad(t, 8)} ${pad(st, 12)} (waiting on you — below)`)
    else { say(`${pad(t, 8)} ${pad(st, 12)} → ${P.nextAction(t)}`); nexts += ` ${t}` }
  }
  // Decisions parked on the human, split out — so "nothing ready" can never hide
  // an approval or confirm that is actually waiting on the user.
  const waiting = []
  if (gate && P.reviewStatus(`${P.reviewDir}/tree.verify.yaml`) === 'escalated') {
    const kind = P.treeGateKind() === 'fidelity' ? 'survey fidelity' : 'decomposition'
    waiting.push(`${pad('tree', 8)} ${kind} verify escalated — needs a human ruling (${P.reviewDir}/tree.verify.yaml)`)
  }
  for (const t of P.treeIds()) {
    for (const w of P.humanWaits(t)) waiting.push(`${pad(t, 8)} ${w.text}`)
  }
  if (waiting.length) {
    say('waiting on human:')
    for (const w of waiting) say(`  ${w}`)
  }
  const unratified = P.treeIds().map(t => [t, P.unratified(t)]).filter(([, l]) => l.length)
  if (unratified.length) {
    say('auto-approved by machine, not yet ratified:')
    for (const [t, labels] of unratified) say(`  ${pad(t, 8)} ${labels.join(' · ')} gate taken automatically — no human has looked (grovespec ratify ${t})`)
  }
  if (gate) { say(`next: grovespec-verify the tree (the ${P.treeGateKind() === 'fidelity' ? 'survey fidelity' : 'decomposition'} gate)`); return 0 }
  if (nexts !== '') say(`next:${nexts}`)
  else {
    // Every node done — parked work must not be invisible at the terminal line.
    const b = P.backlogCounts()
    if (b.total > 0 && P.treeIds().length > 0 && P.treeIds().every(t => P.statusOf(t) === 'done')) {
      say(`next: plan — parked work awaits: ${backlogLine(b)} (grovespec-plan)`)
    }
  }
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

// ===================== followups (the parked later-work, in one sweep) =====================
// Non-blocking findings survive their gate (kind: contract-gap / concern) and land in each
// record's `followups`. This lists them all — the aggregate surface that keeps parked work
// visible after the gates close. Working them off is grovespec-plan's job (a single item:
// grovespec-revise); this command only shows.
// Ordered by what an item can REACH today — `gate1`, the axis every finding already
// answered at its gate. No new field, no re-grading: a planning pass that reads a flat
// list of 152 has to weigh all 152 before it can start, and the one item whose wrong
// behavior runs TODAY sits at line 97 (measured: timelog-3, 152 parked across 9 nodes).
const REACH = [
  ['behavior', 'the wrong behavior runs today'],
  ['mechanism', 'hole verified, one ordinary step reaches it'],
  ['contrived', "real, but reaching it needs action outside the product's stated reality"],
  ['story', 'no verified hole; the victim is predicted']
]

export function cmdFollowups (P) {
  // The SAME unquoting `validate` applies (both quote forms) — when this stripped only
  // double quotes, a `gate1: 'behavior'` that validate certified as fully valid landed
  // here as "(ungraded) — no gate1 recorded", which buried a behavior item under story.
  // One spelling of a value cannot mean two things to two readers of the same bytes.
  const unq = s => s.replace(/^(['"])(.*)\1$/, '$2').trim()
  const all = P.allFollowups()
  const rank = f => {
    const i = REACH.findIndex(([g]) => g === unq(f.gate1))
    return i === -1 ? REACH.length : i                     // ungraded (legacy) sorts last, still shown
  }
  const line = f => `  ${pad(f.tid, 8)} ${pad(f.lane, 7)} ${pad(`[${unq(f.severity)}]`, 15)} ${pad(unq(f.kind), 13)} ${unq(f.family)}`
  const bySeverity = (a, b) => (SEVERITY_RANK[unq(b.severity)] ?? 0) - (SEVERITY_RANK[unq(a.severity)] ?? 0)
  // Grade outranks reach. `gate2: yes` lifts the severity cap for a story-grade finding
  // (a SHOWN break of a promised clause), so a legitimate `critical` can carry `gate1:
  // story` — and grouping by reach alone filed it last, under a heading reading "no
  // verified hole; the victim is predicted", inside the block a planning pass is told to
  // dispose of in bulk. That is worse than the flat list this replaced, so anything still
  // graded blocking is named first, whatever its reach.
  const blocking = all.filter(f => SEVERITY_RANK[unq(f.severity)] >= SEVERITY_RANK['should-fix'])
  const rest = all.filter(f => !(SEVERITY_RANK[unq(f.severity)] >= SEVERITY_RANK['should-fix']))
  if (blocking.length) {
    say(`blocking grade — critical · should-fix, whatever their reach (${blocking.length})`)
    for (const f of blocking.sort((a, b) => bySeverity(a, b) || rank(a) - rank(b))) say(line(f))
  }
  for (let i = 0; i <= REACH.length; i++) {
    const group = rest.filter(f => rank(f) === i).sort(bySeverity)
    if (!group.length) continue
    const [g, why] = REACH[i] ?? ['(ungraded)', 'no gate1 recorded — a legacy record; re-grade it when the node next reopens']
    say(`${g} — ${why} (${group.length})`)
    for (const f of group) say(line(f))
  }
  const b = P.backlogCounts()
  if (b.findings) say(`findings backlog: ${b.findings} unchecked (${P.findingsPath})`)
  if (b.restructuring) say(`restructuring backlog: ${b.restructuring} unchecked (${P.restructuringPath})`)
  if (b.total === 0) { say('no parked work — every followups list is empty, no backlog items'); return 0 }
  say(`total: ${backlogLine(b)} — grovespec-plan structures these into the next pass`)
  return 0
}

// ===================== check (the top-down gate) =====================
export function cmdCheck (P, n) {
  if (P.treeGatePending()) {
    say(n === '' ? `✗ ${treeGateMsg(P)}` : `✗ ${n}: ${treeGateMsg(P)}`)
    return 1
  }
  if (n === '') {
    say('ready to work now (top-down):')
    let any = false; let doneskel = false
    for (const t of P.treeIds()) {
      if (P.statusOf(t) === 'done') {
        if (P.roleOf(t) === 'skeleton') doneskel = true
        continue
      }
      if (P.unblocked(t) === 'yes') { say(`  ${pad(t, 8)} ${pad(P.statusOf(t), 12)} → ${P.nextAction(t)}`); any = true }
    }
    if (!any) say('  (none — every non-done node is blocked)')
    if (doneskel) say("  + done skeletons: their children are already sketched (work them above); 'grow' only adds children beyond the spec")
    return 0
  }
  if (P.read(P.taskPath(n)) === null) { say(`✗ ${n}: no task file`); return 2 }
  const ub = P.unblocked(n)
  if (ub === 'yes') {
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
// The fixed setup questionnaire (Q2 strength · Q3 models) as a paste-ready AskUserQuestion
// payload. The runtime owns these strings because an agent re-typing them into tool-call
// JSON corrupted single characters twice (proof runs #1·#3: 가벼운→가버운, 나뉩니다→나뉜니다)
// by hand-encoding \uXXXX codepoints — so the output is pre-escaped pure ASCII: pasting it
// verbatim has no encoding step left to get wrong. Q1 (language) is composed from the
// detected locale instead — see grovespec-init references/setup.md.
const INTERVIEW = [
  {
    question: '리뷰 강도 — GroveSpec은 코드를 다 쓰면 AI가 그 코드를 다시 검토해 문제를 찾아내요. 문제는 심각도로 나뉩니다: Critical(심각)=실제로 망가짐(안 돌아가거나 동작이 틀림), Should-Fix(고치는 게 좋음)=돌아는 가지만 나중에 버그·혼란으로 이어질 게 분명함, Nice-to-Have(있으면 좋음)=사소한 다듬기. 어느 심각도부터 "통과 못 함 → 다시 고쳐"로 되돌릴까요? (그보다 가벼운 건 메모만 하고 넘어가요.)',
    header: '리뷰 강도',
    multiSelect: false,
    options: [
      { label: '2 — Critical + Should-Fix (추천)', description: '망가진 것 + 고치는 게 좋은 것까지 되돌려 고치게 함. 너무 빡빡하지도 느슨하지도 않은 기본값.' },
      { label: '1 — Critical만', description: '진짜로 망가진 것만 되돌림. 가장 빠르고 느슨.' },
      { label: '3 — + Nice-to-Have', description: '사소한 다듬기까지 전부 되돌림. 가장 꼼꼼하지만 가장 느림.' }
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
  }
]
export function cmdInterview () {
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
export function cmdVersion (P) {
  let found = false
  const rootV = `${P.root}/.grovespec/VERSION`
  const installV = `${dirname(scriptDir()).replace(/\\/g, '/')}/../VERSION`
  for (const p of [rootV, installV]) {
    try { process.stdout.write(readFileSync(p, 'utf8')); found = true; break } catch { /* next */ }
  }
  if (!found) say('(no VERSION file)')
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
    say('cannot derive an id — git did not answer (missing or failing git); an id issued over unread history could collide')
    return 2
  }
  const repo = rs === 'repo'
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
  }
  say(`next id: TASK-${hi + 1}`)
  say(hi === 0 ? 'highest seen: none' : `highest seen: TASK-${hi}`)
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
