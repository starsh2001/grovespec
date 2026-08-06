// files — which code belongs to a node, computed from its `TASK-N:` commits across
// every cycle (diff answers the same question for ONE cycle; this is the node's whole
// footprint). It exists to bound a read: "what does this feature touch — screen, api,
// migration?" is answered by the list, and any deeper question (what these objects do,
// what calls what) is then a read of THESE files rather than a grep of the codebase.
//
// Nothing is stored: the mapping is derived from history every time, so it cannot drift.
import { existsSync } from 'node:fs'
import { inRepo, log, touched } from './git.mjs'

const say = s => process.stdout.write(s + '\n')

export function cmdFiles (P, n) {
  if (n === '') { say('usage: grovespec files TASK-N'); return 2 }
  if (P.read(P.taskPath(n)) === null) { say(`no such node: ${n}`); return 2 }
  if (!inRepo(P.root)) { say("not a git repository — files reads the node's TASK- commits"); return 2 }

  const commits = log(P.root).filter(c => c.s.startsWith(`${n}: `))
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
  for (const c of commits) for (const f of touched(P.root, c.h)) seen.add(f)
  if (ownTask !== null) seen.delete(ownTask)

  const all = [...seen].sort()
  const live = all.filter(f => existsSync(`${P.root}/${f}`))
  const gone = all.length - live.length
  const dirs = new Set(live.map(f => (f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.')))

  say(`files of ${n} (${P.nameOf(n)}) — ${live.length} file(s) in ${dirs.size} dir(s), from ${commits.length} '${n}:' commit(s)${gone ? `; ${gone} touched then deleted, not listed` : ''}`)
  for (const f of live) say(`  ${f}`)
  return 0
}
