// test — runs the project's configured test command and RECORDS the result, so
// "the tests passed" is a machine-written fact (exit code + log), not a reading of
// scrollback. The skill's job stays the interpretation (mapping results to the AC);
// this owns the running and the record.
import { writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { cfgValue, splitLines } from './core.mjs'

const say = s => process.stdout.write(s + '\n')

function testCommand (P) {
  // Strip the quotes only when the value is actually quoted ("" or "pytest -q") —
  // a bare command ENDING in a quote (`node -e "…"`) must come through untouched.
  const v = cfgValue(P.configText, 'test')
  return v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v
}

// Minimal valid review-state skeleton — created when test runs before the first review
// round (the review skill's round 1 reuses the file; validate accepts it as-is).
function skeleton (P, tid) {
  const rel = P.tasksDir.startsWith(`${P.root}/`) ? P.tasksDir.slice(P.root.length + 1) : P.tasksDir
  return [
    `target: ${rel}/${tid}.md`, 'target_type: result', 'level: standard', 'strength: 2',
    'repeat: 1', 'max_rounds: 5', '', 'round: 0', 'consecutive_passes: 0',
    'status: in-progress', '', 'rounds: []', '', 'open_issues: []', '', 'adjudications: []', ''
  ].join('\n')
}

function upsertLastTest (text, cmd, exit) {
  const block = [
    'last_test:',
    `  command: ${JSON.stringify(cmd)}`,
    `  exit: ${exit}`,
    `  when: "${new Date().toISOString()}"`
  ]
  const lines = splitLines(text)
  const start = lines.findIndex(l => /^last_test[ \t]*:/.test(l))
  if (start === -1) return lines.concat([''], block).join('\n') + '\n'
  let end = start + 1
  while (end < lines.length && /^[ \t]/.test(lines[end])) end++
  return lines.slice(0, start).concat(block, lines.slice(end)).join('\n') + '\n'
}

export function cmdTest (P, tid) {
  if (tid !== '' && P.read(P.taskPath(tid)) === null) { say(`no such node: ${tid}`); return 2 }
  const cmd = testCommand(P)
  if (cmd === '') {
    say('config review.test is empty — the first grovespec-review derives it from the stack and writes it back (grovespec-review §1)')
    return 1
  }
  say(`$ ${cmd}`)
  const r = spawnSync(cmd, { shell: true, cwd: P.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const out = String(r.stdout ?? '') + String(r.stderr ?? '')
  if (out !== '') process.stdout.write(out.endsWith('\n') ? out : out + '\n')
  const exit = r.status ?? 1
  say(`test: exit ${exit} (${exit === 0 ? 'pass' : 'FAIL'})`)

  if (tid !== '') {
    mkdirSync(P.reviewDir, { recursive: true })
    const yamlPath = P.reviewYamlPath(tid)
    const existing = P.read(yamlPath)
    writeFileSync(yamlPath, upsertLastTest(existing ?? skeleton(P, tid), cmd, exit))
    writeFileSync(`${P.reviewDir}/${tid}.test.log`, out)
    say(`recorded → ${yamlPath} (last_test) + ${tid}.test.log`)
  }
  return exit === 0 ? 0 : 1
}
