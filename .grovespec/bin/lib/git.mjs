// Thin git access — the diff/fresh commands' one door to history. Still zero npm deps
// (node:child_process is a builtin); git itself is already a GroveSpec requirement.
import { execFileSync } from 'node:child_process'

export function git (root, args) {
  try {
    const out = execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']
    })
    return { ok: true, out }
  } catch (e) {
    return { ok: false, out: String(e.stdout ?? ''), err: String(e.stderr ?? ''), code: e.status ?? 1 }
  }
}

export const inRepo = root => git(root, ['rev-parse', '--git-dir']).ok

// All commits as {h, s} (full hash, subject), newest first. Empty history → [].
export function log (root) {
  const r = git(root, ['log', '--format=%H\t%s'])
  if (!r.ok) return []
  return r.out.split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('\t')
    return { h: l.slice(0, i), s: l.slice(i + 1) }
  })
}

// Files a commit touched (repo-relative, forward slashes as git prints them).
export function touched (root, hash) {
  const r = git(root, ['show', '--format=', '--name-only', hash])
  return r.ok ? r.out.split('\n').filter(Boolean) : []
}

export const TASK_COMMIT = /^TASK-[0-9]+: /
