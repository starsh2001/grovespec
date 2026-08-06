// GroveSpec commands. Every message and exit code here is the contract tests/regress.sh
// pins — the bash runtime this ports was graded against the same goldens.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { sectionsOf, badTreeLines, pipes, langValue, topValue, listItemCount } from './core.mjs'
import { Project, GATE_MSG, scriptDir } from './project.mjs'
import { specDigest } from './cmd-pin.mjs'
import { git, inRepo, log, touched } from './git.mjs'

const say = s => process.stdout.write(s + '\n')
const pad = (s, n) => s.length >= n ? s : s + ' '.repeat(n - s.length)

// ===================== validate =====================
export function cmdValidate (P) {
  let problems = 0
  const prob = m => { say(`  ${m}`); problems++ }

  // --- per task file ---
  for (const f of P.taskFiles()) {
    const tid = P.tidOf(f)
    for (const k of pipes(P.sch('task.fm.required'))) {
      if (P.fm(f, k) === '') prob(`${f}  frontmatter '${k}' missing`)
    }
    if (P.fm(f, 'id') !== tid) prob(`${f}  id '${P.fm(f, 'id')}' != filename '${tid}' → set id to ${tid}`)
    let v = P.fm(f, 'role')
    if (v !== '' && !pipes(P.sch('task.fm.enum.role')).includes(v)) prob(`${f}  role '${v}' invalid → use ${P.sch('task.fm.enum.role')}`)
    v = P.fm(f, 'status')
    if (v !== '' && !pipes(P.sch('task.fm.enum.status')).includes(v)) prob(`${f}  status '${v}' invalid → use ${P.sch('task.fm.enum.status')}`)
    v = P.fm(f, 'tdd')
    if (v === 'true') { /* ok */ } else if (v === 'false') {
      if (P.fm(f, 'tdd_skip_reason') === '') prob(`${f}  tdd:false requires tdd_skip_reason`)
    } else prob(`${f}  tdd '${v}' must be true|false`)
    v = P.fm(f, 'origin')
    if (v !== '' && !pipes(P.sch('task.fm.enum.origin')).includes(v)) prob(`${f}  origin '${v}' invalid → use ${P.sch('task.fm.enum.origin')}`)
    const want = pipes(P.sch('task.sections')).join('\n')
    const got = sectionsOf(P.read(f) ?? '').join('\n')
    if (want !== got) prob(`${f}  sections mismatch → need (in order): ${P.sch('task.sections')}`)
    for (const b of P.blockedIdsOf(f)) {
      if (b === tid) prob(`${f}  blocked_by includes itself (${b})`)
      if (P.read(P.taskPath(b)) === null) prob(`${f}  blocked_by '${b}' has no task file`)
    }
  }

  // --- tree.md line format ---
  for (const bad of badTreeLines(P.treeText())) prob(`${P.treePath}:${bad}  not a '- TASK-N' line`)

  // --- tree <-> files (orphans both ways) ---
  const ids = P.treeIds()
  for (const t of ids) {
    if (P.read(P.taskPath(t)) === null) prob(`${P.treePath}  '${t}' has no task file (${P.taskPath(t)})`)
  }
  for (const f of P.taskFiles()) {
    if (!ids.includes(P.tidOf(f))) prob(`${f}  not in tree.md (orphan task)`)
  }

  // --- impossible states ---
  for (const t of ids) {
    if (P.statusOf(t) !== 'done') continue
    const p = P.parentOf(t)
    if (p !== '' && P.statusOf(p) !== 'done') prob(`${t} is done but parent ${p} is ${P.statusOf(p)}`)
    for (const b of P.blockedIdsOf(P.taskPath(t))) {
      if (P.statusOf(b) !== 'done') prob(`${t} is done but blocked_by ${b} is ${P.statusOf(b)}`)
    }
  }

  // --- blocked_by cycle (Kahn): resolve nodes whose deps are all resolved; leftovers = cycle ---
  const resolved = new Set()
  for (;;) {
    let progress = false
    for (const t of ids) {
      if (resolved.has(t)) continue
      if (P.blockedIdsOf(P.taskPath(t)).every(b => resolved.has(b))) { resolved.add(t); progress = true }
    }
    if (!progress) break
  }
  for (const t of ids) {
    if (!resolved.has(t)) prob(`${t} is in a blocked_by cycle (unresolvable)`)
  }

  // --- review-state files (the gates' evidence — format) ---
  for (const rf of P.reviewFiles()) {
    const text = P.read(rf) ?? ''
    for (const k of pipes(P.sch('review.fm.required'))) {
      if (topValue(text, k) === '') prob(`${rf}  field '${k}' missing`)
    }
    let v = topValue(text, 'status')
    if (v !== '' && !pipes(P.sch('review.enum.status')).includes(v)) prob(`${rf}  status '${v}' invalid → use ${P.sch('review.enum.status')}`)
    v = topValue(text, 'target_type')
    if (v !== '' && !pipes(P.sch('review.enum.target_type')).includes(v)) prob(`${rf}  target_type '${v}' invalid → use ${P.sch('review.enum.target_type')}`)
    if (topValue(text, 'status') === 'passed' && listItemCount(text, 'open_issues') > 0) {
      prob(`${rf}  status: passed but open_issues is not empty`)
    }
    v = topValue(text, 'approved_by')
    if (v !== '' && !pipes(P.sch('review.enum.approved_by')).includes(v)) prob(`${rf}  approved_by '${v}' invalid → use ${P.sch('review.enum.approved_by')}`)
  }

  // --- status ↔ evidence: an advanced status must show the gate that let it advance ---
  // (origin: mapped nodes with no review files are exempt — brownfield init maps existing
  //  code straight to done; the rules apply from the first gate a reopened node enters.)
  for (const t of ids) {
    const rank = P.rankOf(t)
    if (rank < 2 || P.mappedExempt(t)) continue
    const vp = P.verifyYamlPath(t)
    const vst = P.reviewStatus(vp)
    if (vst !== 'passed') prob(`${t} is ${P.statusOf(t)} but its spec verify is not passed (${vp}${vst === '' ? ' missing' : `: ${vst}`})`)
    if (rank === 6) {
      const rp = P.reviewYamlPath(t)
      const rst = P.reviewStatus(rp)
      if (rst !== 'passed') prob(`${t} is done but its code review is not passed (${rp}${rst === '' ? ' missing' : `: ${rst}`})`)
    }
  }

  // --- pins: the gated bytes must still be the bytes ---
  // (a record without a digest is legacy-unbound — shown nothing, binds nothing;
  //  pins written before the digest era are not violations, just not warranties.)
  const repo = inRepo(P.root)
  for (const t of ids) {
    const tt = P.read(P.taskPath(t))
    if (tt === null) continue
    const cur = specDigest(tt)
    const vd = topValue(P.read(P.verifyYamlPath(t)) ?? '', 'spec_digest')
    const rd = topValue(P.read(P.reviewYamlPath(t)) ?? '', 'spec_digest')
    if (cur !== null) {
      if (vd !== '' && vd !== cur) prob(`${t} spec changed after its verify pin — digest mismatch (reopen via grovespec-revise, re-verify)`)
      else if (rd !== '' && rd !== cur) prob(`${t} spec changed after its review pin — digest mismatch (reopen via grovespec-revise)`)
    }
    const rc = topValue(P.read(P.reviewYamlPath(t)) ?? '', 'reviewed_commit')
    if (rc !== '' && repo && !git(P.root, ['rev-parse', '--verify', '--quiet', `${rc}^{commit}`]).ok) {
      prob(`${t} reviewed_commit ${rc.slice(0, 7)} not found in git history`)
    }
  }

  // --- tdd vs the cycle's commits: claimed TDD must show test files ---
  if (repo) {
    const relTests = P.testsDir.startsWith(`${P.root}/`) ? P.testsDir.slice(P.root.length + 1) : null
    if (relTests !== null) {
      const byTask = new Map()
      for (const c of log(P.root)) {
        const m = c.s.match(/^(TASK-[0-9]+): /)
        if (m) { if (!byTask.has(m[1])) byTask.set(m[1], []); byTask.get(m[1]).push(c.h) }
      }
      for (const t of ids) {
        if (P.statusOf(t) !== 'done' || P.fmOf(t, 'tdd') !== 'true') continue
        const hs = byTask.get(t)
        if (!hs) continue                                  // no commits at all (mapped / pre-runtime)
        const files = new Set()
        for (const h of hs) for (const f of touched(P.root, h)) files.add(f)
        if (![...files].some(f => f === relTests || f.startsWith(`${relTests}/`))) {
          prob(`${t} tdd: true but its cycle commits touch nothing under ${relTests}/ (claimed TDD, no tests)`)
        }
      }
    }
  }

  // --- brief / conventions ---
  const briefText = P.read(P.briefPath)
  if (briefText !== null) {
    for (const k of pipes(P.sch('brief.fm.required'))) {
      if (P.fm(P.briefPath, k) === '') prob(`${P.briefPath}  frontmatter '${k}' missing`)
    }
    const want = pipes(P.sch('brief.sections')).join('\n')
    if (want !== sectionsOf(briefText).join('\n')) prob(`${P.briefPath}  sections → need: ${P.sch('brief.sections')}`)
  } else prob(`${P.briefPath}  missing`)
  const convText = P.read(P.convPath)
  if (convText !== null) {
    const want = pipes(P.sch('conventions.sections')).join('\n')
    if (want !== sectionsOf(convText).join('\n')) prob(`${P.convPath}  sections → need: ${P.sch('conventions.sections')}`)
  }

  // What this run actually looked at — so "I did not look" (a wrong path, an empty
  // tasks dir) can never read as "I looked and found nothing".
  say(`examined: tasks ${P.taskFiles().length} · tree nodes ${ids.length} · review files ${P.reviewFiles().length}`)
  // A notice, not a problem: an auto-taken gate is a legitimate state, but it is never
  // allowed to look like a human-taken one — so every run says how many are outstanding.
  const unratified = ids.filter(t => P.unratified(t).length)
  if (unratified.length) {
    say(`notice: ${unratified.length} node(s) auto-approved by machine, not yet ratified — ${unratified.join(', ')} (grovespec ratify <id>…)`)
  }
  if (problems === 0) { say('✓ validate: all checks passed'); return 0 }
  say(`✗ validate: ${problems} problem(s)`)
  return 1
}

// ===================== status =====================
export function cmdStatus (P) {
  const gate = P.treeGatePending()
  if (gate) say(`! ${GATE_MSG}`)
  let nexts = ''
  for (const t of P.treeIds()) {
    const st = P.statusOf(t); const ub = P.unblocked(t); const rl = P.roleOf(t)
    if (st === 'done') {
      if (rl === 'skeleton') say(`${pad(t, 8)} done        (children already sketched → work them; grow only to add beyond the spec)`)
      else say(`${pad(t, 8)} done`)
    } else if (gate) say(`${pad(t, 8)} ${pad(st, 12)} (awaiting the tree gate)`)
    else if (ub === 'yes') { say(`${pad(t, 8)} ${pad(st, 12)} → ${P.nextAction(t)}`); nexts += ` ${t}` }
    else say(`${pad(t, 8)} ${pad(st, 12)} (${ub.slice(3)})`)
  }
  // Decisions parked on the human, split out — so "nothing ready" can never hide
  // an approval or confirm that is actually waiting on the user.
  const waiting = []
  if (gate && P.reviewStatus(`${P.reviewDir}/tree.verify.yaml`) === 'escalated') {
    waiting.push(`${pad('tree', 8)} decomposition verify escalated — needs a human ruling (${P.reviewDir}/tree.verify.yaml)`)
  }
  for (const t of P.treeIds()) {
    for (const w of P.humanWaits(t)) waiting.push(`${pad(t, 8)} ${w.text}`)
  }
  if (waiting.length) {
    say('waiting on human:')
    for (const w of waiting) say(`  ${w}`)
  }
  const unratified = P.treeIds().map(t => [t, P.unratified(t)]).filter(([, l]) => l.length)
  if (unratified.length) {
    say('auto-approved by machine, not yet ratified:')
    for (const [t, labels] of unratified) say(`  ${pad(t, 8)} ${labels.join(' · ')} gate taken automatically — no human has looked (grovespec ratify ${t})`)
  }
  if (gate) { say('next: grovespec-verify the tree (the decomposition gate)'); return 0 }
  if (nexts !== '') say(`next:${nexts}`)
  return 0
}

// ===================== check (the top-down gate) =====================
export function cmdCheck (P, n) {
  if (P.treeGatePending()) {
    say(n === '' ? `✗ ${GATE_MSG}` : `✗ ${n}: ${GATE_MSG}`)
    return 1
  }
  if (n === '') {
    say('ready to work now (top-down):')
    let any = false; let doneskel = false
    for (const t of P.treeIds()) {
      if (P.statusOf(t) === 'done') {
        if (P.roleOf(t) === 'skeleton') doneskel = true
        continue
      }
      if (P.unblocked(t) === 'yes') { say(`  ${pad(t, 8)} ${pad(P.statusOf(t), 12)} → ${P.nextAction(t)}`); any = true }
    }
    if (!any) say('  (none — every non-done node is blocked)')
    if (doneskel) say("  + done skeletons: their children are already sketched (work them above); 'grow' only adds children beyond the spec")
    return 0
  }
  if (P.read(P.taskPath(n)) === null) { say(`✗ ${n}: no task file`); return 2 }
  const ub = P.unblocked(n)
  if (ub === 'yes') {
    say(`✓ ${n} is ready (${P.statusOf(n)}) — parent done, blocked_by done → next: ${P.nextAction(n)}`)
    return 0
  }
  say(`✗ ${n} is NOT ready — ${ub.slice(3)}. Do NOT work it (that's bottom-up). Work a node 'grovespec check' lists as ready.`)
  return 1
}

// ===================== lang / locale =====================
export function cmdLang (P) {
  const v = langValue(P.configText)
  if (v !== '') say(v)
  else say('(no config.language yet — run grovespec-init)')
  return 0
}

export function cmdLocale () {
  let l = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || ''
  l = l.replace(/\..*$/, '').replace(/@.*$/, '')
  if (l === 'C' || l === 'POSIX') l = ''
  if (l === '') {
    // The OS user locale, asked without spawning anything (the bash runtime read the
    // Windows registry here; Intl reads the same setting and works everywhere).
    try { l = new Intl.DateTimeFormat().resolvedOptions().locale || '' } catch { l = '' }
  }
  if (l === '') return 1
  say(l.replace(/[-_].*$/, '').toLowerCase())
  return 0
}

// ===================== version =====================
// The date label says which bundle this claims to be; the fingerprint says which bytes
// it actually is — two installs can share a label while their behavior differs (a
// testbed once ran two weeks ahead of its distribution repo). Compare THIS.
function fingerprint (P) {
  const list = []
  const schemaFile = `${P.root}/.grovespec/schema`
  if (existsSync(schemaFile) && statSync(schemaFile).isFile()) list.push(schemaFile)
  walkFiles(`${P.root}/.grovespec/bin`, list)
  walkFiles(`${P.root}/.grovespec/templates`, list)
  let skills = []
  try { skills = readdirSync(`${P.root}/.claude/skills`).filter(n => n.startsWith('grovespec-')) } catch { /* none */ }
  for (const s of skills.sort()) walkFiles(`${P.root}/.claude/skills/${s}`, list)
  list.sort()
  const h = createHash('sha256')
  for (const p of list) {
    h.update(p.slice(P.root.length + 1) + '\0')
    try { h.update(readFileSync(p)) } catch { /* unreadable — path alone */ }
    h.update('\0')
  }
  return h.digest('hex').slice(0, 16)
}
export function cmdVersion (P) {
  let found = false
  const rootV = `${P.root}/.grovespec/VERSION`
  const installV = `${dirname(scriptDir()).replace(/\\/g, '/')}/../VERSION`
  for (const p of [rootV, installV]) {
    try { process.stdout.write(readFileSync(p, 'utf8')); found = true; break } catch { /* next */ }
  }
  if (!found) say('(no VERSION file)')
  say(`fingerprint: ${fingerprint(P)} (bin + schema + templates + skills/grovespec-*)`)
  return found ? 0 : 1
}

// ===================== impact =====================
function walkFiles (dir, out) {                      // sorted, depth-first — grep -r's shape
  let names
  try { names = readdirSync(dir).sort() } catch { return }
  for (const n of names) {
    const p = `${dir}/${n}`
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) walkFiles(p, out)
    else out.push(p)
  }
}
export function cmdImpact (P, n) {
  if (n === '') { say('usage: grovespec impact TASK-N'); return 2 }
  if (P.read(P.taskPath(n)) === null) { say(`no such node: ${n}`); return 2 }
  say(`impact of a contract change on ${n} (${P.nameOf(n)}):`)
  say('  -- exact (depend on it) --')
  for (const c of P.childrenOf(n)) say(`  child     ${c}  ${P.nameOf(c)}`)
  for (const f of P.taskFiles()) {
    const tid = P.tidOf(f)
    for (const b of P.blockedIdsOf(f)) {
      if (b === n) say(`  consumer  ${tid}  ${P.nameOf(tid)}`)
    }
  }
  say("  -- hint: name-grep only (authoritative = the node's exported symbols, grepped from its code — see grovespec-revise) --")
  const name = P.nameOf(n)
  const files = []
  walkFiles(P.srcDir, files)
  walkFiles(P.tasksDir, files)
  for (const p of files) {
    if (p.endsWith(`/${n}.md`)) continue
    let t
    try { t = readFileSync(p, 'utf8') } catch { continue }
    if (t.includes(name)) say(`  ${p}`)
  }
  return 0
}

// ===================== tree =====================
export function cmdTree (P) {
  for (const { tid, depth } of P.rows()) {
    say(`${'  '.repeat(depth)}- ${tid}  ${P.nameOf(tid)} [${P.roleOf(tid)}, ${P.statusOf(tid)}]`)
  }
  return 0
}
