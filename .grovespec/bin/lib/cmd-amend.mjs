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
//     source (ref document, refs) refuses, before anything is written.
import { git, repoState } from './git.mjs'
import { releaseOnDone } from './cmd-claim.mjs'
import { writeAtomic } from './project.mjs'
import { markdownStructureLines, topValue } from './core.mjs'
import { specDigest, taskEvidenceDigest } from './cmd-pin.mjs'
import {
  SourceEvidenceError, assertFindRound, briefWithPacketSpecDigest,
  completedPacketDigest, parseSourcePacket, resolvePacketBases, validateCompletedPacket
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

export function cmdAmend (P, n) {
  if (n === '') { say('usage: grovespec amend TASK-N — absorb a documentation-only edit to a sealed node (Contract·AC byte-identical)'); return 2 }
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
  for (const name of ['Contract', 'AC']) {
    const now = sectionText(taskText, name)
    const was = sectionText(head.out, name)
    if (now === null || was === null) { say(`${n}: the ${name} section cannot be read on one side — repair the section structure first (grovespec validate)`); return 2 }
    if (now !== was) {
      if (name === 'Contract') {
        say(`${n}: the Contract bytes changed — that is not a documentation edit, it is the contract lane. Even a re-wrap goes here: equality the machine can prove is bytes, and the lane's only cost is checking.`)
        say('→ grovespec-revise: reopen this node, and its dependents become recheck candidates (grovespec recheck declare), never mass reopens.')
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
  if (vt !== null && topValue(vt, 'source_evidence_digest') !== '') {
    try {
      const round = Number(topValue(vt, 'source_evidence_round'))
      assertFindRound(n, vt, round)
      const briefPath = P.verifyRoundBriefPath(n, round)
      const brief = P.read(briefPath)
      if (brief === null) throw new SourceEvidenceError('the pinned find brief is missing')
      const packet = parseSourcePacket(brief, briefPath)
      // The FULL continuous validator runs, with only the legitimately-moved field
      // (spec digest) taken as current — target, scope, source roster and every
      // anchor stay its checks. v0.17.1 first split out the anchor half alone and
      // dropped the roster half with it: a ref-document or refs edit then amended
      // "successfully" and failed the very next validate (the 0.17.1 re-review).
      const moved = { ...packet, spec_digest: spec }
      const digest = validateCompletedPacket(P, n, moved, vt)
      if (completedPacketDigest(packet, resolvePacketBases(P, n, packet, vt)) !== topValue(vt, 'source_evidence_digest')) throw new SourceEvidenceError('the packet digest moved')
      packetSeal = { briefPath, briefText: briefWithPacketSpecDigest(brief, packet, spec, briefPath), digest }
    } catch (e) {
      if (!(e instanceof SourceEvidenceError)) throw e
      say(`${n}: same Contract·AC bytes, but the sealed evidence no longer holds — ${e.message}.`)
      say('A re-sealed verdict must not point at moved evidence (an anchored Change Log line, finding or adjudication) or a changed source (a ref document, the refs list); take the own-gates lane instead (grovespec reopen ' + n + ' draft).')
      return 1
    }
  }

  const rp = P.reviewYamlPath(n)
  const rt = P.read(rp)
  const touched = []
  if (vt !== null && topValue(vt, 'spec_digest') !== '') { writeAtomic(vp, resealed(vt, spec, task, packetSeal === null ? null : packetSeal.digest)); touched.push(vp.slice(P.root.length + 1)) }
  if (rt !== null && topValue(rt, 'spec_digest') !== '') { writeAtomic(rp, resealed(rt, spec, task)); touched.push(rp.slice(P.root.length + 1)) }
  if (!touched.length) { say(`${n}: no sealed record carries a spec_digest — nothing to re-seal (was this node ever gated?)`); return 2 }
  if (packetSeal !== null) { writeAtomic(packetSeal.briefPath, packetSeal.briefText); touched.push(packetSeal.briefPath.slice(P.root.length + 1)) }
  P.forget()
  say(`amended: ${n} — Contract·AC byte-identical against HEAD; re-sealed spec_digest ${spec.slice(0, 12)}… + task_evidence_digest ${task.slice(0, 12)}… → ${touched.join(' · ')}`)
  say(`status stays ${st}; dependents untouched. Record why in the Change Log, commit as \`amend ${n}: <summary>\` — the record files ride the same commit.`)
  // A revise that ends here leaves the node done: the claim its revise step took becomes a
  // done mark (or ends), exactly as at approve.
  if (st === 'done') for (const line of releaseOnDone(P, n)) say(line)
  return 0
}
