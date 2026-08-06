// GroveSpec project model — the filesystem-bound layer: find the root, resolve config
// paths, read tasks and the tree. All paths are kept forward-slashed from the moment
// they are built, so every printed path is identical across platforms.
import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fmValue, treeRows, blockedIds, schValue, cfgValue, topValue } from './core.mjs'

// Status order — how far a node has advanced; evidence requirements key off this.
export const LIFECYCLE = ['sketch', 'draft', 'approved', 'implemented', 'reviewed', 'fixed', 'done']

const fwd = p => p.replace(/\\/g, '/')

export function scriptDir () {
  return fwd(dirname(fileURLToPath(import.meta.url)))   // .../.grovespec/bin/lib
}

// Walk up from CWD for a .grovespec/ dir; fallback: the install the script sits in.
export function findRoot () {
  let d = fwd(process.cwd())
  while (true) {
    if (existsSync(`${d}/.grovespec`) && statSync(`${d}/.grovespec`).isDirectory()) return d
    const up = fwd(dirname(d))
    if (up === d) break
    d = up
  }
  return fwd(dirname(dirname(scriptDir())))             // lib -> bin -> .grovespec -> root
}

export class Project {
  constructor () {
    this.root = findRoot()
    this.configPath = `${this.root}/.grovespec/config.yaml`
    this.configText = this.#read(this.configPath) ?? ''
    let schemaPath = `${this.root}/.grovespec/schema`
    if (!existsSync(schemaPath)) schemaPath = `${dirname(scriptDir())}/../schema`.replace(/\\/g, '/')
    this.schemaText = this.#read(fwd(schemaPath)) ?? ''
    const cfg = (key, dflt) => {
      let v = cfgValue(this.configText, key)
      if (v === '') v = dflt
      v = v.startsWith('/') ? v : `${this.root}/${v}`
      return v.replace(/\/$/, '')                        // drop one trailing slash
    }
    this.tasksDir = cfg('tasks', 'docs/tasks/')
    this.treePath = cfg('tree', 'docs/tree.md')
    this.briefPath = cfg('brief', 'docs/brief.md')
    this.convPath = cfg('conventions', 'docs/conventions.md')
    this.srcDir = cfg('src', 'src/')
    this.testsDir = cfg('tests', 'tests/')
    this.reviewDir = cfg('review', '.grovespec/review/')
    this.#cache = new Map()
  }

  #cache
  #read (p) {
    try { return readFileSync(p, 'utf8') } catch { return null }
  }
  read (p) {                                             // cached — one run is a snapshot
    if (!this.#cache.has(p)) this.#cache.set(p, this.#read(p))
    return this.#cache.get(p)
  }

  sch (key) { return schValue(this.schemaText, key) }

  // ---- tasks ----
  taskFiles () {                                         // mirrors `ls TASK-*.md` (byte order)
    let names
    try { names = readdirSync(this.tasksDir) } catch { return [] }
    return names.filter(n => n.startsWith('TASK-') && n.endsWith('.md')).sort()
      .map(n => `${this.tasksDir}/${n}`)
  }
  tidOf (file) { return file.slice(file.lastIndexOf('/') + 1).replace(/\.md$/, '') }
  taskPath (tid) { return `${this.tasksDir}/${tid}.md` }
  fm (file, key) {
    const t = this.read(file)
    return t === null ? '' : fmValue(t, key)
  }
  fmOf (tid, key) {                                      // '' when the file is missing
    const p = this.taskPath(tid)
    return this.read(p) === null ? '' : fmValue(this.read(p), key)
  }
  statusOf (tid) { return this.fmOf(tid, 'status') }
  nameOf (tid) { return this.fmOf(tid, 'name') }
  roleOf (tid) { return this.fmOf(tid, 'role') }
  blockedIdsOf (file) { return blockedIds(this.fm(file, 'blocked_by')) }

  // ---- tree ----
  treeText () { return this.read(this.treePath) ?? '' }
  rows () { return treeRows(this.treeText()) }
  treeIds () { return this.rows().map(r => r.tid) }
  parentOf (tid) { const r = this.rows().find(r => r.tid === tid); return r ? r.parent : '' }
  childrenOf (tid) { return this.rows().filter(r => r.parent === tid).map(r => r.tid) }

  // ---- review-state files (the gates' evidence) ----
  reviewFiles () {                                       // every *.yaml in the review dir
    let names
    try { names = readdirSync(this.reviewDir) } catch { return [] }
    return names.filter(n => n.endsWith('.yaml')).sort().map(n => `${this.reviewDir}/${n}`)
  }
  verifyYamlPath (tid) { return `${this.reviewDir}/${tid}.verify.yaml` }
  reviewYamlPath (tid) { return `${this.reviewDir}/${tid}.review.yaml` }
  reviewStatus (path) {                                  // '' when the file is missing
    const t = this.read(path)
    return t === null ? '' : topValue(t, 'status')
  }
  originOf (tid) { return this.fmOf(tid, 'origin') }
  // What this node is waiting on a HUMAN for — one spelling, read by both `status`
  // (which prints them) and `next` (which must never pick one: these transitions are
  // the human's). Empty array = nothing parked on the user.
  // Each entry: { kind, text }. `kind` is what a driver may act on — a clean gate
  // (approve/confirm) can be taken by the machine in auto mode; `escalated` never can,
  // because the machine itself reported that it did not converge.
  humanWaits (tid) {
    const st = this.statusOf(tid)
    const vst = this.reviewStatus(this.verifyYamlPath(tid))
    const rst = this.reviewStatus(this.reviewYamlPath(tid))
    const out = []
    if (st === 'draft' && vst === 'passed') out.push({ kind: 'approve', text: 'spec verify passed — awaiting approval (→ approved)' })
    if (vst === 'escalated') out.push({ kind: 'escalated', text: `spec verify escalated — needs a human ruling (${this.verifyYamlPath(tid)})` })
    if (st === 'reviewed' && rst === 'passed') out.push({ kind: 'confirm', text: 'review passed — awaiting confirm (→ done)' })
    if (rst === 'escalated') out.push({ kind: 'escalated', text: `review escalated — needs a human ruling (${this.reviewYamlPath(tid)})` })
    return out
  }

  // Gates a machine took on the human's behalf and nobody has ratified yet. Surfaced by
  // `status` and `validate` every run: an auto-approved node is not a human-approved one,
  // and the difference stops being a warranty the moment it stops being visible.
  unratified (tid) {
    const out = []
    for (const [label, p] of [['spec', this.verifyYamlPath(tid)], ['result', this.reviewYamlPath(tid)]]) {
      const t = this.read(p)
      if (t !== null && topValue(t, 'approved_by') === 'machine') out.push(label)
    }
    return out
  }

  forget () { this.#cache.clear() }        // after a write, re-read from disk
  // A brownfield-mapped node that never entered a gate carries no evidence — exempt
  // until its first review file appears (a reopened node re-enters the rules with it).
  mappedExempt (tid) {
    return this.originOf(tid) === 'mapped' &&
      this.read(this.verifyYamlPath(tid)) === null &&
      this.read(this.reviewYamlPath(tid)) === null
  }
  rankOf (tid) { return LIFECYCLE.indexOf(this.statusOf(tid)) }

  // ---- the decomposition gate ----
  hasSketch () { return this.taskFiles().some(f => this.fm(f, 'status') === 'sketch') }
  treeGatePending () {
    if (!this.hasSketch()) return false
    const tv = this.read(`${this.reviewDir}/tree.verify.yaml`)
    if (tv === null) return true
    const m = tv.split('\n').map(l => l.replace(/\r$/, ''))
      .find(l => /^status:/.test(l))
    const st = m ? m.replace(/^status:[ \t\v\f\r]*/, '').replace(/[ \t\v\f\r]*#.*$/, '').replace(/[ \t\v\f\r]*$/, '') : ''
    return st !== 'passed'
  }

  // ---- readiness ----
  unblocked (tid) {                                      // 'yes' | 'no:<reason>'
    const p = this.parentOf(tid)
    if (p !== '' && this.statusOf(p) !== 'done') return `no:parent ${p} not done`
    for (const b of this.blockedIdsOf(this.taskPath(tid))) {
      if (this.statusOf(b) !== 'done') return `no:blocked by ${b}`
    }
    return 'yes'
  }
  nextAction (tid) {
    switch (this.statusOf(tid)) {
      case 'sketch': return 'grow (detail → draft)'
      case 'draft': return 'verify'
      case 'approved': return 'implement'
      case 'implemented': return 'review'
      case 'reviewed': return 'fix (if issues) else confirm → done'
      case 'fixed': return 'review (re-run)'
      case 'done': return this.roleOf(tid) === 'skeleton'
        ? '— (children already sketched; grow to add beyond the spec)'
        : '—'
      default: return '?'
    }
  }
}

export const GATE_MSG = 'decomposition gate pending — sketch nodes exist but the tree has not passed its cold verify. Run grovespec-verify on the TREE first (fix → human approval); node work (grow/verify/implement) starts after that.'
