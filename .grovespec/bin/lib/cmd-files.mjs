// files — which code belongs to a node, computed from its `TASK-N:` commits across
// every cycle (diff answers the same question for ONE cycle; this is the node's whole
// footprint). It exists to bound a read: "what does this feature touch — screen, api,
// migration?" is answered by the list, and any deeper question (what these objects do,
// what calls what) is then a read of THESE files rather than a grep of the codebase.
//
// Nothing is stored: the mapping is derived from history every time, so it cannot drift.
import { git, repoState, shallowState, showPrefix, trackedPaths, log, touched } from './git.mjs'

const say = s => process.stdout.write(s + '\n')

export function cmdFiles (P, n) {
  if (n === '') { say('usage: grovespec files TASK-N'); return 2 }
  if (P.read(P.taskPath(n)) === null) { say(`no such node: ${n}`); return 2 }
  const rs = repoState(P.root)
  if (rs === 'broken') { say('git did not answer (missing or failing git) — nothing was listed'); return 2 }
  if (rs === 'none') { say("not a git repository — files reads the node's TASK- commits"); return 2 }
  const sh = shallowState(P.root)
  if (sh === 'broken') { say('git rev-parse --is-shallow-repository failed — nothing was listed'); return 2 }
  if (sh === 'shallow') { say('this is a shallow clone — cycles behind the cut are invisible, so the footprint would under-count; unshallow it (git fetch --unshallow), then re-run'); return 2 }
  // touched() speaks repo-root-relative; this command answers project-relative.
  const pfx = showPrefix(P.root)
  if (pfx === null) { say('git rev-parse --show-prefix failed — nothing was listed'); return 2 }
  // "Still there" is a question about git's index, not the filesystem: existsSync said
  // yes to a DIRECTORY that had replaced a deleted file of that name, and on Windows
  // it answers yes to `Foo.js` and `foo.js` alike after a case-only rename.
  const tracked = trackedPaths(P.root)
  if (tracked === null) { say('git ls-files failed — nothing was listed'); return 2 }

  const history = log(P.root)
  if (history === null) { say('git log failed — nothing was listed'); return 2 }
  const commits = history.filter(c => c.s.startsWith(`${n}: `))
  if (commits.length === 0) {
    say(`files of ${n} (${P.nameOf(n)}) — no '${n}:' commits, so no code is attributed to this node yet`)
    if (P.originOf(n) === 'mapped') {
      say('  (origin: mapped — brownfield code predates the tree, so history cannot attribute it; grep the code, or let a revise cycle attribute what it touches)')
    }
    return 0
  }

  const rel = p => p.startsWith(`${P.root}/`) ? p.slice(P.root.length + 1) : null
  const ownTask = rel(P.taskPath(n))            // the node's own Task file — known by definition

  const seen = new Set()
  for (const c of commits) {
    const tf = touched(P.root, c.h)
    if (tf === null) { say(`cannot read the files of ${c.h.slice(0, 7)} — git show failed (git >= 2.31 is required for merge-aware diffs); nothing was listed`); return 2 }
    // Strip the repo prefix so a nested project's own files exist-check and print in
    // its own coordinates; a commit's files OUTSIDE the project (monorepo siblings)
    // are still part of the footprint — listed repo-rooted as `:/…`, never dropped.
    for (const f of tf) seen.add(f.startsWith(pfx) ? f.slice(pfx.length) : `:/${f}`)
  }
  if (ownTask !== null) seen.delete(ownTask)

  const all = [...seen].sort()
  // Both coordinates answer to the same index — "outside the project" never means
  // "assumed alive" (a deleted sibling stayed listed while its twin inside the
  // project was correctly dropped).
  const live = all.filter(f => tracked.has(f.startsWith(':/') ? f.slice(2) : `${pfx}${f}`))
  const gone = all.length - live.length
  const dirs = new Set(live.map(f => (f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.')))

  say(`files of ${n} (${P.nameOf(n)}) — ${live.length} file(s) in ${dirs.size} dir(s), from ${commits.length} '${n}:' commit(s)${gone ? `; ${gone} touched then deleted, not listed` : ''}`)
  for (const f of live) say(`  ${f}`)
  return 0
}
