// fresh — out-of-band signals: changes to src/tests that did not go through the skills.
// A REPORT, not a gate: a human may hot-fix deliberately; the answer is grovespec-revise
// (reconcile spec ↔ code), so validate stays green and this command surfaces the list.
// Exit 1 when signals exist (CI can watch it); the skills surface it, never block on it.
import { git, inRepo, log, touched, TASK_COMMIT } from './git.mjs'

const say = s => process.stdout.write(s + '\n')

export function cmdFresh (P) {
  if (!inRepo(P.root)) { say('not a git repository — fresh compares history against TASK- commits'); return 2 }

  const rel = p => p.startsWith(`${P.root}/`) ? p.slice(P.root.length + 1) : null
  const areas = [rel(P.srcDir), rel(P.testsDir)].filter(x => x !== null)
  const inAreas = f => areas.some(a => f === a || f.startsWith(`${a}/`))

  const dirty = (() => {
    const r = git(P.root, ['status', '--porcelain'])
    return (r.ok ? r.out.split('\n').filter(Boolean) : []).filter(l => inAreas(l.slice(3)))
  })()

  // History scan starts at the first TASK- commit — everything older predates GroveSpec
  // (brownfield history is not out-of-band, it is the mapped baseline).
  const all = log(P.root)
  const taskCommits = all.filter(c => TASK_COMMIT.test(c.s))
  const adoption = taskCommits.length ? taskCommits[taskCommits.length - 1].h : null
  let offband = []
  if (adoption !== null) {
    const r = git(P.root, ['rev-list', `${adoption}..HEAD`])
    const after = new Set(r.ok ? r.out.split('\n').filter(Boolean) : [])
    offband = all.filter(c => after.has(c.h) && !TASK_COMMIT.test(c.s) && touched(P.root, c.h).some(inAreas))
  }

  if (dirty.length === 0 && offband.length === 0) {
    say(`fresh: clean — every change under ${areas.join(' · ')} went through TASK- commits${adoption === null ? ' (no TASK- commits yet)' : ''}`)
    return 0
  }
  say('fresh: out-of-band signals — changes to src/tests that did not go through the skills')
  if (dirty.length) {
    say(`uncommitted under ${areas.join(' · ')}:`)
    for (const l of dirty) say(`  ${l}`)
  }
  if (offband.length) {
    say(`non-TASK commits touching ${areas.join(' · ')} (since adoption ${adoption.slice(0, 7)}):`)
    for (const c of offband) say(`  ${c.h.slice(0, 7)} ${c.s}`)
  }
  say('→ a hand-fixed done node should go through grovespec-revise, so the spec and the code reconcile.')
  return 1
}
