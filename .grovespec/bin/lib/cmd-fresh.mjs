// fresh — out-of-band signals: changes to src/tests that did not go through the skills.
// A REPORT, not a gate: a human may hot-fix deliberately; the answer is grovespec-revise
// (reconcile spec ↔ code), so validate stays green and this command surfaces the list.
// Exit 1 when signals exist (CI can watch it); the skills surface it, never block on it.
import { git, porcelainPaths, repoState, shallowState, log, touched, mergeHashes, TASK_COMMIT } from './git.mjs'

const say = s => process.stdout.write(s + '\n')

// The signals themselves, computed without printing — cmd-next counts them as parked
// work at the all-done terminal. Not a repo → no signals (fresh has nothing to compare).
// `broken` carries a git failure: signals could not be computed — the caller must say
// so, never proceed on "no signals" (a failure folded into clean is the silent shrink).
export function freshSignals (P) {
  const rs = repoState(P.root)
  if (rs === 'none') return { dirty: [], offband: [], adoption: null, repo: false, nested: false, broken: null }
  if (rs === 'broken') return { dirty: [], offband: [], adoption: null, repo: true, nested: false, areas: [], broken: 'git did not answer (missing or failing git)' }
  const sh = shallowState(P.root)
  if (sh === 'broken') return { dirty: [], offband: [], adoption: null, repo: true, nested: false, areas: [], broken: 'git rev-parse --is-shallow-repository failed' }
  if (sh === 'shallow') return { dirty: [], offband: [], adoption: null, repo: true, nested: false, areas: [], broken: 'shallow clone — classification over cut history would under-report; unshallow it (git fetch --unshallow)' }

  if (P.pathProblems.length) return { dirty: [], offband: [], adoption: null, repo: true, nested: false, areas: [], broken: 'config paths are unresolvable (run grovespec validate)' }
  const rel = p => p.startsWith(`${P.root}/`) ? p.slice(P.root.length + 1) : null
  const areas = [rel(P.srcDir), rel(P.testsDir)].filter(x => x !== null)

  // git reports paths relative to the REPO root; a project nested deeper (a monorepo
  // subdir, a fixture inside a bigger repo) sees its own files behind that prefix.
  const pr = git(P.root, ['rev-parse', '--show-prefix'])
  if (!pr.ok) return { dirty: [], offband: [], adoption: null, repo: true, areas, nested: false, broken: 'git rev-parse --show-prefix failed' }
  const pfx = pr.out.trim()                              // '' exactly at the toplevel
  const nested = pfx !== ''
  const inAreas = f => {
    if (!f.startsWith(pfx)) return false
    const g = f.slice(pfx.length)
    return areas.some(a => g === a || g.startsWith(`${a}/`))
  }

  // -uall: an untracked directory folds to one `?? dir/` line by default, and the
  // fold hid nested untracked files from the area filter (same hole dirtyUnder had).
  const st = git(P.root, ['status', '--porcelain', '--untracked-files=all'])
  if (!st.ok) return { dirty: [], offband: [], adoption: null, repo: true, areas, nested, broken: 'git status failed (corrupt index?)' }
  const dirty = st.out.split('\n').filter(Boolean).filter(l => porcelainPaths(l).some(inAreas))

  // Committed history is classified only at the toplevel. Nested, the outer repo's
  // ordinary life (none of its commits TASK-prefixed) would all read as this project's
  // signals — and a project checked into a bigger repo would see its `next` change as
  // that repo's history grows. Nested projects keep the uncommitted signals above.
  if (nested) return { dirty, offband: [], adoption: null, repo: true, areas, nested, broken: null }

  // The adoption anchor — where history stops being baseline and starts owing TASK-
  // attribution. Primary: the commit that first brings `.grovespec` in (survives squash
  // merges and hand adoption, where no TASK- prefix exists; brownfield code predates it,
  // so the mapped baseline stays exempt). Fallback: the first TASK- commit (a repo that
  // never committed `.grovespec` — e.g. it is ignored — still gets an anchor).
  const all = log(P.root)
  if (all === null) return { dirty, offband: [], adoption: null, repo: true, areas, nested, broken: 'git log failed' }
  const gs = all.length ? git(P.root, ['rev-list', '--reverse', 'HEAD', '--', '.grovespec']) : { ok: true, out: '' }
  if (!gs.ok) return { dirty, offband: [], adoption: null, repo: true, areas, nested, broken: 'git rev-list failed' }
  const taskCommits = all.filter(c => TASK_COMMIT.test(c.s))
  const gsFirst = gs.out.split('\n').filter(Boolean)[0] ?? null
  const adoption = gsFirst ?? (taskCommits.length ? taskCommits[taskCommits.length - 1].h : null)
  const offband = []
  if (adoption !== null) {
    const r = git(P.root, ['rev-list', `${adoption}..HEAD`])
    if (!r.ok) return { dirty, offband: [], adoption, repo: true, areas, nested, broken: 'git rev-list failed' }
    const after = new Set(r.out.split('\n').filter(Boolean))
    // Merge commits are not classified: their content arrived via the branch's own
    // commits, which this very loop already answers for — counting the merge again
    // reported TASK-attributed work as out-of-band. (A conflict resolution's own
    // hand-content is invisible here — a stated limit, same as the nested case.)
    const merges = mergeHashes(P.root)
    if (merges === null) return { dirty, offband: [], adoption, repo: true, areas, nested, broken: 'git rev-list --merges failed' }
    for (const c of all) {
      if (!after.has(c.h) || merges.has(c.h) || TASK_COMMIT.test(c.s)) continue
      const tf = touched(P.root, c.h)
      if (tf === null) return { dirty, offband: [], adoption, repo: true, areas, nested, broken: `git show failed at ${c.h.slice(0, 7)} (git >= 2.31 required)` }
      if (tf.some(inAreas)) offband.push(c)
    }
  }
  return { dirty, offband, adoption, repo: true, areas, nested, broken: null }
}

export function cmdFresh (P) {
  const sig = freshSignals(P)
  if (sig.broken !== null) { say(`fresh: cannot classify history — ${sig.broken}; nothing was reported (a git failure is not a clean pass)`); return 2 }
  if (!sig.repo) { say('not a git repository — fresh compares history against TASK- commits'); return 2 }
  const { dirty, offband, adoption, areas, nested } = sig

  if (dirty.length === 0 && offband.length === 0) {
    if (nested) say(`fresh: clean under ${areas.join(' · ')} — uncommitted only (nested in a larger repository; committed history is not classified here)`)
    else say(`fresh: clean — every change under ${areas.join(' · ')} went through TASK- commits${adoption === null ? ' (no adoption anchor yet — no committed .grovespec, no TASK- commit)' : ''}`)
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
  if (nested) say('(nested in a larger repository — committed history is not classified here; the list above is uncommitted changes only)')
  say('→ a hand-fixed done node should go through grovespec-revise, so the spec and the code reconcile.')
  return 1
}
