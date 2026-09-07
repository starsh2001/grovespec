// approve / ratify — deciding a sealed gate, and the human's post-hoc stamp.
//
// A gate's verdict is written by its cold cycle and SEALED by `pin` (digest · commit ·
// approved_by: pending). `approve` never writes evidence — it verifies that the seal
// still covers the CURRENT bytes, then flips the decision:
//
//   approve TASK-N            machine takes the gate (auto mode). Result gates also
//                             demand machine-verifiable test evidence bound to the code
//                             HEAD holds — bytes, not the commit's name (sealBreach).
//   approve TASK-N --human    the human takes it — judgment allowed, evidence not
//                             required beyond the seal itself.
//   approve tree --human      the human opens the decomposition gate.
//   approve tree              always refused — a wrong tree is the most expensive
//                             thing to build forty nodes on top of.
//
// Every check runs BEFORE any write. The two writes (task status, then record) are not
// one atomic operation, so an interrupted approval leaves task=advanced + record=pending
// — validate names that state, and re-running approve completes it (the repair path).
import { splitLines, topValue, listItemCount, setFmValue } from './core.mjs'
import { writeAtomic } from './project.mjs'
import { specDigest, treeDigest } from './cmd-pin.mjs'
import { git, porcelainPaths, repoState, ignoredState, canonicalOidState, ancestorState } from './git.mjs'

const say = s => process.stdout.write(s + '\n')

// The last_test block, parsed: { command, exit, when, commit } — or null if none recorded.
export function lastTest (text) {
  const lines = splitLines(text)
  const i = lines.findIndex(l => /^last_test[ \t]*:/.test(l))
  if (i === -1) return null
  const out = {}
  for (let j = i + 1; j < lines.length && /^[ \t]/.test(lines[j]); j++) {
    const m = lines[j].match(/^[ \t]+(command|exit|when|commit)[ \t]*:[ \t]*(.*)$/)
    if (m) out[m[1]] = m[2].replace(/[ \t]*$/, '').replace(/^"/, '').replace(/"$/, '')
  }
  return out
}

function upsertTop (text, key, value) {
  const lines = text.split('\n')
  const re = new RegExp(`^${key}[ \\t]*:`)
  const i = lines.findIndex(l => re.test(l.replace(/\r$/, '')))
  if (i === -1) return `${text.replace(/\n*$/, '')}\n${key}: ${value}\n`
  lines[i] = `${key}: ${value}${lines[i].endsWith('\r') ? '\r' : ''}`
  return lines.join('\n')
}

// The decision gate on a record: passed, still pending, nothing left open.
// Returns an error string, or null when the record is decidable.
function recordUndecidable (P, path, label) {
  const text = P.read(path)
  if (text === null) return `no ${label} record (${path} missing) — run the cold gate first`
  const st = topValue(text, 'status')
  if (st !== 'passed') return `its ${label} record is '${st === '' ? 'unset' : st}', not passed — a gate that did not come out clean is never approved past`
  if (listItemCount(text, 'open_issues') > 0) return `its ${label} record still lists open issues — clear them (grovespec-fix), never approve past them`
  const ab = topValue(text, 'approved_by')
  if (ab === '') return `its ${label} record is legacy (no approved_by) — it binds nothing; re-run the gate to seal a fresh cycle`
  if (ab !== 'pending') return `its ${label} gate is already decided (approved_by: ${ab}) — a new decision needs a new cycle (grovespec-verify/-review, or reopen)`
  return null
}

// "Is this git path inside these project directories?" — the one predicate both the
// working-tree check and the history check ask. git speaks REPO-root relative paths; a
// project nested in a monorepo sees its own files behind that prefix, so comparing them
// to project-relative areas matched nothing — a dirty nested src/ read as clean and the
// machine gate passed over it. null when git cannot say where we are.
function pathsUnder (P, dirs) {
  const rel = p => p.startsWith(`${P.root}/`) ? p.slice(P.root.length + 1) : null
  const areas = dirs.map(rel).filter(x => x !== null)
  const pr = git(P.root, ['rev-parse', '--show-prefix'])
  if (!pr.ok) return null
  const pfx = pr.out.trim()                                // '' exactly at the toplevel
  return f => {
    if (!f.startsWith(pfx)) return false
    const g = f.slice(pfx.length)
    return areas.some(a => g === a || g.startsWith(`${a}/`))
  }
}

// null when git itself failed — "could not look" must not pass as "clean":
// this list is the machine result gate's clean-tree requirement.
function dirtyUnder (P) {
  const inCode = pathsUnder(P, [P.srcDir, P.testsDir])
  if (inCode === null) return null
  // -uall: by default porcelain FOLDS an untracked directory to one `?? dir/` line —
  // a wholly-untracked nested project collapsed to `?? inner/`, the prefix-stripped
  // remainder was '', and the machine gate read a never-committed tree as clean.
  const r = git(P.root, ['status', '--porcelain', '--untracked-files=all'])
  if (!r.ok) return null
  return r.out.split('\n').filter(Boolean).filter(l => porcelainPaths(l).some(inCode))
}

// Does a sealed commit still cover the code at HEAD? — null when it does, else the
// reason it does not (a fragment the caller prefixes with WHICH binding broke).
//
// A verdict is about the project's CODE, and this asks about the code — the same
// src/tests coordinates dirtyUnder asks the working tree about, so the two halves of one
// question ("is the tested code the current code?") measure the same paths.
//
// It used to compare commit IDS, and everything GroveSpec itself writes into the repo
// after a cycle passes broke the seal: the gate record, its round briefs and test log,
// the Change Log line, a runtime sync. That evidence belongs in history, so it gets
// committed — and the commit destroyed the very seal it was recording, leaving no path
// to `done` at all. Machine and human were refused alike, and the remedy the refusal
// named (re-run the gate) lands in the same state unless nothing whatever is committed
// between pin and approve — a window that, in the default flow, spans the human's look.
// Identity is still tried first, so the common case costs no git calls.
//
// What this deliberately does NOT catch is a non-code commit that changes what the
// recorded test run means — a dependency bump, a CI or build-config edit. The working
// tree check has the same bound, and widening only this half would make one question
// answer differently depending on whether the change happened to be committed yet.
//
// A seal that is a moving name ('HEAD', a branch, a short sha) can never equal the
// resolved HEAD, so it arrives here and is refused by name rather than by an id
// mismatch that happened to also be true.
function sealBreach (P, commit) {
  const oid = canonicalOidState(P.root, commit)
  if (oid === 'broken') return `${commit.slice(0, 7)} cannot be resolved (unknown commit, or git failed) — an unread check is not a passed one`
  if (oid === 'no') return `'${commit}' is not a canonical full commit id — a seal names immutable bytes, never a moving name (re-run the gate so pin seals a real commit)`
  const anc = ancestorState(P.root, commit)
  if (anc === 'broken') return `${commit.slice(0, 7)} cannot be checked (git merge-base failed) — an unread check is not a passed one`
  if (anc === 'no') return `${commit.slice(0, 7)} is not an ancestor of HEAD — a seal from another line of history binds nothing here`
  const inCode = pathsUnder(P, [P.srcDir, P.testsDir])
  if (inCode === null) return `whether the code moved since ${commit.slice(0, 7)} is unread (git rev-parse --show-prefix failed) — an unread check is not a passed one`
  const r = git(P.root, ['diff', '--name-only', `${commit}..HEAD`])
  if (!r.ok) return `whether the code moved since ${commit.slice(0, 7)} is unread (git diff failed) — an unread check is not a passed one`
  const moved = r.out.split('\n').filter(Boolean).filter(inCode)
  if (!moved.length) return null
  const shown = moved.slice(0, 5).join(', ')
  return `code moved since ${commit.slice(0, 7)}: ${shown}${moved.length > 5 ? ` (+${moved.length - 5} more)` : ''}`
}

function approveTree (P, human) {
  if (!human) {
    say('the tree gate is never machine-taken — look at the decomposition yourself, then: grovespec approve tree --human')
    return 2
  }
  const tp = P.treeYamlPath()
  const text = P.read(tp)
  if (text === null) { say(`no tree verify record (${tp} missing) — run grovespec-verify on the tree first`); return 2 }
  const err = recordUndecidable(P, tp, 'tree')
  if (err !== null) { say(`tree: ${err}`); return 2 }
  const sealed = topValue(text, 'tree_digest')
  if (sealed === '') { say('tree: record is unsealed (no tree_digest) — run grovespec pin tree at the cycle\'s pass'); return 2 }
  if (sealed !== treeDigest(P.treeText())) {
    say('tree: the structure changed after its cold verify — digest mismatch; re-run grovespec-verify on the tree (the reviewers did not see this shape)')
    return 2
  }
  writeAtomic(tp, upsertTop(text, 'approved_by', 'human'))
  P.forget()
  say('tree approved by you — the decomposition gate is open; the per-node build begins')
  return 0
}

export function cmdApprove (P, n, human) {
  if (n === '') { say('usage: grovespec approve TASK-N [--human] | approve tree --human'); return 2 }
  if (n === 'tree') return approveTree(P, human)

  const taskText = P.read(P.taskPath(n))
  if (taskText === null) { say(`no such node: ${n}`); return 2 }

  const st = P.statusOf(n)
  let record, target, label
  if (st === 'draft' || st === 'approved') { record = P.verifyYamlPath(n); target = 'approved'; label = 'spec' }
  else if (st === 'reviewed' || st === 'done') { record = P.reviewYamlPath(n); target = 'done'; label = 'result' }
  else {
    say(`${n}: no gate is due at status '${st}' — approve decides a sealed pass (draft → approved, reviewed → done)`)
    return 2
  }
  const repairing = st === target                          // interrupted earlier: task moved, record didn't

  // ---- every check, before any write ----
  const err = recordUndecidable(P, record, label)
  if (err !== null) { say(`${n}: ${err}`); return 2 }
  const text = P.read(record)

  const sealed = topValue(text, 'spec_digest')
  if (sealed === '') { say(`${n}: its ${label} record is unsealed (no spec_digest) — run grovespec pin ${n} at the cycle's pass`); return 2 }
  const cur = specDigest(taskText)
  if (cur === null) { say(`${n}: cannot digest — Overview…AC sections malformed (run grovespec validate)`); return 2 }
  if (sealed !== cur) {
    say(`${n}: the spec changed after its ${label} cycle passed — digest mismatch; the verdict does not cover these bytes (re-run the gate; grovespec-revise if the change was deliberate)`)
    return 2
  }

  if (label === 'result') {
    const rs = repoState(P.root)
    if (rs === 'broken') { say(`${n}: git did not answer (missing or failing git) — a result approval binds to history that cannot be read right now`); return 2 }
    if (rs === 'none') { say(`${n}: not a git repository — a result approval is bound to the reviewed commit`); return 2 }
    // Checked here too, not only at the seal: a record pinned before this check existed
    // already carries the foreign commit, and comparing it to that same foreign HEAD is
    // the free pass this refuses.
    const ig = ignoredState(P.root)
    if (ig === 'broken') { say(`${n}: git check-ignore did not answer — whether this project is gateable cannot be established, so nothing was approved`); return 2 }
    if (ig === 'yes') { say(`${n}: this project sits inside a git repository that ignores it — the reviewed commit names a history no change to this code can move, so matching it proves nothing. Give the project its own repository (git init) and re-run the gate`); return 2 }
    const head = git(P.root, ['rev-parse', 'HEAD'])
    if (!head.ok) { say(`${n}: cannot resolve HEAD`); return 2 }
    const rc = topValue(text, 'reviewed_commit')
    if (rc === '') { say(`${n}: its result record is unsealed (no reviewed_commit) — run grovespec pin ${n} at the cycle's pass`); return 2 }
    if (rc !== head.out.trim()) {
      const breach = sealBreach(P, rc)
      if (breach !== null) { say(`${n}: the review verdict no longer covers HEAD — ${breach}; re-run grovespec-review`); return 2 }
    }
    if (!human) {
      // The machine may only take a gate on machine-verifiable evidence: a recorded
      // test run, green, bound to exactly the code being approved.
      const lt = lastTest(text)
      if (lt === null) { say(`${n}: no recorded test run — run grovespec test ${n}; a machine approves only on machine evidence (a human may confirm on judgment: --human)`); return 2 }
      if (lt.exit !== '0') { say(`${n}: the recorded test run did not pass (exit ${lt.exit ?? 'unknown'}) — fix and re-run grovespec test ${n}`); return 2 }
      if (!lt.commit) { say(`${n}: the recorded test run is not bound to a commit (legacy record) — re-run grovespec test ${n}`); return 2 }
      if (lt.commit !== head.out.trim()) {
        const breach = sealBreach(P, lt.commit)
        if (breach !== null) { say(`${n}: the recorded test run no longer covers HEAD — ${breach}; re-run grovespec test ${n}`); return 2 }
      }
      const dirty = dirtyUnder(P)
      if (dirty === null) { say(`${n}: cannot verify the tree is clean (git status failed) — an unverified tree is not a clean one`); return 2 }
      if (dirty.length) {
        say(`${n}: uncommitted changes under src/tests — the tested code is not the current code:`)
        for (const d of dirty) say(`  ${d}`)
        return 2
      }
    }
  }

  // ---- writes: task first, record second (approve re-run completes an interruption) ----
  if (!repairing) {
    const flipped = setFmValue(taskText, 'status', target)
    if (flipped === null) { say(`${n}: cannot set status — frontmatter malformed (run grovespec validate)`); return 2 }
    writeAtomic(P.taskPath(n), flipped)
  }
  writeAtomic(record, upsertTop(text, 'approved_by', human ? 'human' : 'machine'))
  P.forget()

  if (human) say(`approved by you: ${n} ${repairing ? `(finishing an interrupted approval at ${st})` : `${st} → ${target}`} (${label} gate)`)
  else say(`approved by machine: ${n} ${repairing ? `(finishing an interrupted approval at ${st})` : `${st} → ${target}`} (${label} gate) — NOT human-approved; ratify it when you have looked`)
  return 0
}

export function cmdRatify (P, ids) {
  if (!ids.length) { say('usage: grovespec ratify TASK-N [TASK-M ...]'); return 2 }
  const work = []
  for (const n of ids) {
    if (P.read(P.taskPath(n)) === null) { say(`no such node: ${n} — nothing was ratified`); return 2 }
    const labels = P.unratified(n)
    if (!labels.length) { say(`${n}: nothing to ratify (no machine-taken gate on record) — nothing was ratified`); return 2 }
    work.push([n, labels])
  }
  for (const [n, labels] of work) {
    for (const label of labels) {
      const p = label === 'spec' ? P.verifyYamlPath(n) : P.reviewYamlPath(n)
      writeAtomic(p, upsertTop(P.read(p), 'approved_by', 'human'))
    }
    say(`ratified: ${n} (${labels.join(' · ')})`)
  }
  P.forget()
  return 0
}
