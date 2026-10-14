// source -- build the immutable half of a spec verify source-evidence packet.
// This command is read-only: the caller pastes its one fenced JSON result into the
// current find round brief, and cold C1/C3 reviewers fill only the disposition fields.
//
// --check and --refresh (v0.23.0) work the packet already in the cycle's latest find
// brief -- the one pin will read. --check runs pin's own packet checks and writes
// nothing. --refresh rebuilds the generated half from the current Task and refs after a
// Task edit, keeps each clause's five disposition fields by its stable id, and writes the
// brief back. Sessions had done both by hand: one project ran 23 inline scripts that
// imported runtime modules to merge and re-check packets.
import { SourceEvidenceError, briefWithPacket, buildSourcePacket, formatSourcePacket, latestFindRound, parseSourcePacket, validateCompletedPacket } from './source-evidence.mjs'
import { topValue } from './core.mjs'
import { writeAtomic } from './project.mjs'

const say = s => process.stdout.write(s + '\n')
const USAGE = 'usage: grovespec source TASK-N [file.md@4 ...] | source TASK-N --check | source TASK-N --refresh'
const DISPOSITION = ['c1', 'c1_case', 'c1_basis', 'c3', 'c3_basis']

export function cmdSource (P, args) {
  if (!Array.isArray(args) || args.length < 1) { say(USAGE); return 2 }
  const [target, ...rest] = args
  const mode = rest.find(a => a === '--check' || a === '--refresh') ?? ''
  if (mode !== '' && rest.length !== 1) { say(USAGE); return 2 }
  try {
    if (mode === '') {
      say(formatSourcePacket(buildSourcePacket(P, target, rest.length ? rest : undefined)))
      return 0
    }
    const vp = P.verifyYamlPath(target)
    const vt = P.read(vp)
    if (vt === null) throw new SourceEvidenceError(`${vp} missing -- the packet lives in this cycle's find brief`)
    const round = latestFindRound(target, vt)
    const briefPath = P.verifyRoundBriefPath(target, round)
    const briefText = P.read(briefPath)
    if (briefText === null) throw new SourceEvidenceError(`${briefPath} missing -- pin reads exactly the highest rounds[] find brief`)
    const packet = parseSourcePacket(briefText, briefPath)
    const unset = packet.clauses.filter(c => c.c1 === 'UNSET' || c.c3 === 'UNSET').length

    if (mode === '--check') {
      try { validateCompletedPacket(P, target, packet, vt) } catch (e) {
        if (!(e instanceof SourceEvidenceError)) throw e
        say(`source check: round ${round} brief -- pin would refuse: ${e.message}${unset ? ` (${unset} of ${packet.clauses.length} clause(s) still UNSET)` : ''}`)
        return 1
      }
      say(`source check: round ${round} brief -- pin would accept the packet (${packet.clauses.length} clause(s), every disposition filled and resolved)`)
      return 0
    }

    // A sealed packet never changes: pin bound these bytes, and a Task edit after the
    // seal is a fresh cycle's evidence, not this one's.
    if (topValue(vt, 'source_evidence_digest') !== '') throw new SourceEvidenceError(`the round ${round} packet is already sealed (pin ran) -- a sealed packet never changes; a Task edit after the seal needs a fresh cycle`)
    const fresh = buildSourcePacket(P, target)
    const before = new Map(packet.clauses.map(c => [c.id, c]))
    let kept = 0
    for (const c of fresh.clauses) {
      const old = before.get(c.id)
      if (old === undefined) continue
      for (const k of DISPOSITION) c[k] = old[k]
      kept++
    }
    const added = fresh.clauses.length - kept
    const dropped = packet.clauses.length - kept
    const moved = fresh.spec_digest !== packet.spec_digest
    writeAtomic(briefPath, briefWithPacket(briefText, fresh, briefPath))
    P.forget()
    say(`source refresh: round ${round} brief -- ${moved ? 'spec_digest now covers the current Task' : 'spec_digest unchanged'}; ${kept} clause(s) kept their dispositions${added ? `, ${added} new clause(s) start UNSET` : ''}${dropped ? `, ${dropped} clause(s) left the roster` : ''} -> ${briefPath}`)
    if (moved) say('  the Task moved: the cold confirmation re-confirms every disposition whose Contract/AC/Change Log line the edit touched -- a kept disposition is carried, not re-proved')
    return 0
  } catch (e) {
    if (!(e instanceof SourceEvidenceError)) throw e
    say(`source ${mode === '' ? '' : `${mode.slice(2)} `}refused: ${e.message}`)
    return 2
  }
}
