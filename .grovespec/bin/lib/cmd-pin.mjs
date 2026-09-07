// pin — the SEAL step of a gate: run at the moment a cold cycle passes, it binds the
// verdict to the exact bytes it was passed on, and marks the verdict `approved_by:
// pending` — a verdict exists, nobody has decided on it. `approve` later COMPARES these
// bindings and only flips states; it writes no evidence of its own.
//
//   pin TASK-N   at spec pass (task draft):    spec_digest              → <id>.verify.yaml
//                at result pass (task reviewed): reviewed_commit (HEAD)
//                                               + spec_digest           → <id>.review.yaml
//   pin tree     at tree pass:                 tree_digest (canonical structure)
//                                                                       → tree.verify.yaml
//
// A pin on an already-advanced node (approved/done) re-seals the digest but never touches
// approved_by — that gate was taken; re-marking it pending would fabricate an open decision.
import { createHash } from 'node:crypto'
import { splitLines, specSpanText, treeRows, topValue } from './core.mjs'
import { writeAtomic } from './project.mjs'
import { git, repoState, ignoredState } from './git.mjs'

const say = s => process.stdout.write(s + '\n')

export function specDigest (taskText) {
  const span = specSpanText(taskText)
  return span === null ? null : createHash('sha256').update(span, 'utf8').digest('hex')
}

// The tree digest covers the parsed STRUCTURE (id + parent per node), not the file's
// bytes — indentation style and comments don't invalidate an approval; a moved, added
// or removed node does. Names/roles live in Task files and may change without this.
export function treeDigest (treeText) {
  const canon = treeRows(treeText).map(r => `${r.tid}\t${r.parent}`).join('\n')
  return createHash('sha256').update(canon, 'utf8').digest('hex')
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
  if (n === '') { say('usage: grovespec pin TASK-N | pin tree'); return 2 }

  if (n === 'tree') {
    const tp = P.treeYamlPath()
    const tt = P.read(tp)
    if (tt === null) { say(`no tree verify record to pin (${tp} missing) — run grovespec-verify on the tree first`); return 2 }
    const digest = treeDigest(P.treeText())
    const kv = { tree_digest: digest }
    if (topValue(tt, 'approved_by') === '') kv.approved_by = 'pending'
    writeAtomic(tp, upsertTop(tt, kv))
    P.forget()
    say(`pinned: tree_digest ${digest.slice(0, 12)}… → ${tp} (structure sealed; awaiting your approval)`)
    return 0
  }

  const taskText = P.read(P.taskPath(n))
  if (taskText === null) { say(`no such node: ${n}`); return 2 }
  const st = P.statusOf(n)
  const digest = specDigest(taskText)
  if (digest === null) { say(`${n}: cannot digest — Overview…AC sections malformed (run grovespec validate)`); return 2 }

  if (st === 'draft' || st === 'approved') {
    const vp = P.verifyYamlPath(n)
    const vt = P.read(vp)
    if (vt === null) { say(`${n}: no verify record to pin (${vp} missing) — run grovespec-verify first`); return 2 }
    const kv = { spec_digest: digest }
    if (st === 'draft' && topValue(vt, 'approved_by') === '') kv.approved_by = 'pending'
    writeAtomic(vp, upsertTop(vt, kv))
    P.forget()
    say(`pinned: ${n} spec_digest ${digest.slice(0, 12)}… → ${vp}`)
    return 0
  }
  if (st === 'reviewed' || st === 'done') {
    const rp = P.reviewYamlPath(n)
    const rt = P.read(rp)
    if (rt === null) { say(`${n}: no review record to pin (${rp} missing) — run grovespec-review first`); return 2 }
    const rs = repoState(P.root)
    if (rs === 'broken') { say('git did not answer (missing or failing git) — a review pin records a commit that cannot be read right now'); return 2 }
    if (rs === 'none') { say('not a git repository — a review pin records the reviewed commit'); return 2 }
    const ig = ignoredState(P.root)
    if (ig === 'broken') { say('git check-ignore did not answer — whether this project is gateable cannot be established, so nothing was sealed'); return 2 }
    if (ig === 'yes') { say('this project sits inside a git repository that ignores it — the commit a review pin would record is one no change to this code can move, so the seal would cover bytes it never saw. Give the project its own repository (git init) and commit its code first'); return 2 }
    const head = git(P.root, ['rev-parse', 'HEAD'])
    if (!head.ok) { say('cannot resolve HEAD — nothing committed yet?'); return 2 }
    const commit = head.out.trim()
    const kv = { reviewed_commit: commit, spec_digest: digest }
    if (st === 'reviewed' && topValue(rt, 'approved_by') === '') kv.approved_by = 'pending'
    writeAtomic(rp, upsertTop(rt, kv))
    P.forget()
    say(`pinned: ${n} reviewed_commit ${commit.slice(0, 7)} + spec_digest ${digest.slice(0, 12)}… → ${rp}`)
    return 0
  }
  say(`${n}: nothing to pin at status '${st}' — pin seals a cycle's pass (draft/approved for spec, reviewed/done for result)`)
  return 2
}
