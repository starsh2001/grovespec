// GroveSpec project model — the filesystem-bound layer: find the root, resolve config
// paths, read tasks and the tree. All paths are kept forward-slashed from the moment
// they are built, so every printed path is identical across platforms.
import { existsSync, statSync, readFileSync, readdirSync, writeFileSync, renameSync, chmodSync, rmSync } from 'node:fs'
import { dirname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fmValue, treeRows, blockedIds, schValue, cfgValue, topValue, listItemCount, listItems, itemValue, splitLines } from './core.mjs'

// Status order — how far a node has advanced; evidence requirements key off this.
export const LIFECYCLE = ['sketch', 'draft', 'approved', 'implemented', 'reviewed', 'fixed', 'done']

const fwd = p => p.replace(/\\/g, '/')

// Stage beside the target, then rename — never write in place. writeFileSync truncates
// before it writes, so dying mid-write leaves a half file wearing the real name; a
// rename either lands whole or not at all. The stage sits NEXT TO the target (rename is
// atomic only within one filesystem), never in a temp dir. On Windows a read-only
// target rejects the rename with EPERM — clear the attribute and retry once, loudly
// failing otherwise (a state write that quietly does nothing is worse than a crash).
export function writeAtomic (path, text) {
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, text)
  try {
    renameSync(tmp, path)
  } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EACCES') {
      try { chmodSync(path, 0o666) } catch { /* absent/unfixable — the retry answers */ }
      try { renameSync(tmp, path); return } catch { /* fall through to cleanup+throw */ }
    }
    try { rmSync(tmp, { force: true }) } catch { /* the throw below names the failure */ }
    throw e
  }
}

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
  return fwd(dirname(dirname(dirname(scriptDir()))))    // lib -> bin -> .grovespec -> root
}

// The format this runtime reads. A project stamped anything else gets ONE answer —
// which migration path — and no verdict about anything else: a project written by a
// different format can satisfy every rule spelled here while meaning something else.
// The gate sits at the dispatcher, not inside validate: `next`, `approve`, `pin` judge
// and WRITE project state too, and a boundary only one command respects is not a
// boundary. Returns the refusal message, or null when this runtime may proceed.
// No config at all = pre-init; each command answers that in its own words.
export const FORMAT = '1'
export function versionRefusal (root) {
  let text
  try { text = readFileSync(`${root}/.grovespec/config.yaml`, 'utf8') } catch { return null }
  const v = topValue(text, 'version')
  if (v === '' || v === FORMAT) return null                // '' = pre-versioning: validate advises, nothing refuses
  return `${root}/.grovespec/config.yaml  version '${v}' — this runtime reads format ${FORMAT} and answers nothing across that boundary: upgrade the runtime (or fix the stamp), then re-run`
}

export class Project {
  constructor () {
    this.root = findRoot()
    this.configPath = `${this.root}/.grovespec/config.yaml`
    this.configText = this.#read(this.configPath) ?? ''
    let schemaPath = `${this.root}/.grovespec/schema`
    if (!existsSync(schemaPath)) schemaPath = `${dirname(scriptDir())}/../schema`.replace(/\\/g, '/')
    this.schemaText = this.#read(fwd(schemaPath)) ?? ''
    // Every spelling git will never print is a comparison that will never match:
    // `./src/`, `src//`, `a/../src/`, `.` all named real paths while the dirty-tree
    // and fresh filters compared their raw spelling against git's canonical output —
    // a dirty src read as clean and the machine gate passed over it. So: canonicalize
    // to ONE form, and REFUSE what has no in-project form at all. Refusals land in
    // `pathProblems`; the dispatcher turns them into a refusal for every command but
    // validate (a config the filters cannot faithfully apply must not quietly filter
    // nothing — and validate is the command that explains why).
    //
    // Separators are unified BEFORE normalize, not after: on POSIX a backslash is an
    // ordinary character, so `a\..\src\` survived normalize untouched and then became
    // the coordinate `a/../src` — a path the filesystem reads as `src` and git never
    // names. One logical separator first, then one canonical form.
    this.pathProblems = []
    const cfg = (key, dflt) => {
      const raw = cfgValue(this.configText, key)
      let v = raw === '' ? dflt : raw
      // Absolute in either dialect, plus drive-relative (`C:src` — no separator after
      // the colon, so a slash test misses it while Windows resolves it per-drive).
      const abs = /^([A-Za-z]:|[\\/])/.test(v)
      v = normalize(v.replace(/\\/g, '/')).replace(/\\/g, '/').replace(/\/+$/, '')
      if (abs || v === '.' || v === '' || v === '..' || v.startsWith('../')) {
        this.pathProblems.push(`paths.${key}: '${raw}' — must be a relative path inside the project (not absolute or drive-relative, not '..' escaping it, not the project root itself)`)
        v = dflt.replace(/\/+$/, '')                     // predictable shape; the refusal is what gates
      } else {
        // …and it must be spelled the way the filesystem spells it. On Windows (and a
        // case-insensitive macOS volume) `SRC/` opens the real `src/` while git keeps
        // printing `src/` — the comparison then misses forever and a dirty tree reads
        // as clean. Directory listings are case-EXACT everywhere, so ask them —
        // but only when the configured spelling actually OPENS something: on a
        // case-SENSITIVE volume a look-alike neighbour (`Findings.md` beside a
        // not-yet-created `findings.md`) is a different file, not an alias, and
        // flagging it blocked a perfectly normal "created later" path. existsSync
        // answers with the volume's own semantics, so the same code is right on both.
        let dir = this.root
        for (const seg of v.split('/')) {
          let names
          try { names = readdirSync(dir) } catch { break }   // not created yet — nothing to judge
          if (!names.includes(seg)) {
            if (existsSync(`${dir}/${seg}`)) {
              const alias = names.find(n => n.toLowerCase() === seg.toLowerCase())
              this.pathProblems.push(`paths.${key}: '${raw}' — the path opens, but on disk it is spelled '${alias ?? '(a different form)'}', not '${seg}'; git prints the real spelling, so a differing one never matches`)
            }
            break
          }
          dir = `${dir}/${seg}`
        }
      }
      return `${this.root}/${v}`
    }
    this.tasksDir = cfg('tasks', 'docs/tasks/')
    this.treePath = cfg('tree', 'docs/tree.md')
    this.briefPath = cfg('brief', 'docs/brief.md')
    this.convPath = cfg('conventions', 'docs/conventions.md')
    this.srcDir = cfg('src', 'src/')
    this.testsDir = cfg('tests', 'tests/')
    this.reviewDir = cfg('review', '.grovespec/review/')
    this.findingsPath = cfg('findings', 'docs/findings.md')
    this.restructuringPath = cfg('restructuring', 'docs/restructuring.md')
    // Read for its RULES, not its contents: nothing here opens ref/, but plan and grow
    // write the frozen intent records there. A path this runtime never validated could
    // send them outside the project entirely (`ref: ../outside-ref/`) — every
    // configured path answers to the same rules, or the unchecked one is the way out.
    this.refDir = cfg('ref', 'docs/ref/')
    // The review dir is the one path whose CONTENTS get filtered out of what reviewers
    // read (`diff` holds gate records out of the cycle body). So it must not contain, or
    // sit inside, any other configured path: `review: src` made a cycle's real code
    // changes vanish under "1 gate record(s) held out … nothing of this node to diff",
    // and no check said a word. The filter is only honest while the two regions are
    // disjoint — a containment is refused here rather than filtered wrongly there.
    const asRel = p => p.slice(this.root.length + 1)
    const inside = (a, b) => a === b || a.startsWith(`${b}/`)
    for (const [key, p] of [['tasks', this.tasksDir], ['tree', this.treePath], ['brief', this.briefPath],
      ['conventions', this.convPath], ['src', this.srcDir], ['tests', this.testsDir],
      ['findings', this.findingsPath], ['restructuring', this.restructuringPath], ['ref', this.refDir]]) {
      const r = asRel(this.reviewDir); const o = asRel(p)
      if (inside(o, r) || inside(r, o)) {
        this.pathProblems.push(`paths.review: '${r}' overlaps paths.${key}: '${o}' — everything under the review dir is held out of the cycle diff, so an overlap would hide ${key === 'src' || key === 'tests' ? 'real code' : `the ${key} artifact`} from the cold reviewers under a "gate record" count; give the review dir a region of its own`)
      }
    }
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
  approvedBy (path) {                                    // '' = field absent (legacy record)
    const t = this.read(path)
    return t === null ? '' : topValue(t, 'approved_by')
  }

  // Each entry: { kind, text }. A gate WAITS on the human only while its verdict is
  // `passed` AND `approved_by: pending` — a record someone already decided (human/machine)
  // is a closed past gate, and a legacy record (no field) binds nothing: neither may be
  // presented as "awaiting your decision" (that is how a reopened node's stale pass used
  // to masquerade as fresh verification). `escalated` always waits — for a ruling.
  humanWaits (tid) {
    const st = this.statusOf(tid)
    const vp = this.verifyYamlPath(tid); const rp = this.reviewYamlPath(tid)
    const vst = this.reviewStatus(vp); const rst = this.reviewStatus(rp)
    const out = []
    if (st === 'draft' && vst === 'passed' && this.approvedBy(vp) === 'pending') {
      out.push({ kind: 'approve', text: 'spec verify passed — awaiting your approval (grovespec approve TASK --human)'.replace('TASK', tid) })
    }
    if (vst === 'escalated') out.push({ kind: 'escalated', text: `spec verify escalated — needs a human ruling (${vp})` })
    if (st === 'reviewed' && rst === 'passed' && this.approvedBy(rp) === 'pending') {
      out.push({ kind: 'confirm', text: 'review passed — awaiting your confirm (grovespec approve TASK --human)'.replace('TASK', tid) })
    }
    if (rst === 'escalated') out.push({ kind: 'escalated', text: `review escalated — needs a human ruling (${rp})` })
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
  followupCounts (tid) {
    const out = []
    for (const [label, p] of [['spec', this.verifyYamlPath(tid)], ['result', this.reviewYamlPath(tid)]]) {
      const n = listItemCount(this.read(p) ?? '', 'followups')
      if (n > 0) out.push(`${label} ${n}`)
    }
    return out
  }
  // Every followup across every gate record — the parked later-work, in one sweep.
  // This is what `followups` lists and what routes `next` to plan once the tree is done:
  // parked work must never be invisible at the driver's terminal line.
  allFollowups () {
    const out = []
    for (const f of this.reviewFiles()) {
      let tid, lane
      const m = f.match(/\/(TASK-[0-9]+)\.(verify|review)\.yaml$/)
      if (m) { tid = m[1]; lane = m[2] === 'verify' ? 'spec' : 'result' } else if (f.endsWith('/tree.verify.yaml')) { tid = 'tree'; lane = 'tree' } else continue
      for (const it of listItems(this.read(f) ?? '', 'followups')) {
        out.push({
          tid,
          lane,
          kind: itemValue(it, 'kind'),
          family: itemValue(it, 'family'),
          severity: itemValue(it, 'severity'),
          // What this item can REACH today — the axis a planning pass reads first.
          gate1: itemValue(it, 'gate1')
        })
      }
    }
    return out
  }
  // Unchecked `- [ ]` items in a brownfield backlog file (findings.md / restructuring.md).
  backlogItemCount (p) {
    const t = this.read(p)
    if (t === null) return 0
    return splitLines(t).filter(l => /^[ \t]*- \[ \]/.test(l)).length
  }
  // Everything parked for a later planning pass: followups + the brownfield backlogs.
  backlogCounts () {
    const followups = this.allFollowups().length
    const findings = this.backlogItemCount(this.findingsPath)
    const restructuring = this.backlogItemCount(this.restructuringPath)
    return { followups, findings, restructuring, total: followups + findings + restructuring }
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

  // ---- the tree gates (two questions, one record file) ----
  hasSketch () { return this.taskFiles().some(f => this.fm(f, 'status') === 'sketch') }
  hasMapped () { return this.taskFiles().some(f => this.fm(f, 'origin') === 'mapped') }
  // Any TASK-level gate record at all. Once node work has entered the gates, a mapped
  // survey was accepted de facto — pre-fidelity-era projects mid-build must not
  // suddenly re-arm a gate they never had.
  nodeGateEvidence () {
    return this.reviewFiles().some(f => !f.endsWith('/tree.verify.yaml'))
  }
  treeYamlPath () { return `${this.reviewDir}/tree.verify.yaml` }
  // Which question the tree gate is asking right now:
  //   'decomposition' — sketch nodes exist: is this the right decomposition? (D1–D5)
  //   'fidelity'      — a pristine mapped (brownfield) tree: is it an accurate survey
  //                     of the code? (the map is an agent's claim too — never self-vouched)
  //   ''              — no tree gate armed.
  treeGateKind () {
    if (this.hasSketch()) return 'decomposition'
    if (this.hasMapped() && !this.nodeGateEvidence()) return 'fidelity'
    return ''
  }
  // The gate opens only on a verdict a HUMAN approved. `passed` alone is the cold
  // cycle's verdict — with `approved_by: pending` nobody has looked yet, and a driver
  // that treats that as open builds forty nodes on an unapproved decomposition.
  // A legacy record (no approved_by field) keeps its pre-field meaning: open.
  treeGatePending () {
    if (this.treeGateKind() === '') return false
    const st = this.reviewStatus(this.treeYamlPath())
    if (st !== 'passed') return true
    const ab = this.approvedBy(this.treeYamlPath())
    return !(ab === 'human' || ab === '')
  }
  // Sub-state for callers that word their message by it: the cycle passed but the
  // human's approval is what is missing (vs. the cold verify not having run/passed).
  treeAwaitingHuman () {
    return this.treeGateKind() !== '' &&
      this.reviewStatus(this.treeYamlPath()) === 'passed' &&
      this.approvedBy(this.treeYamlPath()) === 'pending'
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
export const SURVEY_MSG = 'survey fidelity gate pending — this tree was mapped from existing code but never cold-verified against it. Run grovespec-verify on the TREE first (accuracy check → human approval); node work (revise/grow) starts after that.'
// The pending-gate message, worded by which question is armed.
export const treeGateMsg = P => (P.treeGateKind() === 'fidelity' ? SURVEY_MSG : GATE_MSG)
