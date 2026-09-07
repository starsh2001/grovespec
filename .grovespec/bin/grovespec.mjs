#!/usr/bin/env node
// grovespec — deterministic checks for a GroveSpec project.
//   validate   format + graph coherence + status↔evidence (exit non-zero on any problem)
//   status     each node's status + which are unblocked + what waits on the human, + next
//   check      [TASK-N] is this node ready to work? / list the ready nodes
//   next [--auto]  the ONE step to run now. Human gates are skipped; --auto (the driver's
//              auto mode) offers a CLEAN sealed gate as a machine-takeable step instead
//   approve <ID|tree> [--human]  decide a sealed pass: verifies the seal covers the
//              CURRENT bytes (digest · commit · bound green tests for a machine result),
//              then flips the state. Writes no evidence. `approve tree` is human-only
//   reopen ID draft|approved  revise's transition: fresh gate cycles, a past `passed`
//              never doubles as current evidence (reviewed_commit kept as the diff base)
//   ratify ID… the human coming back: stamps machine-taken gates as theirs
//   diff ID    the node's cycle diff, mechanically (TASK-N: commits + working tree)
//   files ID   which code belongs to the node, across every cycle (derived, never stored)
//   test [ID]  run config review.test; with ID, record exit+log as the node's evidence
//   fresh      out-of-band signals: src/tests changes that skipped the skills (report)
//   followups  every parked non-blocking finding across all gate records + the brownfield
//              backlogs — the aggregate surface grovespec-plan structures into a next pass
//   pin ID     bind the gate to the bytes: spec digest at approve, commit+digest at done
//   id         the next node id, derived (highest ever seen + 1 — ids are never reused:
//              a merged-away node's number would hand its commits to the new node)
//   impact ID  who a contract change on ID reaches (the consumer set / blast radius)
//   tree       the id-only tree.md rendered with names + status
//   lang       the project's reply/artifact language (config.language)
//   locale     detect the OS language (for init); prints nothing if undetectable
//   interview  the fixed setup questions (init Q2·Q3) as a paste-ready payload,
//              pre-escaped to pure ASCII — re-typing them is how they got corrupted
//   version    the installed runtime's version (.grovespec/VERSION)
//
// Runtime: Node 18+, node builtins only — no package.json, no npm install.
// Ships inside .grovespec/ — copy the folder. On Windows call it through PowerShell
// (`node .grovespec/bin/grovespec.mjs …`), not Git Bash — Git Bash pays ~290ms per
// process to emulate Unix. Never wrap it in a .ps1 (execution policy applies to .ps1).
//
// THE SPECIFICATION IS tests/regress.sh (in the distribution repo) — every case is a
// CLI black box; this runtime was graded against the bash implementation it replaced
// on those goldens, case for case.
// Format SoT: .grovespec/schema   Paths: .grovespec/config.yaml
import { Project, findRoot, versionRefusal } from './lib/project.mjs'
import { acquire, release, lockPath } from './lib/lock.mjs'
import { cmdValidate, cmdStatus, cmdCheck, cmdFollowups, cmdLang, cmdLocale, cmdInterview, cmdId, cmdImpact, cmdTree, cmdVersion } from './lib/cmds.mjs'
import { cmdDiff } from './lib/cmd-diff.mjs'
import { cmdFiles } from './lib/cmd-files.mjs'
import { cmdNext } from './lib/cmd-next.mjs'
import { cmdTest } from './lib/cmd-test.mjs'
import { cmdFresh } from './lib/cmd-fresh.mjs'
import { cmdPin } from './lib/cmd-pin.mjs'
import { cmdApprove, cmdRatify } from './lib/cmd-approve.mjs'
import { cmdReopen } from './lib/cmd-reopen.mjs'

const [cmd = '', arg = ''] = process.argv.slice(2)
const rest = process.argv.slice(3)

// The one spelling of the command surface (tests/doccheck.sh pins it against the
// dispatch table, the header comment and README — edit them together).
const USAGE = 'grovespec — validate | status | check [TASK-N] | next [--auto] | approve <TASK-N|tree> [--human] | reopen TASK-N draft|approved | ratify TASK-N… | diff TASK-N | files TASK-N | test [TASK-N] | fresh | followups | pin <TASK-N|tree> | id | lang | locale | interview | impact TASK-N | tree | version\n'

// The argv gate: an unknown flag or a surplus argument is a typo'd INTENTION and exits 2 —
// `approve TASK-1 --humman` used to be silently accepted and recorded a MACHINE decision
// where a human one was meant. Missing arguments still fall through to each command's own
// usage line (those messages are pinned contracts). Table: cmd → [max positionals, flags].
const AV = {
  validate: [0], status: [0], check: [1], next: [0, ['--auto', 'auto']],
  approve: [1, ['--human']], reopen: [2], ratify: [Infinity], diff: [1], files: [1],
  test: [1], fresh: [0], followups: [0], pin: [1], id: [0], lang: [0], locale: [0],
  interview: [0], impact: [1], tree: [0], version: [0]
}
// No command takes two flags, and none takes the same one twice — `next --auto --auto`
// and `next --auto auto` (aliases of one flag) are both a surplus token, not emphasis.
let badArg = null
if (AV[cmd] !== undefined) {
  const [maxPos, flags = []] = AV[cmd]
  const given = rest.filter(a => flags.includes(a))
  const pos = rest.filter(a => !flags.includes(a))
  badArg = (given.length > 1 ? given[1] : null) ??
    pos.find(a => a.startsWith('--')) ?? (pos.length > maxPos ? pos[maxPos] : null)
}

// The single-writer gate — only the commands that WRITE project state take the lock
// (test only when it records, i.e. with an id); reads never queue behind anything.
// A refusal is exit 2 with the path: no wait, no automatic reclaim (lib/lock.mjs).
const MUTATES = { approve: () => true, ratify: () => true, reopen: () => true, pin: () => true, test: () => arg !== '' }

// Commands that answer ABOUT the runtime or the environment, never about the project's
// content — the four that stay reachable across a format boundary (a skewed project
// still needs to be told which runtime it is looking at, and in which language).
const VERSION_EXEMPT = ['version', 'lang', 'locale', 'interview']
const refusal = (cmd !== '' && !VERSION_EXEMPT.includes(cmd)) ? versionRefusal(findRoot()) : null

// Config paths that cannot be resolved inside the project are a dispatcher-level
// refusal too — a per-command check reached only `validate`, `fresh` and the machine
// RESULT gate, so `reopen`, `pin`, `test`, `ratify` and the spec gate kept writing at
// FALLBACK coordinates: the config named one place, the runtime wrote another, and
// both said exit 0. `validate` is exempt because it is the command that explains the
// problem (the informational four never touch project paths at all).
const PATHS_EXEMPT = [...VERSION_EXEMPT, 'validate']
let pathRefusal = null
if (refusal === null && cmd !== '' && !PATHS_EXEMPT.includes(cmd)) {
  const probs = new Project().pathProblems
  if (probs.length) pathRefusal = probs
}

let ec
let held = null
if (badArg !== null) {
  process.stdout.write(`unknown or extra argument: '${badArg}' — refused, never ignored (a typo'd flag is a typo'd intention)\n`)
  process.stdout.write('usage: ' + USAGE)
  ec = 2
} else if (refusal !== null) {
  process.stdout.write(refusal + '\n')
  ec = 2
} else if (pathRefusal !== null) {
  for (const m of pathRefusal) process.stdout.write(`${findRoot()}/.grovespec/config.yaml  ${m}\n`)
  process.stdout.write('this command works in the configured paths, and one of them cannot be used as configured — nothing was read or written (grovespec validate explains; fix config.yaml, then re-run)\n')
  ec = 2
} else if (MUTATES[cmd] !== undefined && MUTATES[cmd]() && (held = acquire(findRoot())) === null) {
  process.stdout.write(`another grovespec run holds the write lock: ${lockPath(findRoot())}\n`)
  process.stdout.write('a second writer is refused, not queued — interleaved task/record writes are how a gate record lies. If NO other grovespec is running, a crashed run left this; delete that directory yourself and re-run.\n')
  ec = 2
} else {
  try {
    switch (cmd) {
      case 'validate': ec = cmdValidate(new Project()); break
      case 'status': ec = cmdStatus(new Project()); break
      case 'check': ec = cmdCheck(new Project(), arg); break
      case 'next': ec = cmdNext(new Project(), arg === '--auto' || arg === 'auto'); break
      case 'approve': ec = cmdApprove(new Project(), arg, rest.includes('--human')); break
      case 'reopen': ec = cmdReopen(new Project(), arg, rest[1] ?? ''); break
      case 'ratify': ec = cmdRatify(new Project(), rest); break
      case 'diff': ec = cmdDiff(new Project(), arg); break
      case 'files': ec = cmdFiles(new Project(), arg); break
      case 'test': ec = cmdTest(new Project(), arg); break
      case 'fresh': ec = cmdFresh(new Project()); break
      case 'followups': ec = cmdFollowups(new Project()); break
      case 'pin': ec = cmdPin(new Project(), arg); break
      case 'lang': ec = cmdLang(new Project()); break
      case 'locale': ec = cmdLocale(); break
      case 'interview': ec = cmdInterview(); break
      case 'id': ec = cmdId(new Project()); break
      case 'impact': ec = cmdImpact(new Project(), arg); break
      case 'tree': ec = cmdTree(new Project()); break
      case 'version': ec = cmdVersion(new Project()); break
      default:
        process.stdout.write(USAGE)
        ec = 2
    }
  } finally { release(held) }
}
process.exitCode = ec
