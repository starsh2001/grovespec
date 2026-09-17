// pin — the SEAL step of a gate: run at the moment a cold cycle passes, it binds the
// verdict to the exact bytes it was passed on, and marks the verdict `approved_by:
// pending` — a verdict exists, nobody has decided on it. `approve` later COMPARES these
// bindings and only flips states; it writes no evidence of its own.
//
//   pin TASK-N   at spec pass (task draft):    spec_digest
//                                               + task_evidence_digest
//                                               + source_evidence_digest
//                                               + source_evidence_round  → <id>.verify.yaml
//                at result pass (task reviewed): reviewed_commit (HEAD)
//                                               + spec_digest
//                                               + task_evidence_digest  → <id>.review.yaml
//   pin tree     at tree pass:                 tree_digest (canonical structure)
//                                               + source_scope_digest
//                                               + tree_evidence_mode
//                                               + tree_evidence_digest   → tree.verify.yaml
//
// Seals are write-once per cold cycle. A re-pin is an idempotent proof that the existing
// seal still covers current state; it never refreshes evidence or attaches a new seal to
// an already-advanced node. Changed state requires a fresh verify/review cycle.
import { createHash } from 'node:crypto'
import { duplicateFrontmatterKeys, isFence, splitLines, treeRows, topValue } from './core.mjs'
import { writeAtomic } from './project.mjs'
import { dirtyResultSubject, git, repoState, ignoredState, resultSealBreach } from './git.mjs'
import { SourceEvidenceError, assertFindRound, latestFindRound, parseSourcePacket, sourceScopeDigest, specDigest, validateCompletedPacket } from './source-evidence.mjs'
import { TreeEvidenceError, TREE_EVIDENCE_MODES, treeEvidenceDigest, treeEvidenceMode } from './tree-evidence.mjs'

export { specDigest } from './source-evidence.mjs'

const say = s => process.stdout.write(s + '\n')
const hasTop = (text, key) => splitLines(text).some(line => new RegExp(`^${key}[ \\t]*:`).test(line))

// The tree digest covers the parsed STRUCTURE (id + parent per node), not the file's
// bytes — indentation style and comments don't invalidate an approval; a moved, added
// or removed node does. Names/roles live in Task files and may change without this.
export function treeDigest (treeText) {
  const canon = treeRows(treeText).map(r => `${r.tid}\t${r.parent}`).join('\n')
  return createHash('sha256').update(canon, 'utf8').digest('hex')
}

// Gate-relevant Task frontmatter controls routing and execution but lives outside
// spec_digest. Normalize only status (the gate itself advances it), then bind the
// complete frontmatter. Subtasks/Change Log remain intentionally mutable; the
// Overview→AC contract is already bound separately by spec_digest.
export function taskEvidenceDigest (taskText) {
  const lines = splitLines(taskText)
  if (!isFence(lines[0] ?? '')) return null
  const end = lines.findIndex((line, i) => i > 0 && isFence(line))
  if (end === -1) return null
  if (duplicateFrontmatterKeys(taskText).length) return null
  const hits = []
  for (let i = 1; i < end; i++) if (/^status[ \t]*:/.test(lines[i])) hits.push(i)
  if (hits.length !== 1) return null
  lines[hits[0]] = 'status: <gate-state>'
  return createHash('sha256')
    .update(`grovespec-task-evidence/v1\n${lines.slice(0, end + 1).join('\n')}`, 'utf8')
    .digest('hex')
}

function upsertTop (text, kv) {                 // replace or append top-level `key: value` lines
  let lines = splitLines(text)
  for (const [key, value] of Object.entries(kv)) {
    const re = new RegExp(`^${key}[ \\t]*:`)
    const i = lines.findIndex(l => re.test(l))
    if (i === -1) lines = lines.concat([`${key}: ${value}`])
    else lines[i] = `${key}: ${value}`
  }
  return lines.join('\n') + '\n'
}

function existingSourceSealRefusal (P, target, text) {
  const hasDigest = hasTop(text, 'source_evidence_digest')
  const hasRound = hasTop(text, 'source_evidence_round')
  if (!hasDigest && !hasRound) return null
  const digest = topValue(text, 'source_evidence_digest')
  const rawRound = topValue(text, 'source_evidence_round')
  if (!hasDigest || !hasRound || digest === '' || rawRound === '') {
    return 'source evidence seal is partial -- source_evidence_digest and source_evidence_round must appear together with non-empty values'
  }
  if (!/^[0-9a-f]{64}$/.test(digest)) return `source_evidence_digest '${digest}' is not a canonical sha256`
  if (!/^[1-9][0-9]*$/.test(rawRound) || !Number.isSafeInteger(Number(rawRound))) {
    return `source_evidence_round '${rawRound}' is not a positive safe integer`
  }
  try {
    const round = Number(rawRound)
    assertFindRound(target, text, round)
    const briefPath = P.verifyRoundBriefPath(target, round)
    const brief = P.read(briefPath)
    if (brief === null) throw new SourceEvidenceError(`${briefPath} missing`)
    const packet = parseSourcePacket(brief, briefPath)
    const current = validateCompletedPacket(P, target, packet, text)
    if (current !== digest) return 'completed source-evidence packet changed after pin -- digest mismatch; restart the verify cycle'
  } catch (e) {
    if (!(e instanceof SourceEvidenceError)) throw e
    return `source evidence no longer validates: ${e.message}`
  }
  return null
}

export function cmdPin (P, n) {
  if (n === '') { say('usage: grovespec pin TASK-N | pin tree'); return 2 }

  if (n === 'tree') {
    const tp = P.treeYamlPath()
    const tt = P.read(tp)
    if (tt === null) { say(`no tree verify record to pin (${tp} missing) — run grovespec-verify on the tree first`); return 2 }
    const digest = treeDigest(P.treeText())
    let scopeDigest
    try { scopeDigest = sourceScopeDigest(P) } catch (e) {
      if (!(e instanceof SourceEvidenceError)) throw e
      say(`tree: source scope refused — ${e.message}; nothing was written`)
      return 2
    }
    const hasTreeSeal = hasTop(tt, 'tree_digest')
    const hasScopeSeal = hasTop(tt, 'source_scope_digest')
    const hasEvidenceMode = hasTop(tt, 'tree_evidence_mode')
    const hasEvidenceSeal = hasTop(tt, 'tree_evidence_digest')
    const oldTreeSeal = topValue(tt, 'tree_digest')
    const oldScopeSeal = topValue(tt, 'source_scope_digest')
    const decided = topValue(tt, 'approved_by')
    // tree_evidence_mode is also the cycle's early routing marker.  The tree skill
    // writes it before round 1 so an interrupted/reopened built tree cannot fall back
    // to the one-time pristine-mapped fidelity route.  Its digest joins only at pin.
    const modeSeedOnly = hasEvidenceMode && !hasEvidenceSeal && !hasTreeSeal && !hasScopeSeal
    if (modeSeedOnly && !TREE_EVIDENCE_MODES.includes(topValue(tt, 'tree_evidence_mode'))) {
      say(`tree: tree_evidence_mode '${topValue(tt, 'tree_evidence_mode')}' is invalid — use ${TREE_EVIDENCE_MODES.join('|')}; nothing was written`)
      return 2
    }
    if ((hasTreeSeal || hasScopeSeal || hasEvidenceMode || hasEvidenceSeal) && !modeSeedOnly) {
      if (hasEvidenceMode !== hasEvidenceSeal ||
          (hasEvidenceMode && (topValue(tt, 'tree_evidence_mode') === '' || topValue(tt, 'tree_evidence_digest') === ''))) {
        say('tree: tree evidence seal is partial — tree_evidence_mode and tree_evidence_digest must appear together with non-empty values; nothing was overwritten; restart the tree verify cycle')
        return 2
      }
      if (hasTreeSeal && hasScopeSeal && oldTreeSeal === digest && oldScopeSeal === scopeDigest) {
        if (hasEvidenceMode) {
          const mode = topValue(tt, 'tree_evidence_mode')
          const evidenceSeal = topValue(tt, 'tree_evidence_digest')
          if (!TREE_EVIDENCE_MODES.includes(mode)) {
            say(`tree: tree_evidence_mode '${mode}' is invalid — use ${TREE_EVIDENCE_MODES.join('|')}; nothing was overwritten`)
            return 2
          }
          if (!/^[0-9a-f]{64}$/.test(evidenceSeal)) {
            say(`tree: tree_evidence_digest '${evidenceSeal}' is not a canonical sha256; nothing was overwritten`)
            return 2
          }
          // Once the human decided the gate this is historical evidence.  Before that
          // moment, an idempotent re-pin must still prove the reviewed input is current.
          if (decided !== 'human' && decided !== 'machine') {
            let currentEvidence
            try { currentEvidence = treeEvidenceDigest(P, mode) } catch (e) {
              if (!(e instanceof TreeEvidenceError)) throw e
              say(`tree: reviewed evidence no longer validates — ${e.message}; nothing was overwritten`)
              return 2
            }
            if (currentEvidence !== evidenceSeal) {
              say('tree: reviewed evidence changed after the cold tree verify — tree_evidence_digest mismatch; nothing was overwritten; restart the tree verify cycle')
              return 2
            }
          }
          say(`already pinned: tree_digest ${digest.slice(0, 12)}… + source_scope_digest ${scopeDigest.slice(0, 12)}… + tree_evidence_digest ${evidenceSeal.slice(0, 12)}… — unchanged; no evidence was rewritten`)
          return 0
        }
        if (decided === 'human' || decided === 'machine') {
          say(`already pinned: decided legacy tree/source-scope seal ${digest.slice(0, 12)}… + ${scopeDigest.slice(0, 12)}… — tree evidence remains absent; no evidence was backfilled or rewritten`)
          return 0
        }
        say('tree: a pending legacy seal has no tree evidence for the reviewed brief/Tasks/code — it cannot be backfilled under the old verdict; restart the tree verify cycle')
        return 2
      }
      if (hasTreeSeal && !hasScopeSeal && !hasEvidenceMode && !hasEvidenceSeal && oldTreeSeal === digest) {
        if (decided === 'human' || decided === 'machine') {
          say('pinned: decided legacy tree_digest is unchanged — source_scope_digest and tree evidence remain absent; no evidence was backfilled or rewritten')
          return 0
        }
        say('tree: a pending legacy tree_digest binds neither source scope nor the reviewed tree inputs — restart the tree verify cycle; no evidence was backfilled')
        return 2
      }
      say('tree: refused to overwrite an existing tree/source-scope/evidence seal that differs or is partial — start a fresh tree verify cycle before pinning the new reviewed input')
      return 2
    }
    if (decided === 'human' || decided === 'machine') {
      say(`tree: the unsealed record is already decided (approved_by: ${decided}) — pin will not attach new evidence to an old approval; start a fresh tree verify cycle`)
      return 2
    }
    const mode = modeSeedOnly ? topValue(tt, 'tree_evidence_mode') : treeEvidenceMode(P)
    let evidenceDigest
    try { evidenceDigest = treeEvidenceDigest(P, mode) } catch (e) {
      if (!(e instanceof TreeEvidenceError)) throw e
      say(`tree: reviewed evidence refused — ${e.message}; nothing was written`)
      return 2
    }
    const kv = {
      tree_digest: digest,
      source_scope_digest: scopeDigest,
      tree_evidence_mode: mode,
      tree_evidence_digest: evidenceDigest
    }
    if (topValue(tt, 'approved_by') === '') kv.approved_by = 'pending'
    writeAtomic(tp, upsertTop(tt, kv))
    P.forget()
    say(`pinned: tree_digest ${digest.slice(0, 12)}… + source_scope_digest ${scopeDigest.slice(0, 12)}… + tree_evidence_digest ${evidenceDigest.slice(0, 12)}… (${mode}) → ${tp} (all reviewed tree inputs sealed; awaiting your approval)`)
    return 0
  }

  const taskText = P.read(P.taskPath(n))
  if (taskText === null) { say(`no such node: ${n}`); return 2 }
  const st = P.statusOf(n)
  const digest = specDigest(taskText)
  if (digest === null) { say(`${n}: cannot digest — Overview…AC sections malformed (run grovespec validate)`); return 2 }
  const taskDigest = taskEvidenceDigest(taskText)
  if (taskDigest === null) { say(`${n}: cannot digest the Task evidence — frontmatter/status malformed (run grovespec validate)`); return 2 }

  if (st === 'draft' || st === 'approved') {
    const vp = P.verifyYamlPath(n)
    const vt = P.read(vp)
    if (vt === null) { say(`${n}: no verify record to pin (${vp} missing) — run grovespec-verify first`); return 2 }
    const hasSpecSeal = hasTop(vt, 'spec_digest')
    const hasTaskSeal = hasTop(vt, 'task_evidence_digest')
    const sealed = topValue(vt, 'spec_digest')
    const sealedTask = topValue(vt, 'task_evidence_digest')
    const isDecided = topValue(vt, 'approved_by') === 'human' || topValue(vt, 'approved_by') === 'machine'
    if (hasSpecSeal) {
      if (sealed === '' || sealed !== digest) {
        say(`${n}: stale ${st} spec_digest does not cover the current spec — refused to overwrite it; restart the verify cycle`)
        return 2
      }
      const sourceErr = existingSourceSealRefusal(P, n, vt)
      if (sourceErr !== null) {
        say(`${n}: ${sourceErr}; nothing was overwritten`)
        return 2
      }
      if (hasTaskSeal) {
        if (!/^[0-9a-f]{64}$/.test(sealedTask) || (!isDecided && sealedTask !== taskDigest)) {
          say(`${n}: Task evidence changed or is malformed after the spec pin — task_evidence_digest mismatch; nothing was overwritten; restart the verify cycle`)
          return 2
        }
      } else if (topValue(vt, 'approved_by') === 'pending') {
        say(`${n}: a pending legacy spec seal has no task_evidence_digest — it cannot be backfilled under the old verdict; restart the verify cycle`)
        return 2
      }
      const taskNote = hasTaskSeal
        ? ` + task_evidence_digest ${sealedTask.slice(0, 12)}…${isDecided && sealedTask !== taskDigest ? ' (historical decision input)' : ''}`
        : ' (legacy Task evidence absent)'
      say(`pinned: ${n} spec_digest ${digest.slice(0, 12)}…${taskNote} was already sealed and is unchanged; no evidence was rewritten`)
      return 0
    }
    if (hasTop(vt, 'source_evidence_digest') || hasTop(vt, 'source_evidence_round') || hasTaskSeal) {
      say(`${n}: source/Task evidence fields exist without spec_digest — the seal is partial; nothing was overwritten; restart the verify cycle`)
      return 2
    }
    if (st === 'approved') {
      say(`${n}: approved spec has no seal — pin will not attach new evidence after the decision; reopen to draft and run a fresh verify cycle`)
      return 2
    }
    const decided = topValue(vt, 'approved_by')
    if (decided === 'human' || decided === 'machine') {
      say(`${n}: the unsealed draft record is already decided (approved_by: ${decided}) — pin will not attach new evidence to an old decision; restart the verify cycle`)
      return 2
    }
    let sourceSeal
    try {
      const sourceRound = latestFindRound(n, vt)
      const briefPath = P.verifyRoundBriefPath(n, sourceRound)
      const brief = P.read(briefPath)
      if (brief === null) throw new SourceEvidenceError(`${briefPath} missing — pin reads exactly the highest rounds[] find brief`)
      const packet = parseSourcePacket(brief, briefPath)
      sourceSeal = { round: sourceRound, digest: validateCompletedPacket(P, n, packet, vt) }
    } catch (e) {
      if (!(e instanceof SourceEvidenceError)) throw e
      say(`${n}: source evidence refused — ${e.message}; nothing was written`)
      return 2
    }
    const kv = {
      spec_digest: digest,
      task_evidence_digest: taskDigest,
      source_evidence_digest: sourceSeal.digest,
      source_evidence_round: sourceSeal.round
    }
    if (topValue(vt, 'approved_by') === '') kv.approved_by = 'pending'
    writeAtomic(vp, upsertTop(vt, kv))
    P.forget()
    say(`pinned: ${n} spec_digest ${digest.slice(0, 12)}… + task_evidence_digest ${taskDigest.slice(0, 12)}… + source evidence round ${sourceSeal.round} ${sourceSeal.digest.slice(0, 12)}… → ${vp}`)
    return 0
  }
  if (st === 'reviewed' || st === 'done') {
    const rp = P.reviewYamlPath(n)
    const rt = P.read(rp)
    if (rt === null) { say(`${n}: no review record to pin (${rp} missing) — run grovespec-review first`); return 2 }
    const rs = repoState(P.root)
    if (rs === 'broken') { say('git did not answer (missing or failing git) — a review pin records a commit that cannot be read right now'); return 2 }
    if (rs === 'none') { say('not a git repository — a review pin records the reviewed commit'); return 2 }
    const ig = ignoredState(P.root)
    if (ig === 'broken') { say('git check-ignore did not answer — whether this project is gateable cannot be established, so nothing was sealed'); return 2 }
    if (ig === 'yes') { say('this project sits inside a git repository that ignores it — the commit a review pin would record is one no change to this code can move, so the seal would cover bytes it never saw. Give the project its own repository (git init) and commit its code first'); return 2 }
    const head = git(P.root, ['rev-parse', 'HEAD'])
    if (!head.ok) { say('cannot resolve HEAD — nothing committed yet?'); return 2 }
    const commit = head.out.trim()
    const dirty = dirtyResultSubject(P, n)
    if (dirty === null) { say(`${n}: cannot verify the reviewed project input is clean (git status failed) — nothing was sealed`); return 2 }
    if (dirty.length) {
      say(`${n}: uncommitted project changes outside this gate's Task/review evidence — a review seal covers committed bytes, not these working bytes; nothing was sealed:`)
      for (const line of dirty) say(`  ${line}`)
      return 2
    }
    const hasSpecSeal = hasTop(rt, 'spec_digest')
    const hasCommitSeal = hasTop(rt, 'reviewed_commit')
    const hasTaskSeal = hasTop(rt, 'task_evidence_digest')
    const sealedSpec = topValue(rt, 'spec_digest')
    const sealedCommit = topValue(rt, 'reviewed_commit')
    const sealedTask = topValue(rt, 'task_evidence_digest')
    const isDecided = topValue(rt, 'approved_by') === 'human' || topValue(rt, 'approved_by') === 'machine'
    if (hasSpecSeal) {
      if (!hasCommitSeal || sealedSpec === '' || sealedCommit === '' || (hasTaskSeal && sealedTask === '')) {
        say(`${n}: result seal is partial — spec_digest, reviewed_commit, and any task_evidence_digest must be non-empty; nothing was overwritten; restart the review cycle`)
        return 2
      }
      if (sealedSpec !== digest) {
        say(`${n}: existing result spec_digest does not cover the current spec — nothing was overwritten; re-run grovespec-review`)
        return 2
      }
      const breach = sealedCommit === commit ? null : resultSealBreach(P, n, sealedCommit)
      if (breach !== null) {
        say(`${n}: existing review seal no longer covers HEAD — ${breach}; nothing was overwritten; re-run grovespec-review`)
        return 2
      }
      if (hasTaskSeal) {
        if (!/^[0-9a-f]{64}$/.test(sealedTask)) {
          say(`${n}: task_evidence_digest '${sealedTask}' is not a canonical sha256; nothing was overwritten`)
          return 2
        }
        if (!isDecided && sealedTask !== taskDigest) {
          say(`${n}: Task evidence changed after the result pin — task_evidence_digest mismatch; nothing was overwritten; re-run grovespec-review`)
          return 2
        }
      } else if (topValue(rt, 'approved_by') === 'pending') {
        say(`${n}: a pending legacy result seal has no task_evidence_digest — it cannot be backfilled under the old verdict; restart the review cycle`)
        return 2
      }
      const taskNote = hasTaskSeal
        ? ` + task_evidence_digest ${sealedTask.slice(0, 12)}…${isDecided && sealedTask !== taskDigest ? ' (historical decision input)' : ''}`
        : ' (legacy Task evidence absent)'
      say(`already pinned: ${n} reviewed_commit ${sealedCommit.slice(0, 7)} + spec_digest ${digest.slice(0, 12)}…${taskNote} — current reviewed product input is still covered; no evidence was rewritten`)
      return 0
    }
    if (st === 'done') {
      say(`${n}: done result has no complete spec/result seal — pin will not attach new evidence after the decision; reopen to approved and run a fresh review cycle`)
      return 2
    }
    if (hasTop(rt, 'spec_digest') || hasTaskSeal || (hasCommitSeal && sealedCommit === '')) {
      say(`${n}: result seal is partial — nothing was overwritten; restart the review cycle`)
      return 2
    }
    const decided = topValue(rt, 'approved_by')
    if (decided === 'human' || decided === 'machine') {
      say(`${n}: the unsealed review record is already decided (approved_by: ${decided}) — pin will not attach new evidence to an old decision; restart the review cycle`)
      return 2
    }
    const kv = { reviewed_commit: commit, spec_digest: digest, task_evidence_digest: taskDigest }
    if (st === 'reviewed' && topValue(rt, 'approved_by') === '') kv.approved_by = 'pending'
    writeAtomic(rp, upsertTop(rt, kv))
    P.forget()
    say(`pinned: ${n} reviewed_commit ${commit.slice(0, 7)} + spec_digest ${digest.slice(0, 12)}… + task_evidence_digest ${taskDigest.slice(0, 12)}… → ${rp}`)
    return 0
  }
  say(`${n}: nothing to pin at status '${st}' — pin seals a cycle's pass (draft/approved for spec, reviewed/done for result)`)
  return 2
}
