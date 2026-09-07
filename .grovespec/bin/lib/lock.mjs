// lock — the single-writer gate for project state. mkdir is atomic on every platform
// and cannot exist half-created; the nonce file inside ties release to the holder, so
// one process can never remove a lock a second process now owns.
//
// NO automatic reclaim, ever. An age threshold cannot tell a corpse from a suspended
// laptop, a stopped debugger or a slow disk — WeaveDoc measured a 10s reclaim stealing
// the lock from a live 13s holder: the neighbour committed, the original holder's
// rollback then chopped the neighbour's committed row, and everything stayed green.
// A crashed run leaves its lock; every later writer refuses loudly and names the exact
// path to delete — that judgment belongs to a human who knows nothing else is running.
//
// A second writer is REFUSED (exit 2), not queued: concurrent grovespec writers are
// unsupported, and a bounded wait would tell a comforting lie about what is supported.
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'

export const lockPath = root => `${root}/.grovespec/run.lock`

export function acquire (root) {
  const dir = lockPath(root)
  try {
    mkdirSync(dir)                       // atomic: held → EEXIST, never half-made
  } catch (e) {
    if (e.code === 'EEXIST') return null
    throw e                              // no .grovespec/, disk full — a different, loud story
  }
  const nonce = `${process.pid}-${Date.now()}`
  writeFileSync(`${dir}/owner`, nonce)
  return { dir, nonce }
}

export function release (held) {
  if (held === null || held === undefined) return
  let cur = ''
  try { cur = readFileSync(`${held.dir}/owner`, 'utf8') } catch { return }   // gone/replaced — not ours anymore
  if (cur !== held.nonce) return
  try { rmSync(held.dir, { recursive: true, force: true }) } catch { /* the next writer names it */ }
}
