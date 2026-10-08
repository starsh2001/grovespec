// hooks — install | remove | status of the advisory edit-routing hook (v0.15.0).
// The MERGE into .claude/settings.json is runtime code, never
// an agent's edit: a JSON rewrite an agent performs is a JSON rewrite an agent can
// fumble, and the file it would fumble holds hooks that are not ours to lose (the
// launcher's delete guard lives there). Same mechanization line as v0.14.1/v0.14.2.
//
// Guarantees this module owns:
//   · parse-or-refuse — an unreadable settings.json is never rewritten (a merge over
//     bytes we cannot read is how a foreign hook silently dies);
//   · surgical — install appends ONE self-identifying block (its command names
//     .grovespec/bin/hook-route.mjs), remove deletes exactly the entries carrying
//     that mark and the scaffolding they leave empty, and touches nothing else;
//   · idempotent — a second install or remove is a no-op that says so;
//   · config in step — install/remove set the `hooks:` line in config.yaml, so the
//     soft switch and the registration agree (validate notices when they drift).
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { writeAtomic } from './project.mjs'

const say = s => process.stdout.write(s + '\n')

export const HOOK_MARK = '.grovespec/bin/hook-route.mjs'
const HOOK_EVENT = 'PostToolUse'
const hookBlock = () => ({
  matcher: 'Edit|Write',
  hooks: [{ type: 'command', command: `node "$CLAUDE_PROJECT_DIR/${HOOK_MARK}"`, timeout: 15 }]
})

const settingsPath = P => `${P.root}/.claude/settings.json`
const isOurs = h => typeof h?.command === 'string' && h.command.includes(HOOK_MARK)

// Read + parse, distinguishing "no file" (a legal empty start) from "unreadable
// bytes" (refuse to touch). Returns { exists, ok, json }.
function readSettings (P) {
  const p = settingsPath(P)
  if (!existsSync(p)) return { exists: false, ok: true, json: {} }
  let text
  try { text = readFileSync(p, 'utf8') } catch { return { exists: true, ok: false, json: null } }
  try {
    const json = JSON.parse(text)
    if (json === null || typeof json !== 'object' || Array.isArray(json)) return { exists: true, ok: false, json: null }
    return { exists: true, ok: true, json }
  } catch { return { exists: true, ok: false, json: null } }
}

function registered (json) {
  const hooks = json?.hooks
  if (hooks === null || typeof hooks !== 'object') return false
  for (const key of Object.keys(hooks)) {
    const blocks = hooks[key]
    if (!Array.isArray(blocks)) continue
    for (const b of blocks) if (Array.isArray(b?.hooks) && b.hooks.some(isOurs)) return true
  }
  return false
}

// The one config line this module owns. Replaces an existing `hooks:` value in
// place; appends the documented block when the key is absent. Everything else in
// config.yaml keeps its bytes.
function setConfigHooks (P, value) {
  let text
  try { text = readFileSync(P.configPath, 'utf8') } catch { return `cannot read ${P.configPath} — config not updated` }
  // Key grammar = the shared parser's (core.mjs topValue): spaces before the colon
  // are legal. A stricter match here APPENDED a second `hooks:` next to a legal
  // `hooks : off`, and the duplicate key then blocked every mutating command —
  // including `hooks remove`, the escape hatch (external review 2026-09-25, F1).
  if (/^hooks[ \t]*:/m.test(text)) {
    text = text.replace(/^hooks[ \t]*:.*$/m, `hooks: ${value}`)
  } else {
    if (!text.endsWith('\n')) text += '\n'
    text += `\n# Edit-routing hook — advisory context on src/tests edits (grovespec hooks install|remove|status).\n# 'off' silences an installed hook without touching .claude/settings.json. on | off.\nhooks: ${value}\n`
  }
  writeAtomic(P.configPath, text)
  return null
}

// The three states validate's tripwire compares. `registered: null` = settings.json
// exists but cannot be parsed (a fact of its own, never folded into false).
export function hooksState (P) {
  const s = readSettings(P)
  return {
    config: (() => {
      let t = ''
      try { t = readFileSync(P.configPath, 'utf8') } catch { return 'missing' }
      const m = t.match(/^hooks[ \t]*:[ \t]*(\S+)/m) // same grammar as setConfigHooks
      return m ? m[1] : 'missing'
    })(),
    registered: s.ok ? registered(s.json) : null,
    script: existsSync(`${P.root}/${HOOK_MARK}`)
  }
}

export function cmdHooks (P, sub) {
  if (!['install', 'remove', 'status'].includes(sub)) { say('usage: grovespec hooks install|remove|status'); return 2 }
  const s = readSettings(P)

  if (sub === 'status') {
    const st = hooksState(P)
    say(`config (.grovespec/config.yaml hooks:): ${st.config}`)
    say(`registration (.claude/settings.json): ${st.registered === null ? 'settings.json unreadable — fix or remove it before install/remove' : st.registered ? 'registered' : 'absent'}`)
    say(`script (${HOOK_MARK}): ${st.script ? 'present' : 'missing'}`)
    const agree = (st.config === 'on' && st.registered === true && st.script) ||
                  ((st.config === 'off' || st.config === 'missing') && st.registered === false)
    say(agree ? 'agree: the switch, the registration and the script tell one story' : 'disagree: the three do not tell one story — grovespec hooks install|remove puts them back in step')
    return 0
  }

  if (!s.ok) { say(`${settingsPath(P)} exists but is not readable JSON — fix or remove it yourself; refusing to rewrite bytes I cannot read`); return 2 }

  if (sub === 'install') {
    if (!existsSync(`${P.root}/${HOOK_MARK}`)) { say(`${HOOK_MARK} is missing — this install has no hook script (runtime incomplete?); nothing was registered`); return 2 }
    if (registered(s.json)) {
      const err = setConfigHooks(P, 'on')
      say(`already registered — no change to settings.json${err === null ? '; config hooks: on' : `; ${err}`}`)
      return 0
    }
    const json = s.json
    if (json.hooks === undefined) json.hooks = {}
    if (!Array.isArray(json.hooks[HOOK_EVENT])) json.hooks[HOOK_EVENT] = []
    json.hooks[HOOK_EVENT].push(hookBlock())
    mkdirSync(`${P.root}/.claude`, { recursive: true }) // a project without one yet
    writeAtomic(settingsPath(P), JSON.stringify(json, null, 2) + '\n')
    const err = setConfigHooks(P, 'on')
    say(`installed: one ${HOOK_EVENT} block in .claude/settings.json (self-identified by ${HOOK_MARK})${err === null ? ' · config hooks: on' : ` · ${err}`}`)
    say('the host will ask the user to review new project hooks — that consent dialog is part of the install, not an error')
    return 0
  }

  // remove — surgical: our entries out, emptied scaffolding out, nothing else moved.
  if (!s.exists) {
    const err = setConfigHooks(P, 'off')
    say(`nothing registered (no settings.json)${err === null ? ' · config hooks: off' : ` · ${err}`}`)
    return 0
  }
  if (!registered(s.json)) {
    const err = setConfigHooks(P, 'off')
    say(`nothing registered — no change to settings.json${err === null ? ' · config hooks: off' : ` · ${err}`}`)
    return 0
  }
  const json = s.json
  for (const key of Object.keys(json.hooks)) {
    if (!Array.isArray(json.hooks[key])) continue
    for (const b of json.hooks[key]) if (Array.isArray(b?.hooks)) b.hooks = b.hooks.filter(h => !isOurs(h))
    json.hooks[key] = json.hooks[key].filter(b => !Array.isArray(b?.hooks) || b.hooks.length > 0)
    if (json.hooks[key].length === 0) delete json.hooks[key]
  }
  if (Object.keys(json.hooks).length === 0) delete json.hooks
  writeAtomic(settingsPath(P), JSON.stringify(json, null, 2) + '\n')
  const err = setConfigHooks(P, 'off')
  say(`removed: our entries and the scaffolding they left empty; every other hook kept its bytes${err === null ? ' · config hooks: off' : ` · ${err}`}`)
  return 0
}
