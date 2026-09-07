// cycle diff — the ONE derivation of "what review reads", mechanical.
// FORMATS: a node's cycle diff is everything since the parent of the cycle's first
// `TASK-N:` commit, plus uncommitted changes, limited to the node's files. A cycle
// starts when the node leaves approved; once a review is pinned (reviewed_commit,
// written at done), the next cycle's commits are the ones after that pin.
import { topValue } from './core.mjs'
import { git, porcelainPaths, repoState, shallowState, ancestorState, canonicalOidState, emptyTree, log, touched, showPrefix } from './git.mjs'

const say = s => process.stdout.write(s + '\n')

export function cmdDiff (P, n) {
  if (n === '') { say('usage: grovespec diff TASK-N'); return 2 }
  if (P.read(P.taskPath(n)) === null) { say(`no such node: ${n}`); return 2 }
  const rs = repoState(P.root)
  if (rs === 'broken') { say('git did not answer (missing or failing git) — the cycle cannot be read; no diff was produced'); return 2 }
  if (rs === 'none') { say('not a git repository — diff reads the cycle from TASK- commits'); return 2 }

  // Before ANY history answer, not just before the base: cut history also hides the
  // cycle's commits themselves, and "no TASK- commits" over a shallow window read as
  // a calm empty cycle, exit 0.
  const sh = shallowState(P.root)
  if (sh === 'broken') { say('git rev-parse --is-shallow-repository failed — the cycle cannot be established; no diff was produced'); return 2 }
  if (sh === 'shallow') { say('this is a shallow clone — history is cut, so neither the cycle nor its base can be established; unshallow it (git fetch --unshallow), then re-run'); return 2 }

  const prefix = `${n}: `
  const history = log(P.root)
  if (history === null) { say('git log failed — the cycle cannot be read; no diff was produced'); return 2 }
  let commits = history.filter(c => c.s.startsWith(prefix))

  // A pinned review closes the previous cycle: only commits after it belong to this one.
  const rc = topValue(P.read(P.reviewYamlPath(n)) ?? '', 'reviewed_commit')
  if (rc !== '') {
    // A seal must name immutable bytes: 'HEAD' resolved to an empty rev-list window
    // and hid the whole live cycle. Canonical-full-OID first, then ancestry.
    const oid = canonicalOidState(P.root, rc)
    if (oid === 'broken') { say(`reviewed_commit ${rc.slice(0, 7)} cannot be resolved (unknown commit, or git failed) — the cycle boundary cannot be established; no diff was produced`); return 2 }
    if (oid === 'no') { say(`reviewed_commit '${rc}' is not a canonical full commit id — a seal names immutable bytes, never a moving name (HEAD · branch · short sha); re-run the gate so pin seals a real commit`); return 2 }
    // Existing is not enough: a commit on a sibling branch or a pre-rewrite line
    // EXISTS, and rev-list rc..HEAD "succeeds" around it with a wrong window. The
    // boundary must be an ancestor of the history it bounds.
    const anc = ancestorState(P.root, rc)
    if (anc === 'broken') { say(`git merge-base failed for reviewed_commit ${rc.slice(0, 7)} — the cycle boundary cannot be established; no diff was produced`); return 2 }
    if (anc === 'no') { say(`reviewed_commit ${rc.slice(0, 7)} is not an ancestor of HEAD — a stale seal from another line of history cannot bound this cycle; re-run the gate (grovespec-review) so it seals this history`); return 2 }
    const r = git(P.root, ['rev-list', `${rc}..HEAD`])
    if (!r.ok) {
      // An unknown/unreachable reviewed_commit used to become an EMPTY after-set —
      // real cycle commits then read as "nothing committed", exit 0.
      say(`git rev-list failed for reviewed_commit ${rc.slice(0, 7)} — the cycle boundary cannot be established (unknown or unreachable commit); no diff was produced`)
      return 2
    }
    const after = new Set(r.out.split('\n').filter(Boolean))
    commits = commits.filter(c => after.has(c.h))
  }

  // The gate records are never the cycle's SUBJECT. A fix commit legitimately carries the
  // round record it just updated, and folding that into the diff hands the next COLD round
  // the previous rounds' verdicts, reasons and dropped findings — the blankness the whole
  // method rests on is gone before the reviewers read a line of code. Commit discipline
  // cannot close this: the record belongs in the fix commit; the diff is what must exclude
  // it. Measured twice in one run (timelog-3 `951815b` · `2642320`).
  // touched()/porcelain speak repo-root-relative; reviewDir is project-rooted.
  const pfx = showPrefix(P.root)
  if (pfx === null) { say('git rev-parse --show-prefix failed — the review-record boundary cannot be established; no diff was produced'); return 2 }
  const reviewPrefix = `${pfx}${P.reviewDir.slice(P.root.length + 1)}/`
  // Counted, never named: a filename alone tells a cold reader which record to go open.
  // "gate record(s)" is the whole review dir, not only this node's records and not only
  // the yaml — round briefs and test logs live there too, and all of them are held.
  const heldNote = k => `  (${k} file(s) under ${P.reviewDir.slice(P.root.length + 1)}/ held out — gate records are not this cycle's subject)`

  if (commits.length === 0) {
    say(`cycle diff of ${n} (${P.statusOf(n)}) — no '${n}:' commits${rc !== '' ? ` after reviewed_commit ${rc.slice(0, 7)}` : ''}; nothing committed this cycle`)
    const st = git(P.root, ['status', '--porcelain'])
    if (!st.ok) { say('cannot read the working tree (git status failed) — uncommitted state unknown'); return 2 }
    const dirty = st.out.split('\n').filter(Boolean)
    const shown = dirty.filter(l => !porcelainPaths(l).every(p => p.startsWith(reviewPrefix)))
    if (shown.length) {
      say('uncommitted changes (unattributed — see `grovespec fresh`):')
      for (const d of shown) say(`  ${d}`)
    } else if (dirty.length === 0) say('working tree clean')
    if (dirty.length - shown.length) say(heldNote(dirty.length - shown.length))
    return 0
  }

  const oldest = commits[commits.length - 1].h
  // Root-or-not is answered by the parent COUNT, never by whether a parent lookup
  // succeeded — a lookup failure is an error, not a root commit.
  const par = git(P.root, ['rev-list', '--parents', '-1', oldest])
  if (!par.ok) { say(`git rev-list failed at ${oldest.slice(0, 7)} — the cycle base cannot be established; no diff was produced`); return 2 }
  let base = `${oldest}^`
  if (par.out.trim().split(/\s+/).length === 1) {
    // A root commit diffs against the empty tree — ASKED of the repository, because
    // the SHA-1 constant is not the empty tree in a SHA-256 repository (there, a root
    // cycle died with "bad revision").
    base = emptyTree(P.root)
    if (base === null) { say('git hash-object failed — the empty-tree base for a root commit cannot be established; no diff was produced'); return 2 }
  }

  const files = []
  const held = new Set()
  for (const c of commits) {
    const tf = touched(P.root, c.h)
    if (tf === null) { say(`cannot read the files of ${c.h.slice(0, 7)} — git show failed (git >= 2.31 is required for merge-aware diffs); no diff was produced`); return 2 }
    for (const f of tf) {
      if (f.startsWith(reviewPrefix)) { held.add(f); continue }
      if (!files.includes(f)) files.push(f)
    }
  }
  files.sort()

  say(`cycle diff of ${n} (${P.statusOf(n)}) — ${commits.length} commit(s), base = parent of ${oldest.slice(0, 7)}`)
  for (const c of commits) say(`  ${c.h.slice(0, 7)} ${c.s}`)
  say('files:')
  for (const f of files) say(`  ${f}`)
  if (held.size) say(heldNote(held.size))

  if (files.length === 0) {
    // `git diff base --` with no pathspec is the WHOLE tree — an empty cycle
    // (e.g. an --allow-empty commit) must show nothing, not everything.
    say(held.size
      ? '--- the cycle commits touched gate records only — nothing of this node to diff ---'
      : '--- no files touched by the cycle commits — nothing to diff ---')
  } else {
    say('--- diff (base → working tree, cycle files only) ---')
    // `top` makes the pathspec repo-root-relative from any cwd (the collected names
    // ARE repo-root-relative — a nested project's bare pathspec silently emptied the
    // body); `literal` stops [ ] * ? in real filenames (src/[a].js) from globbing
    // NEIGHBORS into a diff that claims to be cycle-files-only.
    const d = git(P.root, ['diff', base, '--', ...files.map(f => `:(top,literal)${f}`)])
    if (!d.ok) {
      process.stdout.write(d.err)
      say('git diff failed — the diff above is incomplete or absent; not a produced diff')
      return 2
    }
    process.stdout.write(d.out)
  }

  // Uncommitted edits OUTSIDE the cycle's files are not this node's work — surface them
  // instead of silently folding them in or silently dropping them.
  const st = git(P.root, ['status', '--porcelain'])
  if (!st.ok) { say('cannot read the working tree (git status failed) — the outside-the-cycle list is unknown'); return 2 }
  const dirtyLines = st.out.split('\n').filter(Boolean)
  // A record touched by a cycle commit AND still dirty is ONE file — counting it in both
  // notes read as two. Only records the committed count didn't already cover are added.
  const heldDirty = dirtyLines.filter(l => porcelainPaths(l).every(p => p.startsWith(reviewPrefix)) && !porcelainPaths(l).every(p => held.has(p))).length
  const outside = dirtyLines.filter(l => !porcelainPaths(l).some(p => files.includes(p)) && !porcelainPaths(l).every(p => p.startsWith(reviewPrefix)))
  if (outside.length) {
    say('--- uncommitted outside the cycle files (not shown above — see `grovespec fresh`) ---')
    for (const l of outside) say(`  ${l}`)
  }
  // With nothing held from the commits, "the same reason" points at a line that was never
  // printed — say the whole reason instead of referring back to one.
  if (heldDirty) say(held.size ? `  (+ ${heldDirty} more, uncommitted — held out for the same reason)` : heldNote(heldDirty))
  return 0
}
