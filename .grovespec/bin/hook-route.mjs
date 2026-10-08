#!/usr/bin/env node
// hook-route.mjs — the advisory edit-routing hook (v0.15.0).
//
// Registered by `grovespec hooks install` as a Claude Code PostToolUse hook on
// Edit|Write. On an edit under paths.src/paths.tests it computes what an agent
// would otherwise have to judge — which node owns this file, and whether the edit
// text touches that node's Contract surface — and injects the answer as context.
// The agent RATIFIES a routing decision; it never has to derive one (the same
// mechanization line as v0.14.1 markers and v0.14.2 reading rules: a judgment an
// agent can fumble moves into the runtime).
//
// FAIL-OPEN, always: this hook is advice, so every failure path — no .grovespec,
// config hooks: off, no git, malformed input, unreadable Task — exits 0 silently.
// An advisory layer that can block an edit has changed sides. The one visible
// failure is deliberate: a dangling settings.json registration after .grovespec
// was deleted makes `node` print a cannot-find-module line, which is the cleanup
// nudge (remove the entry), never a block.
//
// CONFIG IS READ BY THE RUNTIME'S OWN PARSER, dynamically imported from ./lib —
// never by a lookalike. The first shape of this file mirrored the config grammar
// and the mirror drifted three times in one review thread (missed spaces before
// the colon; then 4-space indents and spaced values; then a column-0 comment line
// read as the end of the paths block). Three holes in one spot is a class, and
// the class is the mirror itself: a copied rule can drift, a shared rule cannot.
// The original reason for self-containment — a mid-upgrade or missing lib must
// not break editing — is kept by BEHAVIOR instead of by duplication: the import
// failing makes the hook silent (fail-open), same as every other failure here.
// The small Contract-ident extractor still mirrors lib/cmd-fresh.mjs — that one
// is GroveSpec's own heuristic with no other authoritative owner, not a grammar
// someone else defines.
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve, sep } from 'node:path'

const out = obj => process.stdout.write(JSON.stringify(obj) + '\n')

function findRoot (from) {
  let d = resolve(from)
  for (;;) {
    if (existsSync(`${d}/.grovespec`)) return d
    const up = dirname(d)
    if (up === d) return null
    d = up
  }
}

// Canonicalize a configured path to the one form the prefix test compares against.
// config.yaml documents `./x/`, `x//`, `a/../x` as accepted spellings of one
// canonical path — a raw string compare silently missed every edit under
// `paths.src: ./src/` (external review 2026-09-25, F3).
const canon = p => {
  const parts = []
  for (const seg of String(p).replace(/\\/g, '/').split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') { parts.pop(); continue }
    parts.push(seg)
  }
  return parts.join('/')
}
const unq = v => String(v).trim().replace(/^(['"])(.*)\1$/, '$2')

// Backticked public names from a Task's Contract section — the observable surface
// a consumer can rely on. Identifier-shaped only: prose in backticks isn't a name.
function contractIdents (taskText) {
  const m = taskText.match(/^## Contract$([\s\S]*?)(?=^## )/m)
  if (!m) return []
  const ids = new Set()
  for (const t of m[1].matchAll(/`([^`\n]+)`/g)) {
    const s = t[1].trim()
    if (/^[A-Za-z_][A-Za-z0-9_.]*(\(\))?$/.test(s) && s.length >= 3) ids.add(s.replace(/\(\)$/, ''))
  }
  return [...ids]
}

async function main () {
  let input = ''
  try { input = readFileSync(0, 'utf8') } catch { return }
  let ev
  try { ev = JSON.parse(input) } catch { return }
  const file = ev?.tool_input?.file_path
  if (typeof file !== 'string' || file === '') return

  // An empty env var is unset, not a root of '' (a shell's `VAR= cmd` passes '').
  const envRoot = process.env.CLAUDE_PROJECT_DIR
  const root = (envRoot !== undefined && envRoot !== '') ? envRoot : findRoot(ev.cwd ?? process.cwd())
  if (root === null || !existsSync(`${root}/.grovespec`)) return
  let cfg = ''
  try { cfg = readFileSync(`${root}/.grovespec/config.yaml`, 'utf8') } catch { return }
  // The runtime's own readers — see the header. Import failure = a broken or
  // mid-upgrade install; the hook goes silent rather than advise off a guess.
  const core = await import(new URL('./lib/core.mjs', import.meta.url).href)
  const pathValue = (key, dflt) => canon(unq(core.cfgValue(cfg, 'paths', key))) || canon(dflt)
  if (core.topValue(cfg, 'hooks') === 'off') return

  const abs = resolve(file)
  const rootAbs = resolve(root)
  if (!abs.startsWith(rootAbs + sep)) return
  const rel = abs.slice(rootAbs.length + 1).split(sep).join('/')
  const src = pathValue('src', 'src')
  const tests = pathValue('tests', 'tests')
  if (![src, tests].some(a => rel === a || rel.startsWith(`${a}/`))) return

  // Owner = the most recent `TASK-N:` cycle commit that touched this file. A file
  // in several nodes' footprints routes to its latest owner — the heuristic is
  // stated, and fresh re-answers it at absorption time with full history.
  const r = spawnSync('git', ['-C', root, 'log', '--format=%s', '--max-count=300', '--', rel], { encoding: 'utf8' })
  if (r.status !== 0 || typeof r.stdout !== 'string') return
  let owner = null
  for (const s of r.stdout.split('\n')) {
    const m = s.match(/^(TASK-\d+): /)
    if (m) { owner = m[1]; break }
  }
  if (owner === null) return // unowned (new file) — fresh's business, not a routing call

  const tasksDir = pathValue('tasks', 'docs/tasks')
  let task = ''
  try { task = readFileSync(`${root}/${tasksDir}/${owner}.md`, 'utf8') } catch { return }
  const status = (task.match(/^status:\s*(\S+)/m) ?? [])[1] ?? ''
  if (status !== 'done') return // an open node's edits belong to its live cycle — no nag
  const name = (task.match(/^name:\s*"?([^"\n]*)"?\s*$/m) ?? [])[1] ?? ''

  // old_string too: DELETING or renaming a contract name is the edit that most
  // needs the revise nudge, and it appears only in what the edit removes —
  // new-text-only matching graded exactly that as "inside the contract"
  // (external review 2026-09-25, F2; fresh's changed-lines check already reads
  // both sides, so this also re-aligns the at-edit advice with the post-hoc grade).
  let edited = `${ev.tool_input.old_string ?? ''}\n${ev.tool_input.new_string ?? ''}\n${ev.tool_input.content ?? ''}`
  if (ev.tool_input.old_string === undefined) {
    // Write replaces the whole file, so what was REMOVED never appears in the
    // event — it exists only in the diff against HEAD (F2 residue, external
    // re-review 2026-09-25). Same measure fresh uses: changed lines only, hunk
    // and file headers dropped. Diff unavailable (untracked/new) → the content
    // above already carries everything the write introduced.
    const d = spawnSync('git', ['-C', root, 'diff', '--unified=0', 'HEAD', '--', rel], { encoding: 'utf8' })
    if (d.status === 0 && typeof d.stdout === 'string') {
      edited += '\n' + d.stdout.split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l)).join('\n')
    }
  }
  const hit = contractIdents(task).find(id => edited.includes(id)) ?? null
  const ko = core.topValue(cfg, 'language') === 'ko'
  const who = `${owner}${name ? `(${name})` : ''}`
  const msg = hit === null
    ? (ko
        ? `GroveSpec: 이 파일은 done 노드 ${who} 소유입니다. 계약 안쪽 수정이면 그대로 진행하세요 — fresh 가 장부에 올리고 다음 정리 라운드가 흡수합니다.`
        : `GroveSpec: this file belongs to done node ${who}. An inside-the-contract fix proceeds as-is — fresh ledgers it and the next cleanup round absorbs it.`)
    : (ko
        ? `GroveSpec: 이 파일은 done 노드 ${who} 소유이고, 이 편집은 그 계약 표면(\`${hit}\`)에 닿습니다. 계약이 바뀌면 grovespec-revise 로 여세요 — 소비자가 읽기 전에. 계약이 안 바뀌면 그대로 진행합니다.`
        : `GroveSpec: this file belongs to done node ${who}, and this edit touches its Contract surface (\`${hit}\`). If the contract changes, open it with grovespec-revise — before a consumer reads it. If not, proceed.`)
  out({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: msg } })
}

// Advisory: never block, never trace — a rejected promise (including a failed
// dynamic import of ./lib) ends in the same silence as every other failure.
main().catch(() => {}).finally(() => process.exit(0))
