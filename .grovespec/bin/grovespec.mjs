#!/usr/bin/env node
// grovespec — deterministic checks for a GroveSpec project.
//   validate   format + graph coherence + status↔evidence (exit non-zero on any problem)
//   status     each node's status + which are unblocked + what waits on the human, + next
//   check      [TASK-N] is this node ready to work? / list the ready nodes
//   diff ID    the node's cycle diff, mechanically (TASK-N: commits + working tree)
//   test [ID]  run config review.test; with ID, record exit+log as the node's evidence
//   fresh      out-of-band signals: src/tests changes that skipped the skills (report)
//   pin ID     bind the gate to the bytes: spec digest at approve, commit+digest at done
//   impact ID  who a contract change on ID reaches (the consumer set / blast radius)
//   tree       the id-only tree.md rendered with names + status
//   lang       the project's reply/artifact language (config.language)
//   locale     detect the OS language (for init); prints nothing if undetectable
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
import { Project } from './lib/project.mjs'
import { cmdValidate, cmdStatus, cmdCheck, cmdLang, cmdLocale, cmdImpact, cmdTree, cmdVersion } from './lib/cmds.mjs'
import { cmdDiff } from './lib/cmd-diff.mjs'
import { cmdTest } from './lib/cmd-test.mjs'
import { cmdFresh } from './lib/cmd-fresh.mjs'
import { cmdPin } from './lib/cmd-pin.mjs'

const [cmd = '', arg = ''] = process.argv.slice(2)

let ec
switch (cmd) {
  case 'validate': ec = cmdValidate(new Project()); break
  case 'status': ec = cmdStatus(new Project()); break
  case 'check': ec = cmdCheck(new Project(), arg); break
  case 'diff': ec = cmdDiff(new Project(), arg); break
  case 'test': ec = cmdTest(new Project(), arg); break
  case 'fresh': ec = cmdFresh(new Project()); break
  case 'pin': ec = cmdPin(new Project(), arg); break
  case 'lang': ec = cmdLang(new Project()); break
  case 'locale': ec = cmdLocale(); break
  case 'impact': ec = cmdImpact(new Project(), arg); break
  case 'tree': ec = cmdTree(new Project()); break
  case 'version': ec = cmdVersion(new Project()); break
  default:
    process.stdout.write('grovespec — validate | status | check [TASK-N] | diff TASK-N | test [TASK-N] | fresh | pin TASK-N | lang | locale | impact TASK-N | tree | version\n')
    ec = 2
}
process.exitCode = ec
