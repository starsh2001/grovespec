// amend — a documentation-only edit to a SEALED node, absorbed in place (v0.17.0).
// Measured on the launcher: a two-item revise cost 48
// commits across 12 nodes while exactly ONE node changed code — three of those
// nodes reran full verify cycles because a gap sentence became a decided sentence,
// i.e. because the seal binds the whole Overview→AC span and any byte move forced
// draft. The user's rule splits the cases: an edit that leaves the binding
// surfaces — Contract (what consumers read) and AC (what verification measures) —
// UNTOUCHED is documentation, and documentation ends here: re-seal, record, done
// stays done, dependents untouched.
//
// The proof, not the promise:
//   · Contract and AC are compared BYTE-FOR-BYTE against HEAD's version of the Task.
//     v0.17.0 shipped a content normalization here (list markers, wrapping,
//     whitespace collapsed) and the external review broke it the same day: the
//     normalization erased meaningful bytes inside inline code and fenced blocks —
//     `"a  b"` → `"a b"` re-sealed as "same content". The class is the normalization
//     existing at all, so it is deleted, not patched: equality the machine can prove
//     is bytes; anything looser — even a re-wrap — takes a lane, where the only cost
//     is checking.
//   · AC bytes changed → REFUSED toward the node's own gates (reopen draft;
//     dependents stay out — consumers read the Contract, not the AC).
//   · Contract bytes changed → REFUSED toward grovespec-revise (the candidate
//     lane: dependents become recheck candidates, never mass reopens).
//   · A sealed source-evidence packet binds anchors (Contract:n/AC:n/Change Log:n/
//     finding/adjudication) and their content, and `validate` re-proves the packet
//     continuously — so amend must leave it provably consistent, not merely
//     untouched. The one packet field a documentation edit legitimately moves is its
//     spec digest; everything else must hold. Prove, then update: the full packet
//     validator runs with the spec digest taken as current (target · scope · source
//     roster · anchors all still checked), and the digest over (old packet + today's
//     resolved anchor content) must still equal the seal — then the packet is
//     re-sealed with the new spec digest (brief and verify.yaml in the same move).
//     A moved anchor (an edited Change Log line a verdict was pinned to) or a moved
//     ref document refuses, before anything is written.
//   · A refs-only change (v0.24.0) retires the packet instead: it described the old
//     source assignment, and the tree gate — re-verified because the assignment moved —
//     carries the new one. Contract·AC bytes still bind. Refusing sent a plan that only
//     reassigned sources to reopen 9 nodes to draft, and verify rewrote 8 of them.
//
// --simple "<verdict>" (v0.24.0) is the tier between documentation and the lanes: the
// bytes moved, the meaning and behavior did not — a rename, a reworded clause, dead code
// removed. Declaring it costs a free machine guard and one cold question, and a wrong
// declaration only escalates, never skips a check: AC bytes must hold (else the own
// gates); moved code must pass the project's tests (else reopen approved); and the
// caller's one cold reviewer has answered "did meaning or behavior change?" with no — its
// verdict is this command's argument. The Contract may move under it, and a sealed packet
// is re-bound to its anchors' new wording (they must still resolve). Measured: a spec
// rename was left standing in done Contracts rather than pay the contract lane, and three
// one-line constant deletions cost 14 sessions, 21 commits and 0.71M tokens through
// reopen approved. Equality the machine can prove stays bytes; this tier is a judged one.
import { spawnSync } from 'node:child_process'
import { git, repoState, dirtyResultSubject } from './git.mjs'
import { testCommand } from './cmd-test.mjs'
import { releaseOnDone, endStepMark } from './cmd-claim.mjs'
import { writeAtomic } from './project.mjs'
import { markdownStructureLines, topValue } from './core.mjs'
import { specDigest, taskEvidenceDigest } from './cmd-pin.mjs'
import {
  SourceEvidenceError, assertFindRound, briefWithPacketSpecDigest,
  completedPacketDigest, parseSourcePacket, resolvePacketBases, taskRefAssignment, validateCompletedPacket
} from './source-evidence.mjs'

const say = s => process.stdout.write(s + '\n')
const SEALED = ['approved', 'implemented', 'reviewed', 'fixed', 'done']

// One `## <name>` section's raw lines (heading excluded), by the same heading rules
// the rest of the runtime reads with. Comparison is the joined lines verbatim —
// line-ending form aside (splitLines strips \r), NOTHING is normalized away.
function sectionText (text, name) {
  const scanned = markdownStructureLines(text)
  if (scanned.problem !== null) return null
  const lines = scanned.lines
  const start = lines.findIndex(e => e.headingEligible && new RegExp(`^##[ \\t]+${name}[ \\t]*$`).test(e.line))
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].headingEligible && /^##[ \t]+/.test(lines[i].line)) { end = i; break }
  }
  return lines.slice(start + 1, end).map(e => e.line).join('\n')
}

// Replace the seal lines in a record, byte-surgical on those lines only.
function resealed (recordText, spec, task, source = null) {
  let t = recordText
  if (new RegExp('^spec_digest[ \\t]*:', 'm').test(t)) t = t.replace(/^spec_digest[ \t]*:.*$/m, `spec_digest: ${spec}`)
  if (new RegExp('^task_evidence_digest[ \\t]*:', 'm').test(t)) t = t.replace(/^task_evidence_digest[ \t]*:.*$/m, `task_evidence_digest: ${task}`)
  if (source !== null && new RegExp('^source_evidence_digest[ \\t]*:', 'm').test(t)) t = t.replace(/^source_evidence_digest[ \t]*:.*$/m, `source_evidence_digest: ${source}`)
  return t
}

export function cmdAmend (P, n, simple = null) {
  if (n === '' || (simple !== null && simple.trim() === '')) {
    say('usage: grovespec amend TASK-N — absorb a documentation-only edit to a sealed node (Contract·AC byte-identical)')
    say('       grovespec amend TASK-N --simple "<the cold verdict: meaning and behavior unchanged, and why>" — bytes moved, meaning did not (AC must hold; moved code must pass the tests)')
    return 2
  }
  const taskPath = P.taskPath(n)
  const taskText = P.read(taskPath)
  if (taskText === null) { say(`no such node: ${n}`); return 2 }
  const st = P.statusOf(n)
  if (!SEALED.includes(st)) { say(`${n} is ${st || 'unknown'} — nothing is sealed at this status; just edit the text (the gate that seals it has not run)`); return 2 }
  if (repoState(P.root) !== 'repo') { say('amend compares the edit against HEAD — this needs a git repository'); return 2 }

  const rel = taskPath.startsWith(`${P.root}/`) ? taskPath.slice(P.root.length + 1) : taskPath
  const head = git(P.root, ['show', `HEAD:${rel}`])
  if (!head.ok) { say(`${n}: HEAD has no ${rel} — a Task never committed has no sealed baseline to amend against`); return 2 }

  // The binding surfaces, byte-compared. Which surface moved decides the lane.
  let contractMoved = false
  for (const name of ['Contract', 'AC']) {
    const now = sectionText(taskText, name)
    const was = sectionText(head.out, name)
    if (now === null || was === null) { say(`${n}: the ${name} section cannot be read on one side — repair the section structure first (grovespec validate)`); return 2 }
    if (now !== was) {
      if (name === 'Contract' && simple !== null) { contractMoved = true; continue }
      if (name === 'Contract') {
        say(`${n}: the Contract bytes changed — that is not a documentation edit, it is the contract lane. Even a re-wrap goes here: equality the machine can prove is bytes, and the lane's only cost is checking.`)
        say('→ grovespec-revise: reopen this node, and its dependents become recheck candidates (grovespec recheck declare), never mass reopens. If the wording moved and the meaning did not (a rename), the simple tier asks one cold question instead: grovespec amend ' + n + ' --simple "<verdict>".')
      } else {
        say(`${n}: the AC bytes changed — an edit that touches what verification measures is not documentation.`)
        say('→ the node\'s own gates: grovespec reopen ' + n + ' draft, then verify → implement → review. Dependents stay untouched — consumers read the Contract, and the Contract did not move.')
      }
      return 1
    }
  }

  const spec = specDigest(taskText)
  const task = taskEvidenceDigest(taskText)
  if (spec === null || task === null) { say(`${n}: the edited Task cannot be digested (malformed sections or frontmatter) — run grovespec validate`); return 2 }

  // Evidence safety + consistency: prove the sealed packet's anchors still resolve
  // to the sealed content, then carry the packet along — its spec digest is the one
  // field this edit moves, and validate re-proves the packet continuously, so a
  // stale packet left behind would fail the very next validate.
  const vp = P.verifyYamlPath(n)
  const vt = P.read(vp)
  let packetSeal = null // { briefPath, briefText, digest } when a packet rides this amend
  let retired = null // the round whose packet retires with a refs-only change
  if (vt !== null && topValue(vt, 'source_evidence_digest') !== '') {
    try {
      const round = Number(topValue(vt, 'source_evidence_round'))
      assertFindRound(n, vt, round)
      const briefPath = P.verifyRoundBriefPath(n, round)
      const brief = P.read(briefPath)
      if (brief === null) throw new SourceEvidenceError('the pinned find brief is missing')
      const packet = parseSourcePacket(brief, briefPath)
      const token = s => `${s.file}@${s.location}`
      if (packet.scope.map(token).join(' ') !== taskRefAssignment(P, n).scope.map(token).join(' ')) retired = round
      else if (simple !== null) {
        // The anchors' wording may move with the meaning held (the cold verdict says so);
        // each must still resolve, and the packet is re-bound to what they say now.
        const digest = validateCompletedPacket(P, n, { ...packet, spec_digest: spec }, vt)
        packetSeal = { briefPath, briefText: briefWithPacketSpecDigest(brief, packet, spec, briefPath), digest }
      } else {
        // The FULL continuous validator runs, with only the legitimately-moved field
        // (spec digest) taken as current — target, scope, source roster and every
        // anchor stay its checks. v0.17.1 first split out the anchor half alone and
        // dropped the roster half with it: a ref-document edit then amended
        // "successfully" and failed the very next validate (the 0.17.1 re-review).
        const moved = { ...packet, spec_digest: spec }
        const digest = validateCompletedPacket(P, n, moved, vt)
        if (completedPacketDigest(packet, resolvePacketBases(P, n, packet, vt)) !== topValue(vt, 'source_evidence_digest')) throw new SourceEvidenceError('the packet digest moved')
        packetSeal = { briefPath, briefText: briefWithPacketSpecDigest(brief, packet, spec, briefPath), digest }
      }
    } catch (e) {
      if (!(e instanceof SourceEvidenceError)) throw e
      say(`${n}: same Contract·AC bytes, but the sealed evidence no longer holds — ${e.message}.`)
      say('A re-sealed verdict must not point at moved evidence (an anchored Change Log line, finding or adjudication) or a changed ref document; take the own-gates lane instead (grovespec reopen ' + n + ' draft).')
      return 1
    }
  }

  // The code half of the simple tier: anything moved in what a result seal covers runs the
  // project's tests before it is absorbed.
  let tested = null
  if (simple !== null) {
    const dirty = dirtyResultSubject(P, n)
    if (dirty === null) { say(`${n}: cannot read the working tree (git status failed) — nothing was absorbed`); return 2 }
    if (dirty.length) {
      const cmd = testCommand(P)
      if (cmd === '') { say(`${n}: code moved, and no test command is configured (review.test) — a code change no test guards is not a simple change: grovespec reopen ${n} approved`); return 1 }
      say(`$ ${cmd}`)
      const r = spawnSync(cmd, { shell: true, cwd: P.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      const exit = r.status ?? 1
      if (exit !== 0) {
        const out = String(r.stdout ?? '') + String(r.stderr ?? '')
        if (out !== '') process.stdout.write(out.endsWith('\n') ? out : out + '\n')
        say(`${n}: the tests fail (exit ${exit}) on the moved code — behavior moved or broke, so this is not a simple change: grovespec reopen ${n} approved`)
        return 1
      }
      tested = cmd
    }
    if (!contractMoved && tested === null) { say(`${n}: neither the Contract nor any code moved — nothing for the simple tier; plain grovespec amend ${n} absorbs a documentation edit`); return 2 }
  }

  const rp = P.reviewYamlPath(n)
  const rt = P.read(rp)
  const touched = []
  if (vt !== null && topValue(vt, 'spec_digest') !== '') {
    let record = resealed(vt, spec, task, packetSeal === null ? null : packetSeal.digest)
    if (retired !== null) record = record.replace(/^source_evidence_(?:digest|round)[ \t]*:.*\r?\n/gm, '')
    writeAtomic(vp, record)
    touched.push(vp.slice(P.root.length + 1))
  }
  if (rt !== null && topValue(rt, 'spec_digest') !== '') { writeAtomic(rp, resealed(rt, spec, task)); touched.push(rp.slice(P.root.length + 1)) }
  if (!touched.length) { say(`${n}: no sealed record carries a spec_digest — nothing to re-seal (was this node ever gated?)`); return 2 }
  if (packetSeal !== null) { writeAtomic(packetSeal.briefPath, packetSeal.briefText); touched.push(packetSeal.briefPath.slice(P.root.length + 1)) }
  P.forget()
  if (simple !== null) {
    const moved = [contractMoved ? 'Contract wording' : '', tested !== null ? 'code' : ''].filter(Boolean).join(' + ')
    say(`amended (simple): ${n} — ${moved} moved, AC byte-identical${tested !== null ? '; the tests pass on the moved code' : ''}; the cold verdict: ${simple.trim()}`)
    say(`re-sealed spec_digest ${spec.slice(0, 12)}… + task_evidence_digest ${task.slice(0, 12)}…${packetSeal !== null ? ' + the source packet, re-bound to its anchors\' new wording' : ''} → ${touched.join(' · ')}`)
    say(tested !== null
      ? `status stays ${st}; the meaning did not move, so no dependent becomes a candidate. Record the verdict in the Change Log and commit the code with the Task as \`${n}: simple — <summary>\` — the node's next review reads it with its diff.`
      : `status stays ${st}; the meaning did not move, so no dependent becomes a candidate. Record the verdict in the Change Log, commit as \`amend ${n}: simple — <summary>\` with the re-sealed records.`)
    if (st === 'done') for (const line of releaseOnDone(P, n)) say(line)
    endStepMark(P.root, n)
    return 0
  }
  say(`amended: ${n} — Contract·AC byte-identical against HEAD; re-sealed spec_digest ${spec.slice(0, 12)}… + task_evidence_digest ${task.slice(0, 12)}… → ${touched.join(' · ')}`)
  if (retired !== null) say(`refs moved: the source packet sealed in round ${retired} described the old assignment and retires (the brief stays as history) — the tree gate carries the new one: grovespec reopen tree decomposition, then verify the tree`)
  say(`status stays ${st}; dependents untouched. Record why in the Change Log, commit as \`amend ${n}: <summary>\` — the record files ride the same commit.`)
  // A revise that ends here leaves the node done: the claim its revise step took becomes a
  // done mark (or ends), exactly as at approve.
  if (st === 'done') for (const line of releaseOnDone(P, n)) say(line)
  endStepMark(P.root, n)
  return 0
}
