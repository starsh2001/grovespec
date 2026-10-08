// uninstall — clean removal of the TOOL, never the project's history (v0.15.0).
// The definition this command encodes: the runtime and the
// skills leave; the LEDGER stays — gate records (paths.review), waits.yaml,
// config.yaml, and everything under docs/ (tree · tasks · ref · brief) are the
// project's memory, all plain markdown/YAML, readable with no tool installed. A
// methodology switch hands the next tool exactly these files as its brownfield
// input, so deleting them wholesale is destroying history, not uninstalling
// (METHODOLOGY §9). `--purge` deletes the .grovespec ledger too — an explicitly
// human-confirmed act the skill asks about; the runtime only obeys the flag.
//
// Self-deletion is not the exotic case it sounds like: there is no binary here —
// node.exe is the system's, and our .mjs files were read and closed at import, so
// the OS lets a running script unlink them. The two real traps are handled: the
// process chdir()s to the root first (Windows cannot remove a directory any
// process is standing in), and bin/ goes LAST so a mid-way failure leaves a
// working runtime plus a printed list of what remains — a half-uninstall must
// never be silent.
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'

const say = s => process.stdout.write(s + '\n')

// Runtime parts, deleted in this order (bin last — see above). Enumerated
// literals on purpose: a delete list must never be computed from config a user
// can point somewhere else.
const RUNTIME = ['.grovespec/schema', '.grovespec/templates', '.grovespec/LICENSE', '.grovespec/NOTICE', '.grovespec/TRADEMARK.md', '.grovespec/VERSION', '.grovespec/bin']
const LEDGER = ['.grovespec/review', '.grovespec/config.yaml', '.grovespec/waits.yaml']

export function cmdUninstall (P, flags, removeHooks) {
  const purge = flags.includes('--purge')
  if (!existsSync(`${P.root}/.grovespec`)) { say('nothing to uninstall — no .grovespec here'); return 2 }
  try { process.chdir(P.root) } catch { /* best effort — the rm errors below speak */ }

  // 1. The hook registration first — a registration outliving its script is the
  // one loose end that stays user-visible (a cannot-find-module warning per edit).
  removeHooks()

  const gone = []
  const rm = target => {
    if (!existsSync(`${P.root}/${target}`)) return true
    try { rmSync(`${P.root}/${target}`, { recursive: true, force: false }); gone.push(target); return true } catch (e) {
      say('uninstall stopped — the OS refused a removal (an open handle?):')
      for (const g of gone) say(`  removed: ${g}`)
      say(`  stuck:   ${target} (${e.code ?? e.message})`)
      say(`finish by hand: delete ${target} — everything already removed is unregistered and inert`)
      return false
    }
  }

  // 2. Skill bundles, both hosts — self-identified by the grovespec- prefix.
  for (const host of ['.claude', '.agents']) {
    const base = `${P.root}/${host}/skills`
    let names = []
    try { names = readdirSync(base).filter(n => n.startsWith('grovespec-') && statSync(`${base}/${n}`).isDirectory()) } catch { continue }
    for (const n of names.sort()) if (!rm(`${host}/skills/${n}`)) return 1
  }

  // 3. Runtime, bin last. --purge instead takes the whole .grovespec directory.
  if (purge) {
    if (!rm('.grovespec')) return 1
  } else {
    for (const t of RUNTIME) if (!rm(t)) return 1
    // An empty shell with no ledger inside has nothing left to say — remove it.
    let rest = []
    try { rest = readdirSync(`${P.root}/.grovespec`) } catch { rest = null }
    if (rest !== null && rest.length === 0) rm('.grovespec')
  }

  say(`uninstalled${purge ? ' (--purge)' : ''}: ${gone.length ? gone.join(' · ') : 'nothing was present to remove'}`)
  if (!purge) {
    const kept = LEDGER.filter(t => existsSync(`${P.root}/${t}`))
    say(`kept — the project's history, readable with no tool: ${kept.length ? kept.join(' · ') : '(no ledger files were present)'} and everything under docs/`)
    say('these are plain markdown/YAML; a next methodology reads them as its brownfield input. --purge deletes the .grovespec ledger too.')
  } else {
    say('the .grovespec ledger is gone with the tool; docs/ (tree · tasks · ref · brief) was not touched — it is the project\'s, not the tool\'s')
  }
  return 0
}
