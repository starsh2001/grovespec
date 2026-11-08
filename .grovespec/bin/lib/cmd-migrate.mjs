// migrate — move a project's records to the shape a newer runtime reads. One named
// migration per change of shape, each run once and committed apart from any step.
//
//   migrate changelog   (v0.28.0) every Task's `## Change Log` entries move to a file of
//                       their own, <paths.tasks>/changelog/TASK-N.md; the section keeps
//                       one link line. Every step and every cold reviewer reads the Task
//                       whole, and the history had grown to 35-60% of it.
//
// The one reader the anchors use (source-evidence changeLogOf) decides everything: which
// lines are link lines, what the entries are, and the order the two places read in — a
// section with no link is the older history and goes first, whatever a step already wrote
// to the file follows; a section that links its file has moved, and an entry left beside
// the link goes at the file's end. The move takes out exactly the reader's link lines and
// keeps every other line: a section with entries moves verbatim into the file; one the
// reader sees nothing in (an old template comment) keeps its lines where they are and
// gains the link. Before anything is written each node's move is proved twice over —
// read back, its Change Log is exactly those blocks in that order (so a sealed
// `Change Log:n` names the same block, with the same text), and every non-blank line of
// the old section and of the old file is still there, in order. One node that fails stops
// the whole run before a byte is written. (Three external review rounds found the move
// dropping history: fenced history, decided by a second reader; quoted and indented
// examples, decided after flattening; a comment after the link, decided on the
// comment-blanked line. A proof over the reader's own output passed the second, and one
// trusting the reader's link decision passed the third — so the line-level half decides
// for itself which lines may go.)
import { mkdirSync } from 'node:fs'
import { topValue } from './core.mjs'
import { writeAtomic } from './project.mjs'
import { git, porcelainPaths, repoState, showPrefix, gitFailure } from './git.mjs'
import { stepMark } from './cmd-claim.mjs'
import { LINK_LINE, SourceEvidenceError, changeLogOf } from './source-evidence.mjs'

const say = s => process.stdout.write(s + '\n')

export function cmdMigrate (P, what) {
  if (what !== 'changelog') { say('usage: grovespec migrate changelog'); return 2 }

  // Between steps only: a step mid-way may be writing these very files.
  const mark = stepMark(P.root)
  if (mark !== null) {
    say(`a step is running in this checkout (${mark.step} ${mark.node}, since ${mark.since}) — migrate between steps; nothing was moved`)
    return 2
  }
  // A seal awaiting its decision binds files this move rewrites: another node's Task is
  // part of a result seal's project input, and a sketch's whole text is tree evidence.
  const pending = P.reviewFiles().filter(f => {
    const t = P.read(f) ?? ''
    return topValue(t, 'status') === 'passed' && topValue(t, 'approved_by') === 'pending'
  })
  if (pending.length) {
    say(`a sealed gate awaits its decision (${pending.map(f => f.slice(f.lastIndexOf('/') + 1)).join(', ')}) — moving the Change Logs now would change what that seal covers; decide it first (approve), then migrate; nothing was moved`)
    return 2
  }
  // The move is one commit of its own; mixed into uncommitted Task edits it is not.
  const rs = repoState(P.root)
  if (rs === 'broken') { say(`git did not answer (${gitFailure()}) — nothing was moved`); return 2 }
  if (rs === 'repo') {
    const prefix = showPrefix(P.root)
    const st = git(P.root, ['status', '--porcelain', '--untracked-files=all'])
    if (prefix === null || !st.ok) { say('git status failed — whether the Task files are clean is unread; nothing was moved'); return 2 }
    const under = `${prefix}${P.tasksDir.slice(P.root.length + 1)}/`
    const dirty = st.out.split('\n').filter(Boolean).filter(l => porcelainPaths(l).some(p => p.startsWith(under)))
    if (dirty.length) {
      say(`uncommitted changes under ${P.tasksDir}/ — commit or set them aside first, so the move is a commit of its own; nothing was moved:`)
      for (const l of dirty.slice(0, 10)) say(`  ${l}`)
      return 2
    }
  }

  const writes = []
  const moved = []
  const linkedOnly = []
  const refused = []
  for (const f of P.taskFiles()) {
    const tid = P.tidOf(f)
    const text = P.read(f) ?? ''
    const logPath = P.changelogPath(tid)
    const logText = P.read(logPath)
    let before
    try { before = changeLogOf(text, f, logText, logPath) } catch (e) {
      if (!(e instanceof SourceEvidenceError)) throw e
      refused.push(`${tid}: its Change Log cannot be read (${e.message})`)
      continue
    }
    if (before.body === null) { refused.push(`${tid}: no '## Change Log' heading the move can find`); continue }
    if (before.links.length === 1 && before.links[0] === tid && before.entries.length === 0) continue   // already moved
    const out = splitOut(text, tid, logText, before)
    const want = before.linked ? before.filed.concat(before.entries) : before.entries.concat(before.filed)
    if (!proved(out, f, logText, logPath, tid, want, before.oldSection)) {
      refused.push(`${tid}: read back after the move, its Change Log would not be the same entries in the same order with every line kept`)
      continue
    }
    writes.push({ f, tid, ...out })
    const n = want.length - before.filed.length
    if (n) moved.push(`${tid} (${n})`)
    else linkedOnly.push(tid)
  }
  if (refused.length) {
    say('the move would not keep every entry where its anchors read it — nothing was moved; fix these by hand (move each entry into the file, keep the order), then re-run:')
    for (const r of refused) say(`  ${r}`)
    return 2
  }
  if (!writes.length) {
    say(`nothing to move — every Task's Change Log is already in its own file under ${P.changelogDir()}/, each section a link to it`)
    return 0
  }

  mkdirSync(P.changelogDir(), { recursive: true })
  for (const w of writes) {
    if (w.log !== null) writeAtomic(P.changelogPath(w.tid), w.log)
    writeAtomic(w.f, w.task)
  }
  P.forget()
  if (moved.length) {
    say(`moved the Change Log of ${moved.length} node(s) into ${P.changelogDir()}/ — each Task keeps one link line in its place (the count is blocks, as the anchors number them):`)
    say(`  ${moved.join(' · ')}`)
  }
  if (linkedOnly.length) say(`linked ${linkedOnly.length} Task(s) whose section held no entries to their file (written by a later entry, or already there): ${linkedOnly.join(' · ')}`)
  say(`commit them as one change, apart from any step: migrate: Change Log moved to ${P.changelogDir().slice(P.root.length + 1)}/ (GroveSpec v0.28.0)`)
  return 0
}

const nonBlank = lines => lines.map(l => l.replace(/\r$/, '')).filter(l => l.trim() !== '')
const keeps = (wanted, got) => {           // every line of `wanted`, in order, inside `got`
  let at = 0
  for (const line of got) if (at < wanted.length && line === wanted[at]) at++
  return at === wanted.length
}

// The move's own proof, over what would be written: the reader's blocks are exactly
// `want` with the section left as one correct link, and no line of the old section or the
// old file went missing. Which lines may go is decided here again, on the raw text alone —
// a line exactly the link shape, nothing else — never by asking the reader that chose
// them: a proof that trusted the reader's link decision passed a comment the reader had
// blanked and the move had dropped (external review r3, P0).
function proved (out, f, logText, logPath, tid, want, oldSection) {
  let after
  try { after = changeLogOf(out.task, f, out.log ?? logText, logPath) } catch (e) {
    if (!(e instanceof SourceEvidenceError)) throw e
    return false
  }
  if (after.body === null || after.entries.length !== 0 || after.links.length !== 1 || after.links[0] !== tid) return false
  if (JSON.stringify(after.resolved) !== JSON.stringify(want)) return false
  const mayGo = line => LINK_LINE.test(line.replace(/\r$/, ''))
  const sectionNow = out.task.split('\n').slice(after.body.start, after.body.end).filter(line => !mayGo(line))
  const fileNow = out.log ?? logText
  const fileLines = fileNow === null ? [] : nonBlank(fileBody(fileNow))
  return keeps(nonBlank(oldSection).filter(line => !mayGo(line)), nonBlank(sectionNow).concat(fileLines)) &&
    keeps(logText === null ? [] : nonBlank(fileBody(logText)), fileLines)
}

// The section's raw lines without the reader's link lines — every other line kept — and
// the file's body under its title, joined in the reader's order; the section keeps its
// heading and the link line. Line endings follow the Task file's own. A section the reader
// sees no entries in keeps its lines (an old template comment) in place, link appended,
// and the file is left as it is — log: null = do not write it.
function splitOut (text, tid, logText, before) {
  const crlf = text.includes('\r\n')
  const eol = crlf ? '\r\n' : '\n'
  const cr = crlf ? '\r' : ''
  const raw = text.split('\n')
  const { start, end } = before.body
  const link = `- [changelog/${tid}.md](changelog/${tid}.md)${cr}`
  const rest = []
  for (let i = start; i < end; i++) if (!before.linkAt.includes(i)) rest.push(raw[i].replace(/\r$/, ''))
  before.oldSection = raw.slice(start, end)
  // The reader's lines stop before a final newline, the raw split does not: the section
  // runs to the file's end when nothing but that newline follows it.
  const atEnd = raw.slice(end).every(l => l.replace(/\r$/, '') === '')
  const tail = atEnd ? [''] : [cr, ...raw.slice(end)]
  if (!before.entries.length) {
    const stay = trim(rest).map(l => l + cr)
    return { log: null, task: [...raw.slice(0, start), ...stay, link, ...tail].join('\n') }
  }
  const section = trim(rest)
  const filed = logText === null ? [] : trim(fileBody(logText))
  const parts = (before.linked ? [filed, section] : [section, filed]).filter(p => p.length)
  // Two lists simply continue; anything else gets a blank line between, so no block runs
  // into the next (a paragraph line after an item would read as that item's continuation).
  const item = l => /^[ \t]*(?:[-+*]|\d+[.)])[ \t]/.test(l ?? '')
  const joined = parts.flatMap((p, i) => i && !(item(parts[i - 1].at(-1)) && item(p[0])) ? ['', ...p] : p)
  return {
    log: `# ${tid} · Change Log${eol}${eol}${joined.join(eol)}${eol}`,
    task: [...raw.slice(0, start), link, ...tail].join('\n')
  }
}

// A Change Log file's body: everything under its `# TASK-N · Change Log` title.
function fileBody (text) {
  const lines = text.replace(/^﻿/, '').split('\n').map(l => l.replace(/\r$/, ''))
  const first = lines.findIndex(l => l.trim() !== '')
  if (first !== -1 && /^#[ \t]/.test(lines[first])) lines.splice(0, first + 1)
  return lines
}

function trim (lines) {
  const out = [...lines]
  while (out.length && out[0].trim() === '') out.shift()
  while (out.length && out[out.length - 1].trim() === '') out.pop()
  return out
}
