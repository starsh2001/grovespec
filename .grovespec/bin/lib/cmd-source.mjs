// source -- build the immutable half of a spec verify source-evidence packet.
// This command is read-only: the caller pastes its one fenced JSON result into the
// current find round brief, and cold C1/C3 reviewers fill only the disposition fields.
import { SourceEvidenceError, buildSourcePacket, formatSourcePacket } from './source-evidence.mjs'

const say = s => process.stdout.write(s + '\n')

export function cmdSource (P, args) {
  if (!Array.isArray(args) || args.length < 1) {
    say('usage: grovespec source TASK-N [file.md@4 ...]')
    return 2
  }
  const [target, ...scope] = args
  try {
    say(formatSourcePacket(buildSourcePacket(P, target, scope.length ? scope : undefined)))
    return 0
  } catch (e) {
    if (!(e instanceof SourceEvidenceError)) throw e
    say(`source refused: ${e.message}`)
    return 2
  }
}
