// The work-package ledger (v0.30.0 — a 2026-11-09 user decision). A work package (`WP-N`)
// is a set of nodes the plan gives ONE session and one implementer model, sized to that
// model's budget (config `packages:`). Node by node, every step was its own session that
// re-read the skills, the Tasks and the conventions (one measured milestone: 46 sessions,
// 754M tokens); a package runs its nodes through every gate in one (grovespec-package).
// The nodes keep their own specs, records and seals — the package changes how many
// sessions run them, nothing they must pass.
//
// Ledger: .grovespec/packages.yaml — top-level `packages:` block list, written only by
// `grovespec package` and by approve (runtime-owned, like waits.yaml). Entries are never
// deleted, so an id is never reused. A package is OPEN until it is `closed` — approve
// stamps that when its last node is done, so a node reopened or merged away later never
// reopens a finished package (cold review 2026-11-09) — or `dropped` by hand.
//
// Core-only imports on purpose: git.mjs (the result seal) and project.mjs (grow routing)
// read this ledger, and both sit below the command modules.
import { listItems, itemValue } from './core.mjs'

export const packagesPath = P => `${P.root}/.grovespec/packages.yaml`
export const PACKAGE_ID = /^WP-[0-9]+$/
const TID = /^TASK-[0-9]+$/
const ISO = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$/
const unq = s => {
  const t = s.trim()
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'")
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\(["\\])/g, '$1')
  return t
}

// The clock, pinnable for tests (GROVESPEC_NOW — the wait ledger's rule); null = malformed.
export function now () {
  const v = process.env.GROVESPEC_NOW ?? ''
  if (v === '') return new Date().toISOString()
  return ISO.test(v) ? v : null
}

// Never throws: an unreadable ledger comes back as problems, and every caller says so
// instead of scheduling as if there were no packages (that would run a package's nodes
// one by one under the wrong model).
export function packageState (P) {
  const path = packagesPath(P)
  const text = P.read(path)
  const empty = { problems: [], shape: [], packages: [], present: false, openOf: () => null }
  if (text === null) return empty
  // `shape` = the entry itself cannot be read (nothing may be written over it); the rest of
  // `problems` is state — a fix for it (drop) can still be written.
  const shape = []
  const state = []
  const items = listItems(text, 'packages')
  if (items.length === 0 && !/^packages[ \t]*:/m.test(text)) {
    const m = `${path}  no top-level 'packages:' list — the ledger exists but cannot be read`
    return { ...empty, present: true, problems: [m], shape: [m] }
  }
  const ids = new Set(P.treeIds())
  const seen = new Set()
  const packages = items.map((item, i) => {
    const p = {
      id: unq(itemValue(item, 'id')),
      model: unq(itemValue(item, 'model')),
      nodes: unq(itemValue(item, 'nodes')).split(/\s+/).filter(Boolean),
      declared: unq(itemValue(item, 'declared')),
      dropped: unq(itemValue(item, 'dropped')),
      closed: unq(itemValue(item, 'closed'))
    }
    const at = `${path}  entry ${i + 1}`
    if (!PACKAGE_ID.test(p.id)) shape.push(`${at}  'id' is not a WP-N id`)
    else if (seen.has(p.id)) shape.push(`${at}  ${p.id} appears twice — an id names one package`)
    seen.add(p.id)
    if (p.model === '') shape.push(`${at}  'model' is empty — a package names the model that builds it`)
    if (p.nodes.length === 0) shape.push(`${at}  'nodes' is empty`)
    for (const t of p.nodes) if (!TID.test(t)) shape.push(`${at}  '${t}' in 'nodes' is not a TASK id`)
    if (!ISO.test(p.declared)) shape.push(`${at}  'declared' is not an ISO-8601 UTC timestamp`)
    for (const k of ['dropped', 'closed']) if (p[k] !== '' && !ISO.test(p[k])) shape.push(`${at}  '${k}' is neither empty nor an ISO-8601 UTC timestamp`)
    p.open = p.dropped === '' && p.closed === '' && p.nodes.some(t => P.statusOf(t) !== 'done')
    // A closed package is history and may name a node later deleted; an open one may not —
    // its session would look for a node that is gone.
    if (p.open) for (const t of p.nodes) if (TID.test(t) && !ids.has(t)) state.push(`${at}  ${p.id} is open and names ${t}, which is not in the tree (grovespec package drop ${p.id}, or restore the node)`)
    return p
  })
  const owner = new Map()
  for (const p of packages.filter(p => p.open)) {
    for (const t of p.nodes) {
      if (owner.has(t)) state.push(`${path}  ${t} is in two open packages (${owner.get(t)} · ${p.id}) — one session builds a node (grovespec package drop one)`)
      else owner.set(t, p.id)
    }
  }
  return { problems: [...shape, ...state], shape, packages, present: true, openOf: tid => packages.find(p => p.open && p.nodes.includes(tid)) ?? null }
}
