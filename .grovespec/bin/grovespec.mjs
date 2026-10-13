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
//   reopen ID draft|approved | tree decomposition|fidelity
//                             revise's transition: fresh gate cycles, a past `passed`
//              never doubles as current evidence (reviewed_commit kept as the diff base)
//   ratify ID… the human coming back: stamps machine-taken gates as theirs
//   wait [resolve] TASK-A TASK-B <text…>  the sideways-dependency ledger: A freezes until
//              B answers (declare), A closes its wait saying what answered it (resolve);
//              bare `wait` lists what is live and whose turn the newest declaration gives
//   diff ID    the node's cycle diff, mechanically (TASK-N: commits + working tree)
//   files ID   which code belongs to the node, across every cycle (derived, never stored)
//   test [ID]  run config review.test; with ID, record exit+log as the node's evidence
//   fresh      out-of-band signals: src/tests changes that skipped the skills (report)
//   followups  every parked non-blocking finding across all gate records + the brownfield
//              backlogs — the aggregate surface grovespec-plan structures into the next milestone
//   source ID [coordinates…]  emit the assigned canonical ref-clause packet for a spec find round
//   pin ID     bind the gate to the bytes: spec digest at approve, commit+digest at done
//   id         the next node id, derived (highest ever seen + 1 — ids are never reused:
//              a merged-away node's number would hand its commits to the new node), and
//              never below what this repository already issued (its worktrees share that)
//   claim [list|<TASK-N|tree> [step]|release <TASK-N|tree>]  which worktree of this
//              repository works which node, or the tree: every node step and every
//              tree-wide step claims first; next skips what another worktree holds, or
//              finished on a branch not merged here
//   impact ID  who a contract change on ID reaches (the consumer set / blast radius)
//   tree       the id-only tree.md rendered with names + status
//   lang       the project's reply/artifact language (config.language)
//   locale     detect the OS language (for init); prints nothing if undetectable
//   interview [claude|codex]  the fixed setup questions (init Q2–Q4) as a paste-ready
//              payload for that host's question tool (Claude: pre-escaped to pure
//              ASCII; Codex: plain UTF-8) — re-typing them is how they got corrupted
//   hooks install|remove|status  the advisory edit-routing hook's registration in
//              .claude/settings.json + .codex/hooks.json — the merge is runtime code,
//              surgical + idempotent
//   uninstall [--purge]  remove the tool (runtime + skills + hook registration); the
//              ledger (gate records · waits · config · docs/) stays unless --purge
//   amend TASK-N  absorb a documentation-only edit to a sealed node: Contract·AC
//              byte-identical (proven vs HEAD) → re-seal in place, no reopen
//   recheck [declare|close|open]  the candidate ledger: a contract change makes
//              dependents candidates, ONE armed step judges reach for them all, and
//              `open` reopens a judged-touched one in the same command
//   retro      the milestone's closing look: is a retrospective owed (TASK- work since the
//              last retro record), plus the milestone measured — grovespec-retro's floor
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
import { Project, findRoot, languageRefusal, versionRefusal } from './lib/project.mjs'
import { acquire, release, lockPath } from './lib/lock.mjs'
import { cmdValidate, cmdStatus, cmdCheck, cmdFollowups, cmdLang, cmdLocale, cmdInterview, cmdId, cmdImpact, cmdTree, cmdVersion } from './lib/cmds.mjs'
import { cmdDiff } from './lib/cmd-diff.mjs'
import { cmdFiles } from './lib/cmd-files.mjs'
import { cmdNext } from './lib/cmd-next.mjs'
import { cmdTest } from './lib/cmd-test.mjs'
import { cmdFresh } from './lib/cmd-fresh.mjs'
import { cmdPin } from './lib/cmd-pin.mjs'
import { cmdSource } from './lib/cmd-source.mjs'
import { cmdApprove, cmdRatify } from './lib/cmd-approve.mjs'
import { cmdReopen } from './lib/cmd-reopen.mjs'
import { cmdWait } from './lib/cmd-wait.mjs'
import { cmdHooks } from './lib/cmd-hooks.mjs'
import { cmdUninstall } from './lib/cmd-uninstall.mjs'
import { cmdRetro } from './lib/cmd-retro.mjs'
import { cmdAmend } from './lib/cmd-amend.mjs'
import { cmdRecheck } from './lib/cmd-recheck.mjs'
import { cmdClaim } from './lib/cmd-claim.mjs'

const [cmd = '', arg = ''] = process.argv.slice(2)
const rest = process.argv.slice(3)

// The one spelling of the command surface (tests/doccheck.sh pins it against the
// dispatch table, the header comment and README — edit them together).
const USAGE = 'grovespec — validate | status | check [TASK-N] | next [--auto] | approve <TASK-N|tree> [--human] | reopen TASK-N draft|approved | reopen tree decomposition|fidelity | ratify TASK-N… | wait [resolve] TASK-A TASK-B <text…> | diff TASK-N | files TASK-N | test [TASK-N] | fresh | followups | source TASK-N [file.md@4…] | pin <TASK-N|tree> | id | claim [list|<TASK-N|tree> [step]|release <TASK-N|tree>] | lang | locale | interview [claude|codex] | hooks install|remove|status | uninstall [--purge] | amend TASK-N | recheck [declare|close|open …] | retro | impact TASK-N | tree | version\n'

// The argv gate: an unknown flag or a surplus argument is a typo'd INTENTION and exits 2 —
// `approve TASK-1 --humman` used to be silently accepted and recorded a MACHINE decision
// where a human one was meant. Missing arguments still fall through to each command's own
// usage line (those messages are pinned contracts). Table: cmd → [max positionals, flags].
const AV = {
  validate: [0], status: [0], check: [1], next: [0, ['--auto', 'auto']],
  approve: [1, ['--human']], reopen: [2], ratify: [Infinity], wait: [Infinity], diff: [1], files: [1],
  test: [1], fresh: [0], followups: [0], source: [Infinity], pin: [1], id: [0], claim: [2], lang: [0], locale: [0],
  interview: [1], hooks: [1], uninstall: [0, ['--purge']], retro: [0], amend: [1], recheck: [Infinity], impact: [1], tree: [0], version: [0]
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
// (id and claim write only the repository-shared state, under that state's own short
// lock — lib/shared.mjs — so they are not in this table: run.lock is one checkout's.)
const MUTATES = { approve: () => true, ratify: () => true, reopen: () => true, pin: () => true, test: () => arg !== '', wait: () => arg !== '', hooks: () => arg !== 'status', uninstall: () => true, amend: () => true, recheck: () => arg !== '' }

// Commands that answer ABOUT the runtime or the environment, never about the project's
// content — the four that stay reachable across a format boundary (a skewed project
// still needs to be told which runtime it is looking at, and in which language).
const VERSION_EXEMPT = ['version', 'lang', 'locale', 'interview']
const refusal = (cmd !== '' && !VERSION_EXEMPT.includes(cmd)) ? versionRefusal(findRoot()) : null
const langRefusal = cmd === 'lang' ? languageRefusal(findRoot()) : null

// Config paths that cannot be resolved inside the project are a dispatcher-level
// refusal too — a per-command check reached only `validate`, `fresh` and the machine
// RESULT gate, so `reopen`, `pin`, `test`, `ratify` and the spec gate kept writing at
// FALLBACK coordinates: the config named one place, the runtime wrote another, and
// both said exit 0. `validate` is exempt because it is the command that explains the
// problem (the informational four never touch project paths at all).
const PATHS_EXEMPT = [...VERSION_EXEMPT, 'validate']
let pathRefusal = null
let duplicateKeyRefusal = null
let frontmatterRefusal = null
if (refusal === null && cmd !== '' && !PATHS_EXEMPT.includes(cmd)) {
  const probe = new Project()
  if (probe.pathProblems.length) pathRefusal = probe.pathProblems
  else {
    const probs = probe.duplicateKeyProblems()
    if (probs.length) duplicateKeyRefusal = probs
    else {
      const boundaries = probe.frontmatterProblems()
      if (boundaries.length) frontmatterRefusal = boundaries
    }
  }
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
} else if (langRefusal !== null) {
  process.stdout.write(langRefusal + '\n')
  ec = 2
} else if (pathRefusal !== null) {
  for (const m of pathRefusal) process.stdout.write(`${findRoot()}/.grovespec/config.yaml  ${m}\n`)
  process.stdout.write('this command works in the configured paths, and one of them cannot be used as configured — nothing was read or written (grovespec validate explains; fix config.yaml, then re-run)\n')
  ec = 2
} else if (duplicateKeyRefusal !== null) {
  for (const m of duplicateKeyRefusal) process.stdout.write(`${m}\n`)
  process.stdout.write('duplicate YAML keys make project routing or gate state ambiguous — nothing was read as a verdict and nothing was written (grovespec validate explains; keep each field once, then re-run)\n')
  ec = 2
} else if (frontmatterRefusal !== null) {
  for (const m of frontmatterRefusal) process.stdout.write(`${m}\n`)
  process.stdout.write('malformed Task frontmatter makes lifecycle state ambiguous — nothing was read as a verdict and nothing was written (grovespec validate explains; restore both --- fences, then re-run)\n')
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
      case 'wait': ec = cmdWait(new Project(), process.argv.slice(3)); break
      case 'diff': ec = cmdDiff(new Project(), arg); break
      case 'files': ec = cmdFiles(new Project(), arg); break
      case 'test': ec = cmdTest(new Project(), arg); break
      case 'fresh': ec = cmdFresh(new Project()); break
      case 'followups': ec = cmdFollowups(new Project()); break
      case 'source': ec = cmdSource(new Project(), rest); break
      case 'pin': ec = cmdPin(new Project(), arg); break
      case 'lang': ec = cmdLang(new Project()); break
      case 'locale': ec = cmdLocale(); break
      case 'interview': ec = cmdInterview(arg); break
      case 'hooks': ec = cmdHooks(new Project(), arg); break
      case 'uninstall': {
        const P = new Project()
        ec = cmdUninstall(P, rest, () => cmdHooks(P, 'remove'))
        break
      }
      case 'retro': ec = cmdRetro(new Project()); break
      case 'amend': ec = cmdAmend(new Project(), arg); break
      case 'recheck': ec = cmdRecheck(new Project(), rest); break
      case 'id': ec = cmdId(new Project()); break
      case 'claim': ec = cmdClaim(new Project(), rest); break
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
