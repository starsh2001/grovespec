// package — the work-package ledger's writer (v0.30.0; the ledger and its reasons: packages.mjs).
// grovespec-plan bundles the milestone's nodes into packages, each handed to one implementer
// model within that model's budget — config `packages:`, `<model>: <AC items one session of
// it covers>`. The budget is the plan's guide, not a gate: a sketch's AC is not written yet,
// so `add` reports the count against it and the retro measures what the packages cost.
import { writeAtomic } from './project.mjs'
import { nodeSize, splitLines } from './core.mjs'
import { packageState, packagesPath, now, PACKAGE_ID } from './packages.mjs'

const say = s => process.stdout.write(s + '\n')
const TID = /^TASK-[0-9]+$/
const quote = s => `'${s.replace(/'/g, "''")}'`

// The lines of config `packages:`, read leniently enough for real model names — `opus[1m]`,
// a quoted `"gpt-5.1-codex"` (the shared config reader takes plain identifier keys only).
// A line that is not `<model>: <value>` comes back with value null, for validate to name.
export function packageEntries (configText) {
  const lines = splitLines(configText)
  const at = lines.findIndex(l => /^packages[ \t]*:[ \t]*(#.*)?$/.test(l))
  if (at === -1) return []
  const out = []
  for (const l of lines.slice(at + 1)) {
    if (/^[ \t]*(#.*)?$/.test(l)) continue
    if (!/^[ \t]/.test(l)) break
    const m = l.trim().match(/^(?:"([^"]+)"|'([^']+)'|([^\s"'#:][^#:]*?))[ \t]*:[ \t]*([^#]*?)[ \t]*(#.*)?$/)
    out.push(m ? { key: m[1] ?? m[2] ?? m[3], value: m[4].replace(/^(['"])(.*)\1$/, '$2').trim() } : { key: l.trim(), value: null })
  }
  return out
}

// config `packages:` → Map(model → budget). A value that is not a whole number is skipped
// here and named by validate.
export function packageModels (P) {
  const m = new Map()
  for (const { key, value } of packageEntries(P.configText)) if (value !== null && /^[0-9]+$/.test(value)) m.set(key, Number(value))
  return m
}

export const acOf = (P, nodes) => nodes.reduce((sum, t) => sum + nodeSize(P.read(P.taskPath(t)) ?? '').ac, 0)

function serialize (packages) {
  const lines = ['packages:']
  for (const p of packages) {
    lines.push(`  - id: ${p.id}`)
    lines.push(`    model: ${quote(p.model)}`)
    lines.push(`    nodes: ${p.nodes.join(' ')}`)
    lines.push(`    declared: ${p.declared}`)
    lines.push(`    dropped: ${p.dropped === '' ? "''" : p.dropped}`)
    lines.push(`    closed: ${p.closed === '' ? "''" : p.closed}`)
  }
  return lines.join('\n') + '\n'
}

// Called by approve after a node reaches done: every open package whose nodes are all done
// now is stamped closed, for good. Returns the ids it closed ([] when the ledger is absent or
// unreadable — approve's own verdict never waits on this ledger).
export function closeFinished (P) {
  const st = packageState(P)
  if (!st.present || st.shape.length) return []
  const ts = now()
  if (ts === null) return []
  const done = st.packages.filter(p => p.dropped === '' && p.closed === '' && p.nodes.every(t => P.statusOf(t) === 'done'))
  if (!done.length) return []
  for (const p of done) p.closed = ts
  writeAtomic(packagesPath(P), serialize(st.packages))
  return done.map(p => p.id)
}

const USAGE = 'usage: grovespec package                       — list the work packages\n' +
  '       grovespec package add <model> TASK-…    — one session of <model> builds these nodes (grovespec-plan)\n' +
  '       grovespec package drop WP-N             — close an open package; its nodes run one by one again\n'

export function cmdPackage (P, args) {
  const st = packageState(P)
  for (const m of st.problems) say(m)
  if (args.length === 0) return list(P, st)
  // A ledger whose entries cannot be read takes no write; one whose state is wrong (an open
  // package naming a node merged away) still takes the drop that repairs it.
  if (args[0] === 'drop' && st.shape.length === 0) return drop(P, st, args.slice(1))
  if (st.problems.length) { say('the package ledger cannot be written over as it stands — fix the lines above first'); return 2 }
  if (args[0] === 'add') return add(P, st, args.slice(1))
  say(USAGE.trimEnd())
  return 2
}

function list (P, st) {
  if (st.shape.length) { say('the package ledger cannot be read — fix the lines above first'); return 2 }
  if (st.packages.length === 0) { say('no work packages — nodes run one by one (grovespec-plan makes packages when config packages: names a model)'); return 0 }
  const models = packageModels(P)
  for (const p of st.packages) {
    const done = p.nodes.filter(t => P.statusOf(t) === 'done').length
    const state = p.dropped !== '' ? `dropped ${p.dropped}` : p.closed !== '' ? `closed ${p.closed}` : p.open ? `open, ${done} of ${p.nodes.length} done` : 'done'
    const budget = models.has(p.model) ? ` · ${acOf(P, p.nodes)} AC items of ${models.get(p.model)}` : ''
    say(`${p.id}  ${p.model} — ${p.nodes.map(t => `${t} (${P.statusOf(t) || 'gone'})`).join(' · ')} — ${state}${budget}`)
  }
  return st.problems.length ? 2 : 0
}

function add (P, st, args) {
  const [model = '', ...nodes] = args
  if (model === '' || nodes.length === 0) { say(USAGE.trimEnd()); return 2 }
  const models = packageModels(P)
  if (models.size === 0) { say('config packages: names no implementer model — add `<model>: <AC items one session covers>` there first (FORMATS.md "config.yaml"); without it nodes run one by one'); return 2 }
  if (!models.has(model)) { say(`config packages: has no '${model}' — it names ${[...models.keys()].join(' · ')}`); return 2 }
  const ids = new Set(P.treeIds())
  const seen = new Set()
  for (const t of nodes) {
    if (!TID.test(t)) { say(`'${t}' is not a TASK id`); return 2 }
    if (seen.has(t)) { say(`${t} is named twice`); return 2 }
    seen.add(t)
    if (!ids.has(t)) { say(`${t} is not in the tree`); return 2 }
    if (P.statusOf(t) === 'done') { say(`${t} is done — a package builds open nodes; reopen it first if it must change (grovespec-revise)`); return 2 }
    const other = st.openOf(t)
    if (other !== null) { say(`${t} is already in ${other.id} — one session builds a node (grovespec package drop ${other.id} to regroup)`); return 2 }
  }
  const ts = now()
  if (ts === null) { say(`GROVESPEC_NOW is not an ISO-8601 UTC timestamp: '${process.env.GROVESPEC_NOW}' — refused`); return 2 }
  const top = st.packages.reduce((n, p) => Math.max(n, PACKAGE_ID.test(p.id) ? Number(p.id.slice(3)) : 0), 0)
  const p = { id: `WP-${top + 1}`, model, nodes, declared: ts, dropped: '', closed: '' }
  writeAtomic(packagesPath(P), serialize([...st.packages, p]))
  const ac = acOf(P, nodes)
  const budget = models.get(model)
  say(`package: ${p.id} — ${model} builds ${nodes.join(' · ')} in one session`)
  say(`  AC items now ${ac} of its budget ${budget}${ac > budget ? ' — over the budget: split the package or give it a bigger model' : ''} (a sketch's AC counts once it is grown)`)
  return 0
}

function drop (P, st, args) {
  const [id = ''] = args
  if (!PACKAGE_ID.test(id) || args.length !== 1) { say(USAGE.trimEnd()); return 2 }
  const p = st.packages.find(x => x.id === id)
  if (!p) { say(`no package ${id}`); return 2 }
  if (!p.open) { say(`${id} is ${p.dropped !== '' ? 'already dropped' : p.closed !== '' ? 'closed' : 'done'} — nothing to drop`); return 2 }
  const ts = now()
  if (ts === null) { say(`GROVESPEC_NOW is not an ISO-8601 UTC timestamp: '${process.env.GROVESPEC_NOW}' — refused`); return 2 }
  p.dropped = ts
  writeAtomic(packagesPath(P), serialize(st.packages))
  say(`dropped: ${id} — ${p.nodes.join(' · ')} run one by one again, or join another package`)
  return 0
}
