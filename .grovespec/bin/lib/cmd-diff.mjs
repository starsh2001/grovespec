// cycle diff — the ONE derivation of "what review reads", mechanical.
// FORMATS: a node's cycle diff is everything since the parent of the cycle's first
// `TASK-N:` commit, plus uncommitted changes, limited to the node's files. A cycle
// starts when the node leaves approved; once a review is pinned (reviewed_commit,
// written at done), the next cycle's commits are the ones after that pin.
import { topValue } from './core.mjs'
import { git, inRepo, log, touched } from './git.mjs'

const say = s => process.stdout.write(s + '\n')
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'   // git's well-known empty tree

export function cmdDiff (P, n) {
  if (n === '') { say('usage: grovespec diff TASK-N'); return 2 }
  if (P.read(P.taskPath(n)) === null) { say(`no such node: ${n}`); return 2 }
  if (!inRepo(P.root)) { say('not a git repository — diff reads the cycle from TASK- commits'); return 2 }

  const prefix = `${n}: `
  let commits = log(P.root).filter(c => c.s.startsWith(prefix))

  // A pinned review closes the previous cycle: only commits after it belong to this one.
  const rc = topValue(P.read(P.reviewYamlPath(n)) ?? '', 'reviewed_commit')
  if (rc !== '') {
    const r = git(P.root, ['rev-list', `${rc}..HEAD`])
    const after = new Set(r.ok ? r.out.split('\n').filter(Boolean) : [])
    commits = commits.filter(c => after.has(c.h))
  }

  if (commits.length === 0) {
    say(`cycle diff of ${n} (${P.statusOf(n)}) — no '${n}:' commits${rc !== '' ? ` after reviewed_commit ${rc.slice(0, 7)}` : ''}; nothing committed this cycle`)
    const st = git(P.root, ['status', '--porcelain'])
    const dirty = st.ok ? st.out.split('\n').filter(Boolean) : []
    if (dirty.length) {
      say('uncommitted changes (unattributed — see `grovespec fresh`):')
      for (const d of dirty) say(`  ${d}`)
    } else say('working tree clean')
    return 0
  }

  const oldest = commits[commits.length - 1].h
  const base = git(P.root, ['rev-parse', `${oldest}^`]).ok ? `${oldest}^` : EMPTY_TREE

  const files = []
  for (const c of commits) {
    for (const f of touched(P.root, c.h)) if (!files.includes(f)) files.push(f)
  }
  files.sort()

  say(`cycle diff of ${n} (${P.statusOf(n)}) — ${commits.length} commit(s), base = parent of ${oldest.slice(0, 7)}`)
  for (const c of commits) say(`  ${c.h.slice(0, 7)} ${c.s}`)
  say('files:')
  for (const f of files) say(`  ${f}`)

  say('--- diff (base → working tree, cycle files only) ---')
  const d = git(P.root, ['diff', base, '--', ...files])
  process.stdout.write(d.ok ? d.out : d.err)

  // Uncommitted edits OUTSIDE the cycle's files are not this node's work — surface them
  // instead of silently folding them in or silently dropping them.
  const st = git(P.root, ['status', '--porcelain'])
  const outside = (st.ok ? st.out.split('\n').filter(Boolean) : [])
    .filter(l => !files.includes(l.slice(3)))
  if (outside.length) {
    say('--- uncommitted outside the cycle files (not shown above — see `grovespec fresh`) ---')
    for (const l of outside) say(`  ${l}`)
  }
  return 0
}
