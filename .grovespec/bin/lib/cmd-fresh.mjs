// fresh — out-of-band signals: changes to src/tests that did not go through the skills.
// A REPORT, not a gate: a human may hot-fix deliberately; the answer is grovespec-revise
// (reconcile spec ↔ code), so validate stays green and this command surfaces the list.
// Exit 1 when signals exist (CI can watch it); the skills surface it, never block on it.
import { git, porcelainPaths, repoState, shallowState, log, touched, mergeHashes, TASK_COMMIT, SKILL_COMMIT } from './git.mjs'

const say = s => process.stdout.write(s + '\n')

// ── grading (v0.15.0) ─────────────────────────────────
// Not every out-of-band change carries the same interest rate. One that touches a
// done node's CONTRACT surface compounds — the next gated consumer builds on the
// stale contract — so it wants a revise before anyone reads it. One inside the
// contract is cheap debt: batchable to a cleanup round. The distinction is a
// computation (owner's Contract idents ∩ the change's text), so fresh makes the
// call instead of leaving it to an agent's or a person's judgment at absorption
// time. The hook (bin/hook-route.mjs) mirrors these two helpers at edit time.

// Owner = the most recent `TASK-N:` cycle commit touching the file (before `at`,
// when given — grading a commit asks who owned the file when it landed).
function ownerOf (P, rel, at) {
  const range = at ? [`${at}~1`] : []
  const r = git(P.root, ['log', '--format=%s', '--max-count=300', ...range, '--', rel])
  if (!r.ok) return null
  for (const s of r.out.split('\n')) {
    const m = s.match(/^(TASK-\d+): /)
    if (m) return m[1]
  }
  return null
}

// Backticked identifier-shaped names from the Task's Contract section — the
// observable surface a consumer relies on.
export function contractIdents (taskText) {
  const m = taskText.match(/^## Contract$([\s\S]*?)(?=^## )/m)
  if (!m) return []
  const ids = new Set()
  for (const t of m[1].matchAll(/`([^`\n]+)`/g)) {
    const s = t[1].trim()
    if (/^[A-Za-z_][A-Za-z0-9_.]*(\(\))?$/.test(s) && s.length >= 3) ids.add(s.replace(/\(\)$/, ''))
  }
  return [...ids]
}

// A patch's CHANGED lines only. --unified=0 already drops context lines, but the
// hunk header itself carries git's enclosing-scope label (`@@ … @@ x = summary_line`)
// — a neighbouring contract name there graded an unrelated one-liner as touching
// (measured on the first smoke). +++/--- file headers go for the same reason.
const changedOnly = patch => patch === null ? null : patch.split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l)).join('\n')

// One line per owning node: does this change's text reach that node's Contract
// surface? `null` change text (unreadable diff) grades conservatively as touching —
// the false-"inside" is the silent-drift direction, same asymmetry as revise's.
function gradeLines (P, ownerToo) {
  const lines = []
  for (const [owner, text] of ownerToo) {
    if (owner === null) { lines.push('    → unowned yet (no TASK- history) — a plan/revise gives it an owner'); continue }
    let task = null
    try { task = P.read(P.taskPath(owner)) } catch { task = null }
    if (task === null) { lines.push(`    → ${owner} (its Task file is gone) — treat as contract-touching`); continue }
    const name = P.nameOf(owner)
    const hit = text === null ? '?' : (contractIdents(task).find(id => text.includes(id)) ?? null)
    if (hit === null) lines.push(`    → ${owner} (${name}): inside the contract — batchable to a cleanup round`)
    else if (hit === '?') lines.push(`    → ${owner} (${name}): diff unreadable — graded contract-touching (the safe direction)`)
    else lines.push(`    → ${owner} (${name}): touches its Contract surface (\`${hit}\`) — revise before a consumer reads it`)
  }
  return lines
}

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
    // Attribution is by the documented commit grammar, both shapes: the `TASK-N:`
    // cycle anchor AND the skills' step/gate/decision shapes (SKILL_COMMIT) — a
    // `review TASK-N:` commit is the skills' own writing, not a hand edit.
    for (const c of all) {
      if (!after.has(c.h) || merges.has(c.h) || TASK_COMMIT.test(c.s) || SKILL_COMMIT.test(c.s)) continue
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
  if (!sig.repo) { say('not a git repository — fresh compares history against the skills\' commits'); return 2 }
  const { dirty, offband, adoption, areas, nested } = sig

  if (dirty.length === 0 && offband.length === 0) {
    if (nested) say(`fresh: clean under ${areas.join(' · ')} — uncommitted only (nested in a larger repository; committed history is not classified here)`)
    else say(`fresh: clean — every change under ${areas.join(' · ')} went through the skills' commits${adoption === null ? ' (no adoption anchor yet — no committed .grovespec, no TASK- commit)' : ''}`)
    return 0
  }
  say('fresh: out-of-band signals — changes to src/tests that did not go through the skills')
  const inArea = p => areas.some(a => p === a || p.startsWith(`${a}/`))
  if (dirty.length) {
    say(`uncommitted under ${areas.join(' · ')}:`)
    for (const l of dirty) {
      say(`  ${l}`)
      if (nested) continue // paths carry the outer repo's prefix — owners aren't ours to name
      const owners = new Map()
      for (const p of porcelainPaths(l).filter(inArea)) {
        const o = ownerOf(P, p)
        if (owners.has(o)) continue
        if (l.startsWith('??')) owners.set(o, P.read(`${P.root}/${p}`)) // a new file's whole text is its change
        // --unified=0: grade the CHANGED lines only — default context lines made a
        // neighbouring contract name read as touched (measured on the first smoke).
        else { const d = git(P.root, ['diff', '--unified=0', 'HEAD', '--', p]); owners.set(o, changedOnly(d.ok ? d.out : null)) }
      }
      for (const g of gradeLines(P, owners)) say(g)
    }
  }
  if (offband.length) {
    say(`commits outside the skills touching ${areas.join(' · ')} (since adoption ${adoption.slice(0, 7)}):`)
    for (const c of offband) {
      say(`  ${c.h.slice(0, 7)} ${c.s}`)
      const tf = touched(P.root, c.h) ?? []
      const show = git(P.root, ['show', c.h, '--format=', '--unified=0'])
      const patch = changedOnly(show.ok ? show.out : null)
      const owners = new Map()
      for (const p of tf.filter(inArea)) { const o = ownerOf(P, p, c.h); if (!owners.has(o)) owners.set(o, patch) }
      for (const g of gradeLines(P, owners)) say(g)
    }
  }
  if (nested) say('(nested in a larger repository — committed history is not classified here; the list above is uncommitted changes only)')
  say('→ contract-surface items want a revise before a consumer reads them; inside-the-contract items can wait for a cleanup round. grovespec-revise absorbs either.')
  return 1
}
