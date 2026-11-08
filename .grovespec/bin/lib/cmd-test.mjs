// test — runs the project's configured test command and RECORDS the result, so
// "the tests passed" is a machine-written fact (exit code + log), not a reading of
// scrollback. The skill's job stays the interpretation (mapping results to the AC);
// this owns the running and the record.
import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { cfgValue, splitLines } from './core.mjs'
import { writeAtomic } from './project.mjs'
import { git, inRepo, porcelainPaths, showPrefix } from './git.mjs'

const say = s => process.stdout.write(s + '\n')

// Strip the quotes only when the value is actually quoted ("" or "pytest -q") —
// a bare command ENDING in a quote (`node -e "…"`) must come through untouched.
const unquote = v => v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v

export function testCommand (P) {
  return unquote(cfgValue(P.configText, 'review', 'test'))
}

// The close run (v0.29.0): once per milestone, at the front of the retro, the whole suite
// runs on the code the milestone closes on — `milestone.test`, the slow integration tests
// the per-node reviews leave out included; empty → review.test. Its record is a log with a
// header, not a yaml: every yaml under paths.review is a gate record to validate.
export function milestoneCommand (P) {
  const v = unquote(cfgValue(P.configText, 'milestone', 'test'))
  return v !== '' ? { cmd: v, key: 'milestone.test' } : { cmd: testCommand(P), key: 'review.test' }
}
export const closeLogPath = P => `${P.reviewDir}/milestone.test.log`
export function closeRun (P) {
  const text = P.read(closeLogPath(P))
  if (text === null) return null
  const head = {}
  for (const l of splitLines(text)) {
    if (l === '') break
    const m = l.match(/^(exit|commit): (.*)$/)
    if (m) head[m[1]] = m[2]
  }
  if (!/^[0-9]+$/.test(head.exit ?? '')) return null
  return { exit: Number(head.exit), commit: head.commit ?? '' }
}

function testMilestone (P) {
  const { cmd, key } = milestoneCommand(P)
  if (cmd === '') { say('config milestone.test and review.test are both empty — no suite to run; the close run is the direct run alone (grovespec-retro §2)'); return 1 }
  // The record binds the commit it ran on, so what it ran must be that commit: uncommitted
  // product changes would pass as the milestone's code without being in it.
  let commit = ''
  if (inRepo(P.root)) {
    const pfx = showPrefix(P.root)
    const st = git(P.root, ['status', '--porcelain', '--untracked-files=all'])
    if (pfx === null || !st.ok) { say('cannot read the working tree (git status failed) — nothing was run'); return 2 }
    const own = P.ownPaths()
    const product = f => f.startsWith(pfx) && !own.some(o => f.slice(pfx.length) === o || f.slice(pfx.length).startsWith(`${o}/`))
    const dirty = st.out.split('\n').filter(Boolean).filter(l => porcelainPaths(l).some(product))
    if (dirty.length) {
      say('the project has uncommitted changes outside GroveSpec\'s own files — the close run binds the commit it runs on, so they are committed on their own first (FORMATS.md "Interjected work": ask about changes nobody can account for), then re-run:')
      for (const l of dirty.slice(0, 10)) say(`  ${l}`)
      if (dirty.length > 10) say(`  … ${dirty.length - 10} more`)
      return 2
    }
    const head = git(P.root, ['rev-parse', 'HEAD'])
    if (head.ok) commit = head.out.trim()
  }
  say(`$ ${cmd}${key === 'review.test' ? '   (milestone.test is empty — review.test runs)' : ''}`)
  const r = spawnSync(cmd, { shell: true, cwd: P.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const out = String(r.stdout ?? '') + String(r.stderr ?? '')
  if (out !== '') process.stdout.write(out.endsWith('\n') ? out : out + '\n')
  const exit = r.status ?? 1
  say(`test: exit ${exit} (${exit === 0 ? 'pass' : 'FAIL'})`)
  mkdirSync(P.reviewDir, { recursive: true })
  writeAtomic(closeLogPath(P), [`command: ${JSON.stringify(cmd)}`, `exit: ${exit}`, `when: "${new Date().toISOString()}"`, ...(commit !== '' ? [`commit: ${commit}`] : []), '', out].join('\n'))
  say(`recorded → ${closeLogPath(P).slice(P.root.length + 1)} (the close run — grovespec retro reads it)`)
  return exit === 0 ? 0 : 1
}

// A configured counter, or the template default when the config is silent/garbled —
// the user's N·M must reach the record the runtime itself creates (a hardcoded 2·2·30
// shipped in 0.13.0 and the record disagreed with config from birth).
function cfgInt (P, block, key, dflt) {
  const v = cfgValue(P.configText, block, key)
  return /^[0-9]+$/.test(v) ? Number(v) : dflt
}

// Minimal valid review-state skeleton — created when test runs before the first review
// round (the review skill's round 1 reuses the file; validate accepts it as-is).
// Counters come from config `review:`; the caller prints them so the birth values are
// observable (and golden-pinnable), never silent.
export function reviewSkeletonCounters (P) {
  return {
    find: cfgInt(P, 'review', 'find_streak', 2),
    plan: cfgInt(P, 'review', 'plan_streak', 2),
    max: cfgInt(P, 'review', 'max_rounds', 30)
  }
}
function skeleton (P, tid) {
  const rel = P.tasksDir.startsWith(`${P.root}/`) ? P.tasksDir.slice(P.root.length + 1) : P.tasksDir
  const c = reviewSkeletonCounters(P)
  return [
    `target: ${rel}/${tid}.md`, 'target_type: result', 'level: standard', `find_streak: ${c.find}`,
    `plan_streak: ${c.plan}`, `max_rounds: ${c.max}`, '', 'round: 0', 'no_new_streak: 0',
    'status: in-progress', '', 'rounds: []', '', 'open_issues: []', '', 'followups: []', '', 'adjudications: []', ''
  ].join('\n')
}

function upsertLastTest (text, cmd, exit, commit) {
  // `commit` binds the verdict to the code it ran on — approve (machine) compares it
  // against HEAD, so "the tests passed" can never quietly mean "…on some earlier code".
  const block = [
    'last_test:',
    `  command: ${JSON.stringify(cmd)}`,
    `  exit: ${exit}`,
    `  when: "${new Date().toISOString()}"`,
    ...(commit !== '' ? [`  commit: ${commit}`] : [])
  ]
  const lines = splitLines(text)
  const start = lines.findIndex(l => /^last_test[ \t]*:/.test(l))
  if (start === -1) return lines.concat([''], block).join('\n') + '\n'
  let end = start + 1
  while (end < lines.length && /^[ \t]/.test(lines[end])) end++
  return lines.slice(0, start).concat(block, lines.slice(end)).join('\n') + '\n'
}

export function cmdTest (P, tid) {
  if (tid === 'milestone') return testMilestone(P)
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
    let commit = ''
    if (inRepo(P.root)) {
      const head = git(P.root, ['rev-parse', 'HEAD'])
      if (head.ok) commit = head.out.trim()
    }
    mkdirSync(P.reviewDir, { recursive: true })
    const yamlPath = P.reviewYamlPath(tid)
    const existing = P.read(yamlPath)
    writeAtomic(yamlPath, upsertLastTest(existing ?? skeleton(P, tid), cmd, exit, commit))
    writeAtomic(`${P.reviewDir}/${tid}.test.log`, out)
    say(`recorded → ${yamlPath} (last_test) + ${tid}.test.log`)
    if (existing === null) {
      const c = reviewSkeletonCounters(P)
      say(`new record: find_streak ${c.find} · plan_streak ${c.plan} · max_rounds ${c.max} (config review:)`)
    }
  }
  return exit === 0 ? 0 : 1
}
