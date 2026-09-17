// approve / ratify — deciding a sealed gate, and the human's post-hoc stamp.
//
// A gate's verdict is written by its cold cycle and SEALED by `pin` (digest · commit ·
// approved_by: pending). `approve` never writes evidence — it verifies that the seal
// still covers the CURRENT bytes, then flips the decision:
//
//   approve TASK-N            machine takes the gate (auto mode). Result gates also
//                             demand machine-verifiable test evidence bound to the code
//                             HEAD holds — bytes, not the commit's name.
//   approve TASK-N --human    the human takes it — judgment allowed, evidence not
//                             required beyond the seal itself.
//   approve tree --human      the human opens the decomposition gate.
//   approve tree              always refused — a wrong tree is the most expensive
//                             thing to build forty nodes on top of.
//
// Every check runs BEFORE any write. The two writes (task status, then record) are not
// one atomic operation, so an interrupted approval leaves task=advanced + record=pending
// — validate names that state, and re-running approve completes it (the repair path).
import { duplicateNestedKeys, nestedValue, splitLines, topValue, listItemCount, setFmValue } from './core.mjs'
import { writeAtomic } from './project.mjs'
import { taskEvidenceDigest, specDigest, treeDigest } from './cmd-pin.mjs'
import { dirtyResultSubject, git, repoState, ignoredState, resultSealBreach } from './git.mjs'
import { SourceEvidenceError, assertFindRound, parseSourcePacket, sourceScopeDigest, validateCompletedPacket } from './source-evidence.mjs'
import { TreeEvidenceError, TREE_EVIDENCE_MODES, treeEvidenceDigest } from './tree-evidence.mjs'

const say = s => process.stdout.write(s + '\n')
const hasTop = (text, key) => splitLines(text).some(line => new RegExp(`^${key}[ \\t]*:`).test(line))

// The last_test block, parsed: { command, exit, when, commit } — or null if none recorded.
export function lastTest (text) {
  if (!hasTop(text, 'last_test')) return null
  if (duplicateNestedKeys(text, 'last_test').length) return null
  const out = {}
  for (const key of ['command', 'exit', 'when', 'commit']) {
    const value = nestedValue(text, 'last_test', key)
    if (value !== '') out[key] = value.replace(/^"/, '').replace(/"$/, '')
  }
  return out
}

function upsertTop (text, key, value) {
  const lines = text.split('\n')
  const re = new RegExp(`^${key}[ \\t]*:`)
  const i = lines.findIndex(l => re.test(l.replace(/\r$/, '')))
  if (i === -1) return `${text.replace(/\n*$/, '')}\n${key}: ${value}\n`
  lines[i] = `${key}: ${value}${lines[i].endsWith('\r') ? '\r' : ''}`
  return lines.join('\n')
}

// New spec seals bind the completed source packet as well as the Task span.  Both
// fields are absent on legacy seals; when either is present, both are mandatory and
// the exact stored find round is re-opened.  Formatting/key-order edits do not matter,
// but every semantic packet field and every currently resolvable basis does.
function sourceEvidenceRefusal (P, target, recordText) {
  const digest = topValue(recordText, 'source_evidence_digest')
  const rawRound = topValue(recordText, 'source_evidence_round')
  const hasDigest = hasTop(recordText, 'source_evidence_digest')
  const hasRound = hasTop(recordText, 'source_evidence_round')
  if (!hasDigest && !hasRound) return null
  if (!hasDigest || !hasRound || digest === '' || rawRound === '') return 'source evidence seal is partial — source_evidence_digest and source_evidence_round must appear together with non-empty values'
  if (!/^[0-9a-f]{64}$/.test(digest)) return `source_evidence_digest '${digest}' is not a canonical sha256`
  if (!/^[1-9][0-9]*$/.test(rawRound) || !Number.isSafeInteger(Number(rawRound))) return `source_evidence_round '${rawRound}' is not a positive safe integer`
  const round = Number(rawRound)
  try {
    assertFindRound(target, recordText, round)
    const briefPath = P.verifyRoundBriefPath(target, round)
    const brief = P.read(briefPath)
    if (brief === null) throw new SourceEvidenceError(`${briefPath} missing`)
    const packet = parseSourcePacket(brief, briefPath)
    const current = validateCompletedPacket(P, target, packet, recordText)
    if (current !== digest) return 'completed source-evidence packet changed after pin — digest mismatch; re-run the spec gate'
  } catch (e) {
    if (!(e instanceof SourceEvidenceError)) throw e
    return `source evidence no longer validates: ${e.message}`
  }
  return null
}

// The decision gate on a record: passed, still pending, nothing left open.
// Returns an error string, or null when the record is decidable.
function recordUndecidable (P, path, label) {
  const text = P.read(path)
  if (text === null) return `no ${label} record (${path} missing) — run the cold gate first`
  const st = topValue(text, 'status')
  if (st !== 'passed') return `its ${label} record is '${st === '' ? 'unset' : st}', not passed — a gate that did not come out clean is never approved past`
  if (listItemCount(text, 'open_issues') > 0) return `its ${label} record still lists open issues — clear them (grovespec-fix), never approve past them`
  const ab = topValue(text, 'approved_by')
  if (ab === '') return `its ${label} record is legacy (no approved_by) — it binds nothing; re-run the gate to seal a fresh cycle`
  if (ab !== 'pending') return `its ${label} gate is already decided (approved_by: ${ab}) — a new decision needs a new cycle (grovespec-verify/-review, or reopen)`
  return null
}

function approveTree (P, human) {
  if (!human) {
    say('the tree gate is never machine-taken — look at the decomposition yourself, then: grovespec approve tree --human')
    return 2
  }
  const tp = P.treeYamlPath()
  const text = P.read(tp)
  if (text === null) { say(`no tree verify record (${tp} missing) — run grovespec-verify on the tree first`); return 2 }
  const err = recordUndecidable(P, tp, 'tree')
  if (err !== null) { say(`tree: ${err}`); return 2 }
  const sealed = topValue(text, 'tree_digest')
  if (sealed === '') { say('tree: record is unsealed (no tree_digest) — run grovespec pin tree at the cycle\'s pass'); return 2 }
  if (sealed !== treeDigest(P.treeText())) {
    say('tree: the structure changed after its cold verify — digest mismatch; re-run grovespec-verify on the tree (the reviewers did not see this shape)')
    return 2
  }
  if (hasTop(text, 'source_scope_digest')) {
    const scopeSeal = topValue(text, 'source_scope_digest')
    if (!/^[0-9a-f]{64}$/.test(scopeSeal)) {
      say(`tree: source_scope_digest '${scopeSeal}' is not a canonical sha256`)
      return 2
    }
    try {
      if (scopeSeal !== sourceScopeDigest(P)) {
        say('tree: Task ref assignments changed after the cold tree verify — source_scope_digest mismatch; re-run grovespec-verify on the tree')
        return 2
      }
    } catch (e) {
      if (!(e instanceof SourceEvidenceError)) throw e
      say(`tree: source scope no longer validates — ${e.message}`)
      return 2
    }
  }
  const hasEvidenceMode = hasTop(text, 'tree_evidence_mode')
  const hasEvidenceSeal = hasTop(text, 'tree_evidence_digest')
  if (!hasEvidenceMode && !hasEvidenceSeal) {
    say('tree: this pending legacy verdict has no tree evidence for the reviewed brief/Tasks/code — re-run grovespec-verify on the tree before approving it')
    return 2
  }
  if (hasEvidenceMode || hasEvidenceSeal) {
    const mode = topValue(text, 'tree_evidence_mode')
    const evidenceSeal = topValue(text, 'tree_evidence_digest')
    if (!hasEvidenceMode || !hasEvidenceSeal || mode === '' || evidenceSeal === '') {
      say('tree: tree evidence seal is partial — tree_evidence_mode and tree_evidence_digest must appear together with non-empty values')
      return 2
    }
    if (!TREE_EVIDENCE_MODES.includes(mode)) {
      say(`tree: tree_evidence_mode '${mode}' is invalid — use ${TREE_EVIDENCE_MODES.join('|')}`)
      return 2
    }
    if (!/^[0-9a-f]{64}$/.test(evidenceSeal)) {
      say(`tree: tree_evidence_digest '${evidenceSeal}' is not a canonical sha256`)
      return 2
    }
    try {
      if (evidenceSeal !== treeEvidenceDigest(P, mode)) {
        say('tree: a reviewed tree input changed after the cold verify — tree_evidence_digest mismatch; re-run grovespec-verify on the tree')
        return 2
      }
    } catch (e) {
      if (!(e instanceof TreeEvidenceError)) throw e
      say(`tree: reviewed evidence no longer validates — ${e.message}`)
      return 2
    }
  }
  writeAtomic(tp, upsertTop(text, 'approved_by', 'human'))
  P.forget()
  say('tree approved by you — the decomposition gate is open; the per-node build begins')
  return 0
}

export function cmdApprove (P, n, human) {
  if (n === '') { say('usage: grovespec approve TASK-N [--human] | approve tree --human'); return 2 }
  if (n === 'tree') return approveTree(P, human)

  const taskText = P.read(P.taskPath(n))
  if (taskText === null) { say(`no such node: ${n}`); return 2 }

  const st = P.statusOf(n)
  let record, target, label
  if (st === 'draft' || st === 'approved') { record = P.verifyYamlPath(n); target = 'approved'; label = 'spec' }
  else if (st === 'reviewed' || st === 'done') { record = P.reviewYamlPath(n); target = 'done'; label = 'result' }
  else {
    say(`${n}: no gate is due at status '${st}' — approve decides a sealed pass (draft → approved, reviewed → done)`)
    return 2
  }
  const repairing = st === target                          // interrupted earlier: task moved, record didn't

  // ---- every check, before any write ----
  const err = recordUndecidable(P, record, label)
  if (err !== null) { say(`${n}: ${err}`); return 2 }
  const text = P.read(record)

  const sealed = topValue(text, 'spec_digest')
  if (sealed === '') { say(`${n}: its ${label} record is unsealed (no spec_digest) — run grovespec pin ${n} at the cycle's pass`); return 2 }
  const cur = specDigest(taskText)
  if (cur === null) { say(`${n}: cannot digest — Overview…AC sections malformed (run grovespec validate)`); return 2 }
  if (sealed !== cur) {
    say(`${n}: the spec changed after its ${label} cycle passed — digest mismatch; the verdict does not cover these bytes (re-run the gate; grovespec-revise if the change was deliberate)`)
    return 2
  }
  const taskSeal = topValue(text, 'task_evidence_digest')
  if (taskSeal === '') {
    say(`${n}: this pending legacy ${label} verdict has no task_evidence_digest — re-run grovespec-${label === 'spec' ? 'verify' : 'review'} before approving it`)
    return 2
  }
  if (!/^[0-9a-f]{64}$/.test(taskSeal)) {
    say(`${n}: task_evidence_digest '${taskSeal}' is not a canonical sha256`)
    return 2
  }
  if (taskSeal !== taskEvidenceDigest(taskText)) {
    say(`${n}: Task evidence changed after the ${label} pass — task_evidence_digest mismatch; re-run grovespec-${label === 'spec' ? 'verify' : 'review'}`)
    return 2
  }

  if (label === 'spec') {
    const sourceErr = sourceEvidenceRefusal(P, n, text)
    if (sourceErr !== null) { say(`${n}: ${sourceErr}`); return 2 }
  }

  if (label === 'result') {
    const rs = repoState(P.root)
    if (rs === 'broken') { say(`${n}: git did not answer (missing or failing git) — a result approval binds to history that cannot be read right now`); return 2 }
    if (rs === 'none') { say(`${n}: not a git repository — a result approval is bound to the reviewed commit`); return 2 }
    // Checked here too, not only at the seal: a record pinned before this check existed
    // already carries the foreign commit, and comparing it to that same foreign HEAD is
    // the free pass this refuses.
    const ig = ignoredState(P.root)
    if (ig === 'broken') { say(`${n}: git check-ignore did not answer — whether this project is gateable cannot be established, so nothing was approved`); return 2 }
    if (ig === 'yes') { say(`${n}: this project sits inside a git repository that ignores it — the reviewed commit names a history no change to this code can move, so matching it proves nothing. Give the project its own repository (git init) and re-run the gate`); return 2 }
    const head = git(P.root, ['rev-parse', 'HEAD'])
    if (!head.ok) { say(`${n}: cannot resolve HEAD`); return 2 }
    const rc = topValue(text, 'reviewed_commit')
    if (rc === '') { say(`${n}: its result record is unsealed (no reviewed_commit) — run grovespec pin ${n} at the cycle's pass`); return 2 }
    if (rc !== head.out.trim()) {
      const breach = resultSealBreach(P, n, rc)
      if (breach !== null) { say(`${n}: the review verdict no longer covers HEAD — ${breach}; re-run grovespec-review`); return 2 }
    }
    // Human judgment can decide a clean reviewed result, but it cannot make a commit
    // seal cover uncommitted bytes. Pin and both approval modes share this exact check.
    const dirty = dirtyResultSubject(P, n)
    if (dirty === null) { say(`${n}: cannot verify the tree is clean (git status failed) — an unverified tree is not a clean one`); return 2 }
    if (dirty.length) {
      say(`${n}: uncommitted project changes outside this gate's Task/review evidence — the reviewed input is not the current input:`)
      for (const d of dirty) say(`  ${d}`)
      return 2
    }
    if (!human) {
      // The machine may only take a gate on machine-verifiable evidence: a recorded
      // test run, green, bound to exactly the code being approved.
      const lt = lastTest(text)
      if (lt === null) { say(`${n}: no recorded test run — run grovespec test ${n}; a machine approves only on machine evidence (a human may confirm on judgment: --human)`); return 2 }
      if (lt.exit !== '0') { say(`${n}: the recorded test run did not pass (exit ${lt.exit ?? 'unknown'}) — fix and re-run grovespec test ${n}`); return 2 }
      if (!lt.commit) { say(`${n}: the recorded test run is not bound to a commit (legacy record) — re-run grovespec test ${n}`); return 2 }
      if (lt.commit !== head.out.trim()) {
        const breach = resultSealBreach(P, n, lt.commit)
        if (breach !== null) { say(`${n}: the recorded test run no longer covers HEAD — ${breach}; re-run grovespec test ${n}`); return 2 }
      }
    }
  }

  // ---- writes: task first, record second (approve re-run completes an interruption) ----
  if (!repairing) {
    const flipped = setFmValue(taskText, 'status', target)
    if (flipped === null) { say(`${n}: cannot set status — frontmatter malformed (run grovespec validate)`); return 2 }
    writeAtomic(P.taskPath(n), flipped)
  }
  writeAtomic(record, upsertTop(text, 'approved_by', human ? 'human' : 'machine'))
  P.forget()

  if (human) say(`approved by you: ${n} ${repairing ? `(finishing an interrupted approval at ${st})` : `${st} → ${target}`} (${label} gate)`)
  else say(`approved by machine: ${n} ${repairing ? `(finishing an interrupted approval at ${st})` : `${st} → ${target}`} (${label} gate) — NOT human-approved; ratify it when you have looked`)
  return 0
}

export function cmdRatify (P, ids) {
  if (!ids.length) { say('usage: grovespec ratify TASK-N [TASK-M ...]'); return 2 }
  const work = []
  for (const n of ids) {
    if (P.read(P.taskPath(n)) === null) { say(`no such node: ${n} — nothing was ratified`); return 2 }
    const labels = P.unratified(n)
    if (!labels.length) { say(`${n}: nothing to ratify (no machine-taken gate on record) — nothing was ratified`); return 2 }
    work.push([n, labels])
  }
  for (const [n, labels] of work) {
    for (const label of labels) {
      const p = label === 'spec' ? P.verifyYamlPath(n) : P.reviewYamlPath(n)
      writeAtomic(p, upsertTop(P.read(p), 'approved_by', 'human'))
    }
    say(`ratified: ${n} (${labels.join(' · ')})`)
  }
  P.forget()
  return 0
}
