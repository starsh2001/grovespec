// fresh — out-of-band signals: changes to the project that did not go through the skills.
// The watched scope is the whole project except what GroveSpec owns and what the agent
// hosts keep (Project.ownPaths, v0.24.0) — the product is code and the resources beside
// it. Watching src/tests alone let an art or config change made outside the skills go
// unrecorded while the result seal already covered it.
// A REPORT, not a gate: a human may hot-fix deliberately; the answer is grovespec-revise
// (reconcile spec ↔ code), so validate stays green and this command surfaces the list.
// Exit 1 when signals exist (CI can watch it); the skills surface it, never block on it.
import { git, porcelainPaths, repoState, shallowState, showPrefix, log, mergeHashes, TASK_COMMIT, SKILL_COMMIT, HOTFIX_COMMIT, alignedBy, gitFailure } from './git.mjs'

const say = s => process.stdout.write(s + '\n')
const PLAN_COMMIT = /^plan #[0-9]+: /

// ── grading (v0.15.0) ─────────────────────────────────
// Not every out-of-band change carries the same interest rate. One that touches a
// done node's CONTRACT surface compounds — the next gated consumer builds on the
// stale contract — so it wants a revise before anyone reads it. One inside the
// contract is cheap debt: it can wait for a later cleanup batch. The distinction is a
// computation (owner's Contract idents ∩ the change's text), so fresh makes the
// call instead of leaving it to an agent's or a person's judgment at absorption
// time. The hook (bin/hook-route.mjs) mirrors these two helpers at edit time.

// Every commit HEAD reaches, oldest first, with the files it touched — ONE git call
// (v0.24.0). fresh asked git once per commit (and once per file for its owner), which
// was tolerable over src/tests; the watched scope now covers resources too, and on a
// real project with art commits that cost minutes, each git start nearly a second.
// null when git log fails. A rename lists both of its paths (--no-renames, the rule
// git.mjs touched() states): a move OUT of a watched area or a nested project's subtree
// changed it, and git's rename view shows only where the file went (Codex re-review
// 2026-11-09, R1 · R3).
function historyFiles (P) {
  const r = git(P.root, ['log', '--reverse', '--format=%x01%H%x02%s', '--name-only', '-z', '--diff-merges=first-parent', '--no-renames', 'HEAD'])
  if (!r.ok) return null
  const out = []
  for (const chunk of r.out.split('\x01')) {
    const cut = chunk.indexOf('\x02')
    if (cut === -1) continue
    const rest = chunk.slice(cut + 1)
    const end = rest.indexOf('\0')
    out.push({
      h: chunk.slice(0, cut),
      s: end === -1 ? rest : rest.slice(0, end),
      files: end === -1 ? [] : rest.slice(end + 1).replace(/^\n/, '').split('\0').filter(Boolean)
    })
  }
  return out
}

// The commits of a project nested in a larger repository: those whose change — a merge's
// against its first parent, what it brought into this line — touches the project's subtree.
// Not `git rev-list HEAD -- .`: history simplification drops a merge that matches one of
// its parents there, which is exactly an ordinary `--no-ff` merge of a branch (Codex review
// 2026-11-09, F1) — and both sides of a rename count (R1). An empty commit touches nothing,
// so it is never the project's — the limit the nested filters always stated. null when git
// log fails.
export function nestedCommits (P, pfx) {
  const hist = historyFiles(P)
  return hist === null ? null : new Set(hist.filter(c => c.files.some(f => f.startsWith(pfx))).map(c => c.h))
}

// Owner = the most recent `TASK-N:` cycle commit touching the file — now, or (for a
// graded commit) just before that commit landed. `wanted` names the commits whose
// before-owners are needed.
function ownerIndex (hist, wanted) {
  const now = new Map(); const at = new Map()
  for (const c of hist) {
    if (wanted.has(c.h)) at.set(c.h, new Map(c.files.map(f => [f, now.get(f) ?? null])))
    const m = c.s.match(/^(TASK-\d+): /)
    if (m) for (const f of c.files) now.set(f, m[1])
  }
  return { now, at }
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
    if (hit === null) lines.push(`    → ${owner} (${name}): inside the contract — can wait for a later cleanup batch`)
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
  if (rs === 'broken') return { dirty: [], offband: [], adoption: null, repo: true, nested: false, areas: [], broken: `git did not answer (${gitFailure()})` }
  const sh = shallowState(P.root)
  if (sh === 'broken') return { dirty: [], offband: [], adoption: null, repo: true, nested: false, areas: [], broken: 'git rev-parse --is-shallow-repository failed' }
  if (sh === 'shallow') return { dirty: [], offband: [], adoption: null, repo: true, nested: false, areas: [], broken: 'shallow clone — classification over cut history would under-report; unshallow it (git fetch --unshallow)' }

  if (P.pathProblems.length) return { dirty: [], offband: [], adoption: null, repo: true, nested: false, areas: [], broken: 'config paths are unresolvable (run grovespec validate)' }
  const own = P.ownPaths()
  const outsideOwn = g => g !== '' && !own.some(o => g === o || g.startsWith(`${o}/`))
  const areas = ['the project outside GroveSpec\'s own files']

  // git reports paths relative to the REPO root; a project nested deeper (a monorepo
  // subdir, a fixture inside a bigger repo) sees its own files behind that prefix.
  const pr = git(P.root, ['rev-parse', '--show-prefix'])
  if (!pr.ok) return { dirty: [], offband: [], adoption: null, repo: true, areas, nested: false, broken: 'git rev-parse --show-prefix failed' }
  const pfx = pr.out.trim()                              // '' exactly at the toplevel
  const nested = pfx !== ''
  const inAreas = f => f.startsWith(pfx) && outsideOwn(f.slice(pfx.length))

  // -uall: an untracked directory folds to one `?? dir/` line by default, and the
  // fold hid nested untracked files from the area filter (same hole dirtyUnder had).
  const st = git(P.root, ['status', '--porcelain', '--untracked-files=all'])
  if (!st.ok) return { dirty: [], offband: [], adoption: null, repo: true, areas, nested, broken: 'git status failed (corrupt index?)' }
  const dirty = st.out.split('\n').filter(Boolean).filter(l => porcelainPaths(l).some(inAreas))

  // Committed history is classified only at the toplevel. Nested, the outer repo's
  // ordinary life (none of its commits TASK-prefixed) would all read as this project's
  // signals — and a project checked into a bigger repo would see its `next` change as
  // that repo's history grows. Nested projects keep the uncommitted signals above.
  if (nested) return { dirty, offband: [], adoption: null, repo: true, areas, nested, outsideOwn, broken: null }

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
    let after = new Set(r.out.split('\n').filter(Boolean))
    // A planning pass reconciles what came before it (v0.24.0): plan collects `fresh` and
    // disposes of every signal — absorbed through a reopen, or dropped — and its own
    // `plan #N:` commit is the record that it did. Counted from adoption, a reconciled
    // commit stayed a signal for good, and an all-done tree routed to plan again after
    // every plan. So the newest plan after adoption is where counting starts; uncommitted
    // changes are signals whatever the anchor.
    const plan = all.find(c => after.has(c.h) && PLAN_COMMIT.test(c.s)) ?? null
    if (plan !== null) {
      const pr2 = git(P.root, ['rev-list', `${plan.h}..HEAD`])
      if (!pr2.ok) return { dirty, offband: [], adoption, repo: true, areas, nested, broken: 'git rev-list failed' }
      after = new Set(pr2.out.split('\n').filter(Boolean))
    }
    const anchor = plan !== null ? `${plan.s.match(/^plan #[0-9]+/)[0]} ${plan.h.slice(0, 7)}` : `adoption ${adoption.slice(0, 7)}`
    // Merge commits are not classified: their content arrived via the branch's own
    // commits, which this very loop already answers for — counting the merge again
    // reported TASK-attributed work as out-of-band. (A conflict resolution's own
    // hand-content is invisible here — a stated limit, same as the nested case.)
    const merges = mergeHashes(P.root)
    if (merges === null) return { dirty, offband: [], adoption, repo: true, areas, nested, broken: 'git rev-list --merges failed' }
    const hist = historyFiles(P)
    if (hist === null) return { dirty, offband: [], adoption, repo: true, areas, nested, broken: 'git log --name-only failed (git >= 2.31 required)' }
    const filesOf = new Map(hist.map(c => [c.h, c.files]))
    // Attribution is by the documented commit grammar, both shapes: the `TASK-N:`
    // cycle anchor AND the skills' step/gate/decision shapes (SKILL_COMMIT) — a
    // `review TASK-N:` commit is the skills' own writing, not a hand edit. A `hotfix:`
    // commit stays a signal until an `align` commit names it (hotfixState below).
    const aligned = alignedBy(all)
    for (const c of all) {
      if (!after.has(c.h) || merges.has(c.h) || TASK_COMMIT.test(c.s) || SKILL_COMMIT.test(c.s) || (HOTFIX_COMMIT.test(c.s) && aligned(c.h))) continue
      if ((filesOf.get(c.h) ?? []).some(inAreas)) offband.push({ ...c, files: filesOf.get(c.h) })
    }
    return { dirty, offband, adoption, anchor, planned: plan !== null, repo: true, areas, nested, outsideOwn, hist, broken: null }
  }
  return { dirty, offband, adoption, anchor: null, planned: false, repo: true, areas, nested, outsideOwn, hist: [], broken: null }
}

// The hotfix lane's ledger (v0.29.0): `hotfix: …` commits that no `align <sha>: …` commit
// names yet, oldest first. Counted in the window fresh counts in — after GroveSpec arrived
// and after the newest plan, which reconciled what came before it (a hotfix made under an
// older runtime included). One git call when history holds no hotfix subject; a broken git
// is said, never folded into "nothing owed" (cmd-next stops on it).
export function hotfixState (P) {
  const rs = repoState(P.root)
  if (rs !== 'repo') return { owed: [], broken: rs === 'broken' ? `git did not answer (${gitFailure()})` : null }
  let all = log(P.root)
  if (all === null) return { owed: [], broken: 'git log failed' }
  if (!all.some(c => HOTFIX_COMMIT.test(c.s))) return { owed: [], broken: null }
  const list = args => { const r = git(P.root, args); return r.ok ? new Set(r.out.split('\n').filter(Boolean)) : null }
  // Nested in a larger repository, this project's history is the commits touching its own
  // subtree — the hotfix, the align naming it and the plan reconciling it alike: a
  // neighbour project's plan or align must not close this one's debt (cold review 2026-11-08).
  const pfx = showPrefix(P.root)
  if (pfx === null) return { owed: [], broken: 'git rev-parse --show-prefix failed' }
  if (pfx !== '') {
    const ours = nestedCommits(P, pfx)
    if (ours === null) return { owed: [], broken: 'git log --name-only failed (git >= 2.31 required)' }
    all = all.filter(c => ours.has(c.h))
  }
  const aligned = alignedBy(all)
  const hot = all.filter(c => HOTFIX_COMMIT.test(c.s) && !aligned(c.h))
  if (!hot.length) return { owed: [], broken: null }
  const gs = git(P.root, ['rev-list', '--reverse', 'HEAD', '--', '.grovespec'])
  if (!gs.ok) return { owed: [], broken: 'git rev-list failed' }
  const tasks = all.filter(c => TASK_COMMIT.test(c.s))
  const adoption = gs.out.split('\n').find(Boolean) ?? (tasks.length ? tasks[tasks.length - 1].h : null)
  if (adoption === null) return { owed: [], broken: null }
  let window = list(['rev-list', `${adoption}..HEAD`])
  const plan = window === null ? null : all.find(c => window.has(c.h) && PLAN_COMMIT.test(c.s)) ?? null
  if (plan !== null) window = list(['rev-list', `${plan.h}..HEAD`])
  if (window === null) return { owed: [], broken: 'git rev-list failed' }
  return { owed: hot.filter(c => window.has(c.h)).reverse(), broken: null }
}

// Parked work the newest planning pass already ruled on (v0.25.0). A plan dispositions the
// whole parked list it is shown — adopt, drop, or keep parked — and its `plan #N:` commit is
// the record that it did. Before this, a list the person had just chosen to keep parked sent
// `next` straight back to plan: "keep it all for later" came back as the same questions four
// minutes on, and a request kept for later as the same question at every plan. Returns that
// plan's anchor when nothing parked has moved since — the backlog files and the gate records
// (where followups live), committed or not; null when there is no plan yet, something moved,
// or git cannot tell, which routes to plan as before.
export function planSaw (P) {
  if (repoState(P.root) !== 'repo') return null
  const all = log(P.root)
  if (all === null) return null
  const plan = all.find(c => PLAN_COMMIT.test(c.s))
  if (plan === undefined) return null
  const paths = [P.reviewDir, P.findingsPath, P.restructuringPath, P.requestsPath]
    .map(p => `:(literal)${p.slice(P.root.length + 1)}`)
  const moved = git(P.root, ['log', '-1', '--format=%H', `${plan.h}..HEAD`, '--', ...paths])
  if (!moved.ok || moved.out.trim() !== '') return null
  const dirty = git(P.root, ['status', '--porcelain', '--untracked-files=all', '--', ...paths])
  if (!dirty.ok || dirty.out.trim() !== '') return null
  return `${plan.s.match(/^plan #[0-9]+/)[0]} ${plan.h.slice(0, 7)}`
}

export function cmdFresh (P) {
  const sig = freshSignals(P)
  if (sig.broken !== null) { say(`fresh: cannot classify history — ${sig.broken}; nothing was reported (a git failure is not a clean pass)`); return 2 }
  if (!sig.repo) { say('not a git repository — fresh compares history against the skills\' commits'); return 2 }
  const { dirty, offband, adoption, anchor, planned, nested, outsideOwn, hist } = sig

  if (dirty.length === 0 && offband.length === 0) {
    if (nested) say('fresh: clean — uncommitted only (nested in a larger repository; committed history is not classified here)')
    else say(`fresh: clean — every change to the project${planned ? ` since ${anchor} (the plan reconciled what came before)` : ''} went through the skills' commits (GroveSpec's own files and the agent hosts' aside)${adoption === null ? ' (no adoption anchor yet — no committed .grovespec, no TASK- commit)' : ''}`)
    return 0
  }
  say('fresh: out-of-band signals — changes to the project that did not go through the skills')
  const inArea = outsideOwn
  const idx = nested ? null : ownerIndex(hist ?? [], new Set(offband.map(c => c.h)))
  if (dirty.length) {
    say('uncommitted:')
    for (const l of dirty) {
      say(`  ${l}`)
      if (nested) continue // paths carry the outer repo's prefix — owners aren't ours to name
      const owners = new Map()
      for (const p of porcelainPaths(l).filter(inArea)) {
        // An untracked file has no history to own it — nothing to grade.
        const o = l.startsWith('??') ? null : (idx?.now.get(p) ?? null)
        if (owners.has(o)) continue
        if (o === null) owners.set(o, '')
        // --unified=0: grade the CHANGED lines only — default context lines made a
        // neighbouring contract name read as touched (measured on the first smoke).
        else { const d = git(P.root, ['diff', '--unified=0', 'HEAD', '--', p]); owners.set(o, changedOnly(d.ok ? d.out : null)) }
      }
      for (const g of gradeLines(P, owners)) say(g)
    }
  }
  if (offband.length) {
    say(`commits outside the skills (since ${anchor}${planned ? ', which reconciled what came before' : ''}):`)
    for (const c of offband) {
      say(`  ${c.h.slice(0, 7)} ${c.s}`)
      const tf = c.files
      const show = git(P.root, ['show', c.h, '--format=', '--unified=0'])
      const patch = changedOnly(show.ok ? show.out : null)
      const owners = new Map()
      for (const p of tf.filter(inArea)) { const o = idx?.at.get(c.h)?.get(p) ?? null; if (!owners.has(o)) owners.set(o, patch) }
      for (const g of gradeLines(P, owners)) say(g)
    }
  }
  if (nested) say('(nested in a larger repository — committed history is not classified here; the list above is uncommitted changes only)')
  say('→ contract-surface items want a revise before a consumer reads them; inside-the-contract items can wait for a later cleanup batch. grovespec-revise absorbs either.')
  return 1
}
