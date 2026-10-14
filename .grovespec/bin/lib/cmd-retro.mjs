// retro — the milestone's closing look (v0.16.0).
//
// Node-scoped gates structurally cannot see a defect COMPOSED across nodes: the
// launcher's startup-timeout dead-end (M1) had every ingredient recorded in three
// different Tasks and was found only by an out-of-band whole-tree review after all
// gates were green. The retro institutionalizes that look: when every node is done,
// ONE cross-node pass runs before the next plan — measured numbers first, then cold
// lenses that deliberately read across contract seams.
//
// This command is the deterministic floor of that step: it answers whether a retro
// is OWED and prints the milestone's measured numbers; the prose, the cold wave and the
// record belong to grovespec-retro (the skill). Owed = any `TASK-N:` cycle commit
// after the newest retro record's anchor (or since GroveSpec arrived, when no record
// exists) — the retro's own commit is not TASK-shaped, so a closed retro never owes itself.
//
// TERMINATION SAFETY: a retro never reopens a node and never blocks `done` — a
// capable reviewer asked again always returns something, so a closing review that
// could veto completion is a completion that never comes. Its must-fix findings are
// written into the standing backlogs (findings.md / restructuring.md), which already
// route the terminal to plan — the milestone stays closed; the NEXT milestone gains a reason
// to open.
import { readdirSync } from 'node:fs'
import { git, repoState, shallowState, showPrefix, log, TASK_COMMIT, SKILL_COMMIT, gitFailure } from './git.mjs'
import { freshSignals } from './cmd-fresh.mjs'
import { readWaits } from './cmd-wait.mjs'

const say = s => process.stdout.write(s + '\n')

// The newest retro record: paths.review/retro-N.md, highest N. Its frontmatter
// `anchor:` is the commit the milestone closed on. Missing/never = no anchor.
// Retro records are md on purpose — prose for a person, not gate state — so
// validate's yaml record sweep never adopts them; the directory is read directly.
export function latestRetro (P) {
  let best = null
  let names = []
  try { names = readdirSync(P.reviewDir) } catch { names = [] }
  for (const n of names) {
    const m = n.match(/^retro-([0-9]+)\.md$/)
    if (!m) continue
    const num = Number(m[1])
    if (best === null || num > best.n) best = { n: num, path: `${P.reviewDir}/${n}` }
  }
  if (best === null) return { n: 0, anchor: null, path: null }
  const text = P.read(best.path) ?? ''
  const a = text.match(/^anchor:\s*([0-9a-f]{7,40})\s*$/m)
  return { n: best.n, anchor: a ? a[1] : null, path: best.path }
}

// Owed-state for cmd-next's terminal: { owed, n, anchor, broken }.
export function retroOwed (P) {
  const rs = repoState(P.root)
  if (rs !== 'repo') return { owed: false, n: 0, anchor: null, broken: rs === 'broken' ? 'git did not answer' : null }
  const last = latestRetro(P)
  if (last.path !== null && last.anchor === null) return { owed: false, n: last.n, anchor: null, broken: `${last.path} has no readable anchor: line — the owed-state is unknowable until it is repaired` }
  const all = log(P.root)
  if (all === null) return { owed: false, n: last.n, anchor: last.anchor, broken: 'git log failed' }
  let commits = all
  // A project nested in a larger repository sees the OUTER repo's history too — an
  // unrelated outer `TASK-77:` commit read as this project's work and made a debt
  // no retro could ever clear (external review 2026-09-25, F4). Nested, the milestone
  // is only the commits touching the project's own subtree (`-- .` relative to the
  // project root). Stated limit, same as fresh's: an empty commit inside a nested
  // project is invisible to a pathspec and goes uncounted.
  const pfx = showPrefix(P.root)
  if (pfx === null) return { owed: false, n: last.n, anchor: last.anchor, broken: 'git rev-parse --show-prefix failed' }
  if (pfx !== '') {
    const own = git(P.root, ['rev-list', 'HEAD', '--', '.'])
    if (!own.ok) return { owed: false, n: last.n, anchor: last.anchor, broken: 'git rev-list failed' }
    const ours = new Set(own.out.split('\n').filter(Boolean))
    commits = commits.filter(c => ours.has(c.h))
  }
  let adopted = null
  if (last.anchor !== null) {
    const r = git(P.root, ['rev-list', `${last.anchor}..HEAD`])
    if (!r.ok) return { owed: false, n: last.n, anchor: last.anchor, broken: `git rev-list failed — is the anchor ${last.anchor.slice(0, 7)} still reachable?` }
    const after = new Set(r.out.split('\n').filter(Boolean))
    commits = commits.filter(c => after.has(c.h))
  } else {
    // No retro yet: the first milestone begins where GroveSpec arrived — the oldest
    // commit touching .grovespec/ — not at the repository's first commit. An adopted
    // project with years of history counted all of it "in the milestone".
    const first = git(P.root, ['rev-list', '--topo-order', '--reverse', 'HEAD', '--', '.grovespec'])
    if (!first.ok) return { owed: false, n: last.n, anchor: null, broken: 'git rev-list failed' }
    adopted = first.out.split('\n').find(Boolean) ?? null
    if (adopted !== null) {
      const r = git(P.root, ['rev-list', 'HEAD', '--not', `${adopted}^@`])
      if (!r.ok) return { owed: false, n: last.n, anchor: null, broken: 'git rev-list failed' }
      const after = new Set(r.out.split('\n').filter(Boolean))
      commits = commits.filter(c => after.has(c.h))
    }
  }
  const work = commits.filter(c => TASK_COMMIT.test(c.s))
  return { owed: work.length > 0, n: last.n, anchor: last.anchor, adopted, work, inMilestone: commits, broken: null }
}

export function cmdRetro (P) {
  const rs = repoState(P.root)
  if (rs === 'none') { say('not a git repository — retro measures the milestone from its commits'); return 2 }
  if (rs === 'broken') { say(`git did not answer (${gitFailure()}) — nothing was measured`); return 2 }
  if (shallowState(P.root) === 'shallow') { say('shallow clone — the milestone\'s history is cut; unshallow it (git fetch --unshallow), then re-run'); return 2 }
  const o = retroOwed(P)
  if (o.broken !== null) { say(`retro: cannot decide — ${o.broken}`); return 2 }

  if (!o.owed) {
    say(`retro: clean — no TASK- work since ${o.anchor === null ? 'ever (empty milestone)' : `retro-${o.n} (anchor ${o.anchor.slice(0, 7)})`}; nothing to close`)
    return 0
  }

  // ── the milestone, measured ──
  const perNode = new Map()
  for (const c of o.work) {
    const id = c.s.match(/^(TASK-[0-9]+): /)[1]
    perNode.set(id, (perNode.get(id) ?? 0) + 1)
  }
  const steps = o.inMilestone.filter(c => SKILL_COMMIT.test(c.s)).length

  const escalated = []
  for (const f of P.reviewFiles()) {
    const t = P.read(f) ?? ''
    if (/^status:\s*escalated\s*$/m.test(t)) escalated.push(f.slice(P.root.length + 1))
  }
  const waits = readWaits(P)
  const bare = v => String(v ?? '').replace(/^(['"])(.*)\1$/, '$2').trim()
  const liveWaits = Array.isArray(waits?.entries) ? waits.entries.filter(e => bare(e.resolved) === '').length : 0
  const unratified = P.treeIds().filter(t => P.unratified(t).length)
  const sig = freshSignals(P)
  const freshLine = sig.broken !== null ? `unreadable (${sig.broken})` : `${sig.dirty.length} uncommitted · ${sig.offband.length} out-of-band commit(s)`

  say(`retro: owed — TASK- work landed since ${o.anchor !== null ? `retro-${o.n} (anchor ${o.anchor.slice(0, 7)})` : o.adopted !== null ? `GroveSpec arrived (${o.adopted.slice(0, 7)} — no retro yet)` : 'the beginning (no retro yet)'}`)
  say(`the milestone, measured:`)
  say(`  nodes worked: ${perNode.size} — ${[...perNode.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(' · ')}`)
  say(`  commits: ${o.work.length} TASK cycle · ${steps} gate/step — ${o.work.length + steps} of ${o.inMilestone.length} total in the milestone`)
  say(`  escalated cycles: ${escalated.length}${escalated.length ? ' — ' + escalated.join(' · ') : ''}`)
  say(`  live waits: ${liveWaits} · machine-approved awaiting ratify: ${unratified.length}${unratified.length ? ` (${unratified.join(', ')})` : ''}`)
  say(`  fresh debt: ${freshLine}`)
  say(`next record: ${P.reviewDir.slice(P.root.length + 1)}/retro-${o.n + 1}.md — grovespec-retro writes it (anchor = the HEAD its commit lands on top of)`)
  say('→ the retro never reopens a node: must-fix findings go to findings.md/restructuring.md for the next plan; the milestone stays closed.')
  return 1
}
