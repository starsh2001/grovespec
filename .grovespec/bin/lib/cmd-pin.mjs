// pin — the machine write path for the gates' bindings, so a verdict is tied to the
// exact bytes (and commit) it was passed on. Two moments, chosen by the node's status:
//   draft/approved  → spec pin:   spec_digest into <id>.verify.yaml  (verify's approve step)
//   reviewed/done   → review pin: reviewed_commit (HEAD) + spec_digest into <id>.review.yaml
// validate then reads these back: a digest that no longer matches = the spec moved after
// its gate (stale); a reviewed_commit also closes the cycle `diff` computes.
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { splitLines, specSpanText } from './core.mjs'
import { git, inRepo } from './git.mjs'

const say = s => process.stdout.write(s + '\n')

export function specDigest (taskText) {
  const span = specSpanText(taskText)
  return span === null ? null : createHash('sha256').update(span, 'utf8').digest('hex')
}

function upsertTop (text, kv) {                 // replace or append top-level `key: value` lines
  let lines = splitLines(text)
  for (const [key, value] of Object.entries(kv)) {
    const re = new RegExp(`^${key}[ \\t]*:`)
    const i = lines.findIndex(l => re.test(l))
    if (i === -1) lines = lines.concat([`${key}: ${value}`])
    else lines[i] = `${key}: ${value}`
  }
  return lines.join('\n') + '\n'
}

export function cmdPin (P, n) {
  if (n === '') { say('usage: grovespec pin TASK-N'); return 2 }
  const taskText = P.read(P.taskPath(n))
  if (taskText === null) { say(`no such node: ${n}`); return 2 }
  const st = P.statusOf(n)
  const digest = specDigest(taskText)
  if (digest === null) { say(`${n}: cannot digest — Overview…AC sections malformed (run grovespec validate)`); return 2 }

  if (st === 'draft' || st === 'approved') {
    const vp = P.verifyYamlPath(n)
    const vt = P.read(vp)
    if (vt === null) { say(`${n}: no verify record to pin (${vp} missing) — run grovespec-verify first`); return 2 }
    writeFileSync(vp, upsertTop(vt, { spec_digest: digest }))
    say(`pinned: ${n} spec_digest ${digest.slice(0, 12)}… → ${vp}`)
    return 0
  }
  if (st === 'reviewed' || st === 'done') {
    const rp = P.reviewYamlPath(n)
    const rt = P.read(rp)
    if (rt === null) { say(`${n}: no review record to pin (${rp} missing) — run grovespec-review first`); return 2 }
    if (!inRepo(P.root)) { say('not a git repository — a review pin records the reviewed commit'); return 2 }
    const head = git(P.root, ['rev-parse', 'HEAD'])
    if (!head.ok) { say('cannot resolve HEAD — nothing committed yet?'); return 2 }
    const commit = head.out.trim()
    writeFileSync(rp, upsertTop(rt, { reviewed_commit: commit, spec_digest: digest }))
    say(`pinned: ${n} reviewed_commit ${commit.slice(0, 7)} + spec_digest ${digest.slice(0, 12)}… → ${rp}`)
    return 0
  }
  say(`${n}: nothing to pin at status '${st}' — pin runs at approve (draft/approved) and at done-confirm (reviewed/done)`)
  return 2
}
