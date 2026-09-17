// Thin git access — the diff/fresh commands' one door to history. Still zero npm deps
// (node:child_process is a builtin); git itself is already a GroveSpec requirement.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// GROVESPEC_GIT overrides the binary: an unusual install can name its git, and the
// test suite points it at a void to prove every reader REFUSES when git cannot answer
// (a PATH-shim fake would not work — Windows' CreateProcess ignores scripts).
// LC_ALL=C pins git's messages so repoState below can read them on any locale.
// The paths out of one `git status --porcelain` line — a LIST, because a rename or copy
// line carries TWO (`R  old -> new`), and a reader that models one walks past the other.
// That is not theoretical: `git mv helper.py src/helper.py` left the whole line unmatched
// by either prefix, so the machine result gate read a dirty tree as clean and stamped the
// node done. Quoting is stripped per path: quotepath (pinned off below) governs only
// NON-ASCII bytes, while a space, a quote, a backslash or a control character is C-quoted
// regardless — and an unstripped quote never matches a configured prefix.
//
// Every porcelain reader goes through this. Saying so in a comment is what failed twice
// (the helper landed in one command, then two of three), so the suite now measures it:
// tests/fixtures … `quotepath` (a spaced hand-edit) and `renamegate` (a staged rename)
// put approve · fresh · diff over the same trees.
export function porcelainPaths (line) {
  const unq = p => p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : p
  const rest = line.slice(3)
  // The separator only means "rename" between an unquoted path and the next; inside a
  // quoted path it is literal text, so split on the quoting-aware form first.
  const m = rest.match(/^(".*?"|[^"]*?) -> (".*"|.*)$/)
  return m ? [unq(m[1]), unq(m[2])] : [unq(rest)]
}

export function git (root, args) {
  // The caller's environment must not redefine how git reads OUR arguments or which
  // object graph it walks:
  //  · GIT_*_PATHSPECS turn our `:(top,literal)` prefixes into literal FILENAMES —
  //    every cycle-file pathspec then matched nothing and the diff body silently
  //    emptied while the header still claimed those files.
  //  · replace refs rewrite the graph: a `git replace A C` made a sealed full OID
  //    resolve and pass ancestry while whole TASK commits vanished from log.
  //    --no-replace-objects makes every reader see one graph — the real one.
  //  · core.quotepath (git's DEFAULT true, and a user setting besides) C-escapes every
  //    non-ASCII byte in a path — `검토/x.yaml` prints as `"\352\262\200..."`. A reader
  //    comparing that against a configured path never matches, so the review-dir filter
  //    leaked record filenames into a cold diff and the clean-tree guard could walk past
  //    a dirty Korean-named file. `-z` fixes the same thing where the format allows it
  //    (touched · trackedPaths); porcelain's -z needs a different parser, so this pins the
  //    spelling for every reader. It closes only HALF the class — a space still quotes —
  //    so porcelainPaths() above is the other half, and both live here rather than at the
  //    call sites: a list of call sites is the thing that goes stale.
  const env = { ...process.env, LC_ALL: 'C' }
  for (const v of ['GIT_LITERAL_PATHSPECS', 'GIT_GLOB_PATHSPECS', 'GIT_NOGLOB_PATHSPECS', 'GIT_ICASE_PATHSPECS']) delete env[v]
  try {
    const out = execFileSync(process.env.GROVESPEC_GIT ?? 'git', ['--no-replace-objects', '-c', 'core.quotepath=false', '-C', root, ...args], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
      env
    })
    return { ok: true, out }
  } catch (e) {
    // code null = git never ran (missing binary, spawn failure) — distinct from git
    // running and answering non-zero; repoState needs the difference.
    return { ok: false, out: String(e.stdout ?? ''), err: String(e.stderr ?? ''), code: e.status ?? null }
  }
}

// Three answers, never two: 'repo' · 'none' (git ITSELF says this is not a repository)
// · 'broken' (git missing, crashing, or a corrupt repository). Collapsing broken into
// none turned a deleted git binary into "not a repo": id then issued from files alone
// (a possibly colliding number over unread history), validate skipped every
// history-bound check under a clean tick, and next's terminal forgot fresh entirely.
export function repoState (root) {
  const r = git(root, ['rev-parse', '--git-dir'])
  if (r.ok) return 'repo'
  if (r.code === 128 && /not a git repository/i.test(r.err)) {
    // git says the same words for "no repository here" and "a repository is here but
    // its HEAD/metadata is mangled" — opposite meanings. A `.git` marker present
    // while git denies the repo is damage, not absence: refs and objects may hold
    // TASK history this runtime must not issue ids or verdicts over. (The marker
    // check covers the standard layout; a project nested under a corrupt OUTER repo
    // has no marker of its own and still reads as none — the stated residue.)
    return existsSync(`${root}/.git`) ? 'broken' : 'none'
  }
  return 'broken'
}
export const inRepo = root => repoState(root) === 'repo'

// A shallow clone's history READS successfully — and is cut. Every all-history answer
// (which ids ever existed, what a cycle's base is, which commits went unclassified)
// silently shrinks to the fetched window: a depth-1 clone re-issued a burned id with
// exit 0. 'full' | 'shallow' | 'broken'. The contract is a full clone — a shallow one
// is refused outright, even when the needed boundary happens to be local (a depth-2
// clone pays that precision away; proving "the needed history is here" per question
// is machinery the answer's value does not buy).
export function shallowState (root) {
  const r = git(root, ['rev-parse', '--is-shallow-repository'])
  if (!r.ok) return 'broken'
  return r.out.trim() === 'true' ? 'shallow' : 'full'
}

// A seal names BYTES, so its value must BE the canonical full commit id — 'HEAD', a
// branch name, 'HEAD~1' or a short sha all resolve today and MOVE tomorrow: a
// `reviewed_commit: HEAD` boundary made rev-list HEAD..HEAD an empty window and hid
// the entire live cycle. Resolve and require byte-equality with the recorded value.
// 'yes' | 'no' (resolves, but to a different spelling — a moving name) | 'broken'.
export function canonicalOidState (root, rc) {
  const r = git(root, ['rev-parse', '--verify', '--quiet', `${rc}^{commit}`])
  if (!r.ok) return 'broken'
  return r.out.trim() === rc ? 'yes' : 'no'
}

// Is `commit` an ancestor of HEAD? A reviewed_commit that merely EXISTS can sit on a
// sibling branch or a pre-rewrite line — rev-list rc..HEAD then "succeeds" and hands
// back a wrong cycle window. 'yes' | 'no' | 'broken'.
export function ancestorState (root, commit) {
  const r = git(root, ['merge-base', '--is-ancestor', commit, 'HEAD'])
  if (r.ok) return 'yes'
  if (r.code === 1) return 'no'
  return 'broken'
}

// The empty tree's id, ASKED of the repository — the SHA-1 constant is wrong in a
// SHA-256 repo, where a root cycle's base failed with "bad revision". stdin is
// /dev/null here, so `hash-object -t tree --stdin` hashes nothing: the empty tree,
// in whatever object format this repository uses. null when git cannot answer.
export function emptyTree (root) {
  const r = git(root, ['hash-object', '-t', 'tree', '--stdin'])
  return r.ok ? r.out.trim() : null
}

// The paths that are tracked AND present in the working tree, as repo-root-relative
// names. Two halves, both git's own answers:
//  · the index (`ls-files`) — not existsSync, which said yes to a DIRECTORY that
//    replaced a deleted file and, on Windows, to `Foo.js` and `foo.js` alike;
//  · minus `--deleted` — the index alone kept an UNSTAGED deletion "alive": files
//    then handed a nonexistent path to revise as its reading boundary, and the same
//    tree answered differently before and after a mere `git add -u`.
// `--full-name -- :/` because ls-files run from a SUBDIRECTORY otherwise lists only
// that subtree, named relative to it — a nested project then failed to find its own
// files under their repo-rooted names and reported every one as deleted.
export function trackedPaths (root) {
  const all = git(root, ['ls-files', '--full-name', '-z', '--', ':/'])
  if (!all.ok) return null
  const del = git(root, ['ls-files', '--full-name', '-z', '--deleted', '--', ':/'])
  if (!del.ok) return null
  const live = new Set(all.out.split('\0').filter(Boolean))
  for (const d of del.out.split('\0').filter(Boolean)) live.delete(d)
  return live
}

// The project's path below the repository toplevel ('' at the toplevel itself).
// git speaks repo-root-relative; the project thinks project-relative — every consumer
// that compares the two must convert through THIS, or a nested project reads wrong.
// null when git cannot answer.
export function showPrefix (root) {
  const r = git(root, ['rev-parse', '--show-prefix'])
  return r.ok ? r.out.trim() : null
}

// check-ignore answers three ways: exit 0 = ignored, exit 1 = not ignored, anything
// else = it could not answer. Folding the third into "not ignored" re-opened the very
// gate this check closes — an unanswerable ignore-state let pin seal a foreign HEAD
// and approve flip reviewed → done over it. 'yes' | 'no' | 'broken'.
export function ignoredState (root) {
  const r = git(root, ['check-ignore', '-q', '.'])
  if (r.ok) return 'yes'
  if (r.code === 1) return 'no'
  return 'broken'
}

// One shared path domain for result pin and result approval. Git reports paths from
// the repository root while GroveSpec config is project-rooted; nested projects must
// pass through this conversion before src/tests comparisons.
function pathsUnderProject (P, dirs) {
  const rel = p => p.startsWith(`${P.root}/`) ? p.slice(P.root.length + 1) : null
  const areas = dirs.map(rel).filter(x => x !== null)
  const prefix = showPrefix(P.root)
  if (prefix === null) return null
  return file => {
    if (!file.startsWith(prefix)) return false
    const projectPath = file.slice(prefix.length)
    return areas.some(area => projectPath === area || projectPath.startsWith(`${area}/`))
  }
}

// null means git could not establish the answer; [] means clean. Every porcelain
// path flows through porcelainPaths so quoted names and both sides of renames share
// exactly the same semantics at pin and approve.
export function dirtyUnder (P) {
  const inCode = pathsUnderProject(P, [P.srcDir, P.testsDir])
  if (inCode === null) return null
  const r = git(P.root, ['status', '--porcelain', '--untracked-files=all'])
  if (!r.ok) return null
  return r.out.split('\n').filter(Boolean).filter(line => porcelainPaths(line).some(inCode))
}

// A result verdict is allowed to leave only its own gate artifacts mutable between
// pin and approval.  `grovespec diff` can review executable inputs outside the
// configured src/tests pair (package.json, a lockfile, build config, migrations at
// the project root, ...).  Limiting the pending seal to src/tests let one of those
// reviewed files change after the cold pass while approve still stamped `done`.
//
// The Task itself is excluded from Git cleanliness because its status and mutable
// bookkeeping are gate state; Contract/AC and frontmatter are bound separately by
// spec_digest + task_evidence_digest during the pending decision window.  The
// review directory is excluded because test logs and the pending verdict live there.
// Everything else inside THIS project is held still for the short pending window.
// A containing monorepo's siblings enter only when this Task's commit history touched
// them, matching the wider subject that `grovespec diff` may have shown reviewers.
function resultSubjectPath (P, target) {
  const prefix = showPrefix(P.root)
  if (prefix === null) return null
  // A node may intentionally touch a shared monorepo sibling. `grovespec diff`
  // includes that path, so the hand-off seal must include it too.  The all-cycle
  // footprint is a safe superset of the current cycle and, unlike a stored path
  // roster, cannot be truncated or miss a new post-pin TASK commit.
  if (shallowState(P.root) !== 'full') return null
  const history = log(P.root)
  if (history === null) return null
  const footprint = new Set()
  for (const c of history) {
    if (!c.s.startsWith(`${target}: `)) continue
    const paths = touched(P.root, c.h)
    if (paths === null) return null
    for (const path of paths) footprint.add(path)
  }
  const rel = p => p.startsWith(`${P.root}/`) ? p.slice(P.root.length + 1) : null
  const task = rel(P.taskPath(target))
  const review = rel(P.reviewDir)
  if (task === null || review === null) return null
  const taskPath = `${prefix}${task}`
  const reviewPath = `${prefix}${review}`
  const runLockPath = `${prefix}.grovespec/run.lock`
  return file => {
    if (file === taskPath) return false
    if (file === reviewPath || file.startsWith(`${reviewPath}/`)) return false
    // The dispatcher creates this owner file before invoking every mutating command
    // and removes it afterward; it is runtime coordination, never reviewer input.
    if (file === runLockPath || file.startsWith(`${runLockPath}/`)) return false
    if (footprint.has(file)) return true
    if (!file.startsWith(prefix)) return false
    return file.slice(prefix.length) !== ''
  }
}

// null means git could not establish the answer; [] means the whole pending result
// subject is clean.  Keep the original porcelain line for a useful refusal message.
export function dirtyResultSubject (P, target) {
  const inSubject = resultSubjectPath(P, target)
  if (inSubject === null) return null
  const r = git(P.root, ['status', '--porcelain', '--untracked-files=all'])
  if (!r.ok) return null
  return r.out.split('\n').filter(Boolean).filter(line => porcelainPaths(line).some(inSubject))
}

// Does an immutable commit still cover the code at HEAD? Evidence-only descendant
// commits are allowed; a non-canonical/unrelated id or committed src/tests movement
// is a breach. null means covered, otherwise the returned text names the failure.
export function sealBreach (P, commit) {
  const oid = canonicalOidState(P.root, commit)
  if (oid === 'broken') return `${commit.slice(0, 7)} cannot be resolved (unknown commit, or git failed) — an unread check is not a passed one`
  if (oid === 'no') return `'${commit}' is not a canonical full commit id — a seal names immutable bytes, never a moving name (re-run the gate so pin seals a real commit)`
  const anc = ancestorState(P.root, commit)
  if (anc === 'broken') return `${commit.slice(0, 7)} cannot be checked (git merge-base failed) — an unread check is not a passed one`
  if (anc === 'no') return `${commit.slice(0, 7)} is not an ancestor of HEAD — a seal from another line of history binds nothing here`
  const inCode = pathsUnderProject(P, [P.srcDir, P.testsDir])
  if (inCode === null) return `whether the code moved since ${commit.slice(0, 7)} is unread (git rev-parse --show-prefix failed) — an unread check is not a passed one`
  // Disable rename detection so a move across the configured boundary is exposed as
  // both deletion and addition. `--name-only` with rename detection reports only the
  // destination, which let `src/a.js -> docs/a.js` hide the reviewed source path.
  // NUL framing also keeps newline-bearing path names from changing the answer.
  const r = git(P.root, ['diff', '--name-only', '--no-renames', '-z', `${commit}..HEAD`])
  if (!r.ok) return `whether the code moved since ${commit.slice(0, 7)} is unread (git diff failed) — an unread check is not a passed one`
  const moved = r.out.split('\0').filter(Boolean).filter(inCode)
  if (!moved.length) return null
  const shown = moved.slice(0, 5).join(', ')
  return `code moved since ${commit.slice(0, 7)}: ${shown}${moved.length > 5 ? ` (+${moved.length - 5} more)` : ''}`
}

// Pending result decisions use a wider domain than the legacy src/tests code seal:
// every project path except this gate's own Task + review evidence.  The commit OID
// already binds the bytes at pin time; this check proves no descendant commit changed
// any of those bytes before approval.  --no-renames exposes both sides of a move.
export function resultSealBreach (P, target, commit) {
  const oid = canonicalOidState(P.root, commit)
  if (oid === 'broken') return `${commit.slice(0, 7)} cannot be resolved (unknown commit, or git failed) -- an unread check is not a passed one`
  if (oid === 'no') return `'${commit}' is not a canonical full commit id -- a seal names immutable bytes, never a moving name (re-run the gate so pin seals a real commit)`
  const anc = ancestorState(P.root, commit)
  if (anc === 'broken') return `${commit.slice(0, 7)} cannot be checked (git merge-base failed) -- an unread check is not a passed one`
  if (anc === 'no') return `${commit.slice(0, 7)} is not an ancestor of HEAD -- a seal from another line of history binds nothing here`
  const inSubject = resultSubjectPath(P, target)
  if (inSubject === null) return `whether the reviewed project moved since ${commit.slice(0, 7)} is unread (git rev-parse --show-prefix failed) -- an unread check is not a passed one`
  const r = git(P.root, ['diff', '--name-only', '--no-renames', '-z', `${commit}..HEAD`])
  if (!r.ok) return `whether the reviewed project moved since ${commit.slice(0, 7)} is unread (git diff failed) -- an unread check is not a passed one`
  const moved = r.out.split('\0').filter(Boolean).filter(inSubject)
  if (!moved.length) return null
  const shown = moved.slice(0, 5).join(', ')
  return `reviewed project input moved since ${commit.slice(0, 7)}: ${shown}${moved.length > 5 ? ` (+${moved.length - 5} more)` : ''}`
}

// (Why the ignore-state matters at all: git walks UP from the project, so a project
// dropped inside an ignored subtree of a bigger repo still answers 'repo' — while no
// commit of this code can ever exist there. Then `reviewed_commit` records that foreign
// HEAD, `approve` compares against it and passes for free, and `diff`/`fresh` read a
// history that never touched these files: a result gate sealed to bytes it never
// covered. Nesting itself is fine — a TRACKED subdirectory of a monorepo commits
// normally; only an ignored subtree is ungateable. See ignoredState above.)

// All commits as {h, s} (full hash, subject), newest first. Empty history → [].
// null when the call itself failed (corrupt objects, dying git) — "no commits" is a
// normal early state that callers answer calmly, so a failure must not wear it.
export function log (root) {
  const r = git(root, ['log', '--format=%H\t%s'])
  if (!r.ok) {
    // An unborn branch (init, nothing committed) IS empty history, not a failure.
    if (/does not have any commits yet|bad default revision/i.test(r.err)) return []
    return null
  }
  return r.out.split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('\t')
    return { h: l.slice(0, i), s: l.slice(i + 1) }
  })
}

// Every trace an id can leave in history, across ALL reachable refs — not just the
// current branch's ancestry, and not just commit subjects. Two things carry an id:
// the subject of a convention commit (`TASK-N: …`, and the step shapes `grow/verify/
// review/revise/approve/ratify TASK-N: …` — every prefix FORMATS names) and the PATH of
// a task file in any commit that touched it. Reading only the current ancestry's
// subjects missed both a sibling branch's node and a node added under a plain subject
// and later deleted — either one, reissued, would inherit a dead node's commits.
// (`log` above stays ancestry-bound on purpose: a cycle diff is about THIS history.)
//
// These helpers return NULL when the git call fails — never []. A failure folded into
// "empty" reads as "touched nothing / no history", and a git too old for an option
// here would quietly narrow every reader while each printed success (the wrapper
// captures stderr, so nothing is loud on its own). The caller refuses on null.
export function allSubjects (root) {
  const r = git(root, ['log', '--all', '--format=%s'])
  return r.ok ? r.out.split('\n').filter(Boolean) : null
}
export function allTouchedPaths (root) {
  const r = git(root, ['log', '--all', '--name-only', '--format=', '-z', '--diff-merges=first-parent'])
  return r.ok ? r.out.split('\0').filter(Boolean) : null
}

// Files a commit touched (repo-relative, forward slashes as git prints them).
// `-z` on every path-emitting call: without it git C-quotes any non-ASCII path
// (`"\353\254\270\354\204\234/…"`), and a newline parser then carries the quotes and
// octal into the path — a Korean tasks directory made every such path unmatchable.
// `--diff-merges=first-parent` on both: a merge shows NO diff by default, so a file
// born or buried in a merge resolution left no path trace — an id burned only there
// could be reissued, and a merge-shaped cycle commit read as touching nothing.
// First-parent is the mainline's view: what this commit brought to the line.
// (Both options only change merge output — non-merge commits print the same bytes.)
// null on failure, as above — [] must mean "genuinely touched nothing".
export function touched (root, hash) {
  const r = git(root, ['show', '--format=', '--name-only', '-z', '--diff-merges=first-parent', hash])
  return r.ok ? r.out.split('\0').filter(Boolean) : null
}

// Merge commits reachable from HEAD. fresh SKIPS these when classifying history:
// a merge carries its branch's changes, and the branch's own commits already answered
// for them — counting the merge again reported TASK-attributed work as out-of-band
// (a plain-titled merge of a TASK branch flipped fresh red). The cost, stated: a
// conflict resolution's own hand-content is invisible to fresh — the same limit the
// no-merge-diff era had, now on purpose instead of by accident. null on failure.
export function mergeHashes (root) {
  const r = git(root, ['rev-list', '--merges', 'HEAD'])
  return r.ok ? new Set(r.out.split('\n').filter(Boolean)) : null
}

export const TASK_COMMIT = /^TASK-[0-9]+: /
