// Source evidence packet -- the machine-readable hand-off between a draft's
// original ref clauses and its cold C1/C3 reviewers.  The packet deliberately
// lives in a round brief rather than review-state YAML: the YAML stays the small
// resumable ledger, while pin re-opens this full evidence and proves it still
// describes the current Task, current ref bytes, and current ref/index.md roster.
import { createHash } from 'node:crypto'
import { isAbsolute, relative } from 'node:path'
import { realpathSync, readdirSync, statSync } from 'node:fs'
import {
  fmValue, frontmatterBoundaryProblem, frontmatterLines, itemValue, listItems,
  markdownStructureLines, specSpanText, splitLines, topValue
} from './core.mjs'

export const SOURCE_PROTOCOL = 'grovespec-source-evidence/v1'
export const SOURCE_SCHEMA = 1
const SOURCE_CLAUSE_PROTOCOL = 'grovespec-source-clause/v2'
const SOURCE_ROSTER_PROTOCOL = 'grovespec-source-roster/v2'
const SOURCE_SEAL_PROTOCOL = 'grovespec-source-evidence-seal/v1'
const SOURCE_SCOPE_PROTOCOL = 'grovespec-source-scope/v1'

const TOP_FIELDS = ['protocol', 'schema', 'target', 'spec_digest', 'scope', 'source_digest', 'clauses']
const SCOPE_FIELDS = ['file', 'location']
const CLAUSE_FIELDS = ['id', 'source', 'heading', 'text', 'c1', 'c1_case', 'c1_basis', 'c3', 'c3_basis']
const C1 = new Set(['carried', 'deferred', 'divergence', 'excluded', 'missing', 'UNSET'])
const C3 = new Set(['handled', 'deferred', 'divergence', 'excluded', 'not-edge', 'missing', 'UNSET'])
const sha256 = s => createHash('sha256').update(s, 'utf8').digest('hex')

export class SourceEvidenceError extends Error {}

const fail = message => { throw new SourceEvidenceError(message) }
const nfc = s => s.normalize('NFC')
const oneSpace = s => nfc(s).replace(/\s+/gu, ' ').trim()

export function specDigest (taskText) {
  const span = specSpanText(taskText)
  return span === null ? null : sha256(span)
}

function exactKeys (value, fields, at) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${at} must be an object`)
  const got = Object.keys(value).sort()
  const want = [...fields].sort()
  const missing = want.filter(k => !got.includes(k))
  const extra = got.filter(k => !want.includes(k))
  if (missing.length || extra.length) {
    fail(`${at} fields differ -- missing [${missing.join(', ')}], unknown [${extra.join(', ')}]`)
  }
}

function normalizeRefFile (raw, at = 'source file') {
  if (typeof raw !== 'string' || raw === '') fail(`${at} must be a non-empty relative path`)
  const file = nfc(raw.replace(/\\/g, '/'))
  if (/[\u0000-\u001f\u007f]/.test(file) || /^[A-Za-z]:/.test(file) || file.startsWith('/') || isAbsolute(file)) {
    fail(`${at} '${raw}' must be relative to paths.ref`)
  }
  const segments = file.split('/')
  if (segments.some(s => s === '' || s === '.' || s === '..')) {
    fail(`${at} '${raw}' contains an empty/current/traversal segment`)
  }
  if (file === 'index.md') fail(`${at} 'index.md' is the live catalog, not a frozen source record`)
  return file
}

function exactChildPath (P, file) {
  let rootReal, projectReal
  try {
    rootReal = realpathSync(P.refDir)
    projectReal = realpathSync(P.root)
  } catch { fail(`cannot resolve configured paths.ref while resolving '${file}'`) }
  const isWithin = (root, child, allowSame = false) => {
    const r = relative(root, child)
    return (allowSame && r === '') || (r !== '' && !isAbsolute(r) && r !== '..' && !r.startsWith('../') && !r.startsWith('..\\'))
  }
  if (!isWithin(projectReal, rootReal)) fail(`configured paths.ref resolves outside the project`)
  let dir = P.refDir
  for (const segment of file.split('/')) {
    let names
    try { names = readdirSync(dir) } catch { fail(`cannot read ref directory while resolving '${file}'`) }
    if (!names.includes(segment)) fail(`ref source '${file}' does not exist with that exact spelling`)
    dir = `${dir}/${segment}`
    let stepReal
    try { stepReal = realpathSync(dir) } catch { fail(`cannot resolve ref source '${file}'`) }
    if (!isWithin(rootReal, stepReal)) fail(`ref source '${file}' resolves outside paths.ref`)
  }
  let fileReal
  try {
    fileReal = realpathSync(dir)
  } catch { fail(`cannot resolve ref source '${file}'`) }
  if (!isWithin(rootReal, fileReal)) {
    fail(`ref source '${file}' resolves outside paths.ref or to paths.ref itself`)
  }
  try {
    if (!statSync(fileReal).isFile()) fail(`ref source '${file}' is not a file`)
  } catch (e) {
    if (e instanceof SourceEvidenceError) throw e
    fail(`cannot stat ref source '${file}'`)
  }
  return dir.replace(/\\/g, '/')
}

function parseLocation (raw, at = 'source location') {
  if (typeof raw !== 'string') fail(`${at} must be a numbered Markdown heading`)
  const v = nfc(raw.trim()).replace(/^\u00a7/, '')
  if (!/^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))*$/.test(v) ||
      v.split('.').some(part => !Number.isSafeInteger(Number(part)))) {
    fail(`${at} '${raw}' must be canonical numeric segments (for example 4 or 5.4)`)
  }
  const depth = v.split('.').length + 1
  if (depth > 6) fail(`${at} '${raw}' is deeper than Markdown's six heading levels`)
  return { number: v, location: `\u00a7${v}`, depth }
}

function parseScopeToken (raw) {
  if (typeof raw !== 'string') fail('source coordinates must be strings')
  const at = raw.lastIndexOf('@')
  if (at <= 0 || at === raw.length - 1) fail(`source coordinate '${raw}' must be file.md@4 (or a dotted heading such as @5.4)`)
  return { file: normalizeRefFile(raw.slice(0, at)), ...parseLocation(raw.slice(at + 1)) }
}

const scopeToken = s => `${s.file}@${s.number}`

function scopeSort (a, b) {
  const f = a.file === b.file ? 0 : (a.file < b.file ? -1 : 1)
  if (f !== 0) return f
  const aa = a.number.split('.').map(Number); const bb = b.number.split('.').map(Number)
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    if (aa[i] === undefined) return -1
    if (bb[i] === undefined) return 1
    if (aa[i] !== bb[i]) return aa[i] - bb[i]
  }
  return 0
}

export function normalizeScopeArgs (args, { allowEmpty = false } = {}) {
  if (!Array.isArray(args) || (!allowEmpty && args.length === 0)) fail('at least one current ref coordinate is required')
  const parsed = args.map(parseScopeToken).sort(scopeSort)
  const seen = new Set()
  for (let i = 0; i < parsed.length; i++) {
    const s = parsed[i]
    const key = `${s.file}@${s.location}`
    if (seen.has(key)) fail(`duplicate source coordinate '${key}'`)
    seen.add(key)
    for (let j = 0; j < i; j++) {
      const prior = parsed[j]
      if (prior.file === s.file && (s.location.startsWith(`${prior.location}.`) || prior.location.startsWith(`${s.location}.`))) {
        fail(`overlapping source coordinates '${prior.file}@${prior.location}' and '${s.file}@${s.location}'`)
      }
    }
  }
  return parsed
}

function refsField (taskText, at) {
  const boundary = frontmatterBoundaryProblem(taskText)
  if (boundary !== null) fail(`${at}: ${boundary}`)
  const lines = frontmatterLines(taskText)
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    if (/^refs[ \t]*:/.test(lines[i])) hits.push({ line: lines[i], n: i + 2 })
  }
  if (!hits.length) return { present: false, scope: null }
  if (hits.length !== 1) fail(`${at}: frontmatter 'refs' appears ${hits.length} times`)
  const hit = hits[0]
  const m = hit.line.match(/^refs: (\[.*\])$/)
  if (!m) fail(`${at}:${hit.n}: refs must be the canonical flow list 'refs: []' or 'refs: [spec.md@4, spec.md@5.4]'`)
  const raw = m[1]
  if (raw === '[]') return { present: true, mode: 'explicit', scope: [] }
  const body = raw.slice(1, -1)
  if (body === '' || body.split(', ').some(token => token === '')) {
    fail(`${at}:${hit.n}: refs must be the canonical flow list 'refs: []' or 'refs: [spec.md@4, spec.md@5.4]'`)
  }
  const tokens = body.split(', ')
  if (tokens.some(token => !/^[^\s,@\[\]]+@(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))*$/u.test(token))) {
    fail(`${at}:${hit.n}: refs contains a non-canonical coordinate token — use file.md@4 (no quotes, \u00a7, or token whitespace)`)
  }
  let scope
  try { scope = normalizeScopeArgs(tokens) } catch (e) {
    if (e instanceof SourceEvidenceError) fail(`${at}:${hit.n}: invalid refs — ${e.message}`)
    throw e
  }
  const canonical = `[${scope.map(scopeToken).join(', ')}]`
  if (raw !== canonical || tokens.some((token, i) => token !== scopeToken(scope[i]))) {
    fail(`${at}:${hit.n}: refs is not canonical — write refs: ${canonical}`)
  }
  return { present: true, mode: 'explicit', scope }
}

// Validate only the optional field's syntax.  Legacy assignment derivation is a gate
// concern and is intentionally not forced onto every pre-protocol Task by `validate`.
export function validateTaskRefsSyntax (taskText, at) {
  refsField(taskText, at)
}

function markdownCells (line) {
  const t = line.trim()
  if (!t.startsWith('|') || !t.endsWith('|')) return null
  const cells = []
  let cell = ''
  let escaped = false
  for (const c of t.slice(1, -1)) {
    if (escaped) { cell += c; escaped = false; continue }
    if (c === '\\') { cell += c; escaped = true; continue }
    if (c === '|') { cells.push(cell.trim()); cell = ''; continue }
    cell += c
  }
  cells.push(cell.trim())
  return cells
}

function unquoteCell (value) {
  const v = nfc(value.trim())
  return v.length >= 2 && v.startsWith('`') && v.endsWith('`') ? v.slice(1, -1) : v
}

function currentIndexRows (P) {
  // The catalog is metadata rather than a selectable source, but it obeys the same
  // realpath containment rule; a symlinked index outside ref cannot authorize reads.
  const indexPath = exactChildPath(P, 'index.md')
  const text = P.read(indexPath)
  if (text === null) fail(`ref catalog missing: ${indexPath}`)
  // A catalog table is authoritative only when it is visible Markdown.  Keep
  // physical line positions so the separator/rows must still be contiguous,
  // but exclude exact-looking tables hidden in comments or fenced examples.
  const lines = visibleMarkdownLines(text, indexPath)
  const headers = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].headingEligible || lines[i].fenced) continue
    const cells = markdownCells(lines[i].line)
    if (cells && cells.length === 3 && cells.map(unquoteCell).join('\0') === 'Topic\0File\0Location') {
      headers.push(i)
    }
  }
  if (headers.length === 0) fail(`${indexPath} has no exact Topic | File | Location table`)
  if (headers.length !== 1) {
    fail(`${indexPath} must contain exactly one visible Topic | File | Location table (found ${headers.length})`)
  }
  const header = headers[0]
  const separatorEntry = lines[header + 1]
  const separator = separatorEntry?.headingEligible && !separatorEntry.fenced
    ? markdownCells(separatorEntry.line)
    : null
  if (!separator || separator.length !== 3 || separator.some(c => !/^:?-{3,}:?$/.test(c.trim()))) {
    fail(`${indexPath} has a malformed Topic | File | Location table separator`)
  }
  const rows = []
  for (let i = header + 2; i < lines.length; i++) {
    const entry = lines[i]
    if (!entry.headingEligible || entry.fenced || entry.line.trim() === '') break
    const cells = markdownCells(entry.line)
    if (!cells) break
    if (cells.length !== 3) fail(`${indexPath}:${entry.n} must have exactly Topic | File | Location`)
    const [topicRaw, fileRaw, locationRaw] = cells.map(unquoteCell)
    if (!topicRaw || !fileRaw || !locationRaw) fail(`${indexPath}:${entry.n} has an empty catalog cell`)
    // An unsafe/malformed File cell is a catalog defect, not a legacy row: never
    // silently discard a path that might otherwise look like authority.  Only a
    // non-numeric legacy Location is ineligible to prove this numeric protocol's
    // currentness and may therefore be skipped.
    const file = normalizeRefFile(fileRaw, `${indexPath}:${entry.n} File`)
    let location
    try { location = parseLocation(locationRaw, `${indexPath}:${entry.n} Location`).location } catch (e) {
      // Clearly prose-like legacy locations ("Commands / Today") predate numeric
      // coordinates and cannot authorize one, so they are skipped.  Anything beginning
      // like this protocol's syntax is a broken authority row and must fail closed:
      // `§five`, `§ 5`, `5.04`, and `5x` never disappear as if they were unrelated.
      if (e instanceof SourceEvidenceError && !/^(?:\u00a7|[0-9])/u.test(nfc(locationRaw.trim()))) continue
      throw e
    }
    rows.push({ topic: oneSpace(topicRaw), file, location })
  }
  return rows
}

function canonicalCurrentIndexRoster (P) {
  const rows = currentIndexRows(P)
  const seen = new Set()
  for (const row of rows) {
    const key = `${row.file}@${row.location}`
    if (seen.has(key)) fail(`ref catalog has duplicate current coordinate '${key}' -- the source roster is ambiguous`)
    seen.add(key)
  }
  return rows.sort((a, b) => {
    const byScope = scopeSort(
      { file: a.file, number: a.location.slice(1) },
      { file: b.file, number: b.location.slice(1) }
    )
    return byScope || (a.topic === b.topic ? 0 : (a.topic < b.topic ? -1 : 1))
  })
}

function assertCurrentScope (P, scope, currentRows = canonicalCurrentIndexRoster(P)) {
  const current = new Map()
  for (const row of currentRows) {
    const key = `${row.file}@${row.location}`
    current.set(key, row)
  }
  for (const s of scope) {
    const key = `${s.file}@${s.location}`
    // An index topic may deliberately point at a containing section (`§5`) while a
    // Task covers one exact child heading (`§5.4`).  Dot-boundary ancestry is current;
    // textual prefixing is not (`§5` never admits `§50`).  When several catalog rows
    // are ancestors, the most-specific one is authoritative.
    const matches = [...current.values()].filter(r => r.file === s.file &&
      (r.location === s.location || s.location.startsWith(`${r.location}.`)))
    if (!matches.length) fail(`source coordinate '${key}' is not at or below a current row in ${P.refIndexPath()}`)
    const max = Math.max(...matches.map(r => r.location.length))
    const best = matches.filter(r => r.location.length === max)
    if (best.length !== 1) fail(`source coordinate '${key}' has an ambiguous most-specific current row in ${P.refIndexPath()}`)
  }
}

function headingOf (line) {
  const m = nfc(line).match(/^(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/)
  if (!m) return null
  let title = (m[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '').trim()
  title = oneSpace(title)
  return title === '' ? null : { depth: m[1].length, title }
}

function numberedHeadingMatches (heading, scope) {
  if (heading.depth !== scope.depth) return false
  let title = heading.title
  if (title.startsWith('\u00a7')) title = title.slice(1).trimStart()
  if (!title.startsWith(scope.number)) return false
  const rest = title.slice(scope.number.length)
  return rest === '' || /^[ \t]/.test(rest) || /^[.:\uff1a](?:[ \t]|$)/.test(rest) || /^[\u2013\u2014-](?:[ \t]|$)/.test(rest)
}

// Heading discovery and clause extraction share this one scanner. HTML comments are
// non-authoritative; fenced bodies remain literal source clauses/digest material, while
// heading-looking lines inside them can never select or terminate a section.
export function visibleMarkdownLines (text, at) {
  const normalized = splitLines(text).map(nfc).join('\n')
  const scanned = markdownStructureLines(normalized)
  if (scanned.problem !== null) fail(`${at}: ${scanned.problem}`)
  return scanned.lines
}

function sectionEntries (text, scope, file) {
  const lines = visibleMarkdownLines(text, file)
  const starts = []
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].headingEligible ? headingOf(lines[i].line) : null
    if (h && numberedHeadingMatches(h, scope)) starts.push(i)
  }
  if (starts.length === 0) fail(`${file}@${scope.location}: no exact ${'#'.repeat(scope.depth)} numbered heading`)
  if (starts.length > 1) fail(`${file}@${scope.location}: numbered heading is duplicated`)
  const start = starts[0]
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const h = lines[i].headingEligible ? headingOf(lines[i].line) : null
    if (h && h.depth <= scope.depth) { end = i; break }
  }
  return { selected: headingOf(lines[start].line), entries: lines.slice(start + 1, end) }
}

function logicalBlocks (sourceLines, initialHeading = '') {
  const blocks = []
  let paragraph = []
  let paragraphHeading = initialHeading
  let paragraphFenced = false
  let heading = initialHeading
  const flush = () => {
    const text = oneSpace(paragraph.join(' '))
    if (text !== '') blocks.push({ heading: paragraphHeading, text, fenced: paragraphFenced })
    paragraph = []
    paragraphFenced = false
  }
  for (const entry of sourceLines) {
    let raw = typeof entry === 'string' ? entry : entry.line
    const h = typeof entry === 'string' || entry.headingEligible ? headingOf(raw) : null
    if (h) {
      flush()
      heading = h.title
      continue
    }
    const trimmed = raw.trim()
    if (trimmed === '') { flush(); continue }
    if (typeof entry !== 'string' && entry.fenced) {
      if (paragraph.length && !paragraphFenced) flush()
      if (!paragraph.length) { paragraphHeading = heading; paragraphFenced = true }
      paragraph.push(raw)
      continue
    }
    raw = raw.replace(/^[ \t]*>[ \t]?/, '')
    const list = raw.match(/^[ \t]*(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?(.*)$/)
    if (list) { flush(); paragraphHeading = heading; paragraphFenced = false; paragraph = [list[1]]; continue }
    if (/^\|.*\|[ \t]*$/.test(raw)) {
      flush()
      const cells = markdownCells(raw)
      if (cells && cells.every(c => /^:?-{3,}:?$/.test(c))) continue // table syntax is not a source clause
      blocks.push({ heading, text: cells ? cells.map(oneSpace).join(' | ') : oneSpace(raw), fenced: false })
      continue
    }
    if (!paragraph.length) { paragraphHeading = heading; paragraphFenced = false }
    paragraph.push(raw)
  }
  flush()
  return blocks
}

function sentenceClauses (block) {
  const out = []
  let start = 0
  for (let i = 0; i < block.length; i++) {
    if (!/[.!?\u3002\uff01\uff1f]/u.test(block[i])) continue
    let end = i + 1
    while (end < block.length && /[.!?\u3002\uff01\uff1f]/u.test(block[end])) end++
    if (end === block.length || /\s/u.test(block[end])) {
      const clause = oneSpace(block.slice(start, end))
      if (clause) out.push(clause)
      while (end < block.length && /\s/u.test(block[end])) end++
      start = end
      i = end - 1
    }
  }
  const tail = oneSpace(block.slice(start))
  if (tail) out.push(tail)
  return out
}

function materialForSection (P, scope) {
  const path = exactChildPath(P, scope.file)
  const text = P.read(path)
  if (text === null) fail(`cannot read ref source '${scope.file}'`)
  const { selected, entries } = sectionEntries(text, scope, scope.file)
  const stack = [{ depth: selected.depth, title: selected.title }]
  const headings = [{ depth: selected.depth, title: selected.title, path: selected.title }]
  const annotated = []
  for (const entry of entries) {
    const h = entry.headingEligible ? headingOf(entry.line) : null
    if (h) {
      while (stack.length && stack[stack.length - 1].depth >= h.depth) stack.pop()
      stack.push({ depth: h.depth, title: h.title })
      const path = stack.map(x => x.title).join(' > ')
      headings.push({ depth: h.depth, title: h.title, path })
      annotated.push({ ...entry, heading: path })
    } else {
      annotated.push({ ...entry, heading: stack.map(x => x.title).join(' > ') })
    }
  }
  const candidates = logicalBlocks(annotated, selected.title).flatMap(block =>
    sentenceClauses(block.text).map(text => ({
      heading: block.heading,
      text,
      fenced: block.fenced,
      excluded: !block.fenced && /^\(gap\)(?:\s|$)/iu.test(text)
    })))
  if (!candidates.length) fail(`${scope.file}@${scope.location}: selected source has no logical clause candidates`)
  const clauses = []
  for (const candidate of candidates) {
    if (candidate.excluded) continue
    const ordinal = clauses.length + 1
    const source = `${scope.file}@${scope.location}:${ordinal}`
    // Stable identity preimage (tests and other hosts may implement this verbatim):
    // grovespec-source-clause/v2 NUL file NUL canonical-location NUL ordinal
    // NUL canonical-heading-path NUL canonical-text
    const id = 'SC-' + sha256(`${SOURCE_CLAUSE_PROTOCOL}\0${scope.file}\0${scope.location}\0${ordinal}\0${candidate.heading}\0${candidate.text}`).slice(0, 24)
    clauses.push({ id, source, heading: candidate.heading, text: candidate.text, c1: 'UNSET', c1_case: 'UNSET', c1_basis: 'UNSET', c3: 'UNSET', c3_basis: 'UNSET' })
  }
  const fences = entries.filter(entry => entry.fenceBoundary)
    .map(entry => ({ kind: entry.fenceBoundary, text: entry.fenceText }))
  return { headings, fences, candidates, clauses }
}

function legacyCitations (taskText, at) {
  const unique = new Set()
  for (const { line, n, fenced } of visibleMarkdownLines(taskText, at)) {
    if (fenced) continue
    const mentions = []
    const mentionRe = /ref\/([^\s<>()\[\]{}"'`]+)/gu
    for (const m of line.matchAll(mentionRe)) {
      const before = m.index === 0 ? '' : line[m.index - 1]
      if (before !== '' && /[\p{L}\p{N}._/-]/u.test(before)) continue
      mentions.push({ start: m.index, end: m.index + m[0].length, file: m[1] })
    }
    for (let i = 0; i < mentions.length; i++) {
      const mention = mentions[i]
      const segment = line.slice(mention.end, mentions[i + 1]?.start ?? line.length)
      let cursor = segment.match(/^[ \t]*/u)[0].length
      // Legacy recovery recognizes only an adjacent citation tail. Once prose or
      // sentence punctuation intervenes, a later section sign belongs to that prose,
      // not to the preceding ref file. A middle dot is the explicit legacy
      // multi-coordinate separator (`ref/spec.md §5.4·§4`).
      if (segment[cursor] !== '\u00a7') continue
      const coordinates = []
      while (segment[cursor] === '\u00a7') {
        const tail = segment.slice(cursor)
        const coordinate = tail.match(/^\u00a7((?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))*)(?=$|[ \t\r\n\u00b7,;:!?()[\]{}<>]|\.(?=$|[ \t\r\n)\]}>,;:!?]))/u)
        if (!coordinate) fail(`${at}:${n}: malformed numeric legacy ref citation after 'ref/${mention.file}'`)
        coordinates.push(coordinate[1])
        cursor += coordinate[0].length
        while (/[ \t]/u.test(segment[cursor] ?? '')) cursor++
        if (segment[cursor] !== '\u00b7') break
        cursor++
        while (/[ \t]/u.test(segment[cursor] ?? '')) cursor++
        if (segment[cursor] !== '\u00a7') fail(`${at}:${n}: malformed legacy ref citation cluster after 'ref/${mention.file}'`)
      }
      for (const coordinate of coordinates) {
        let parsed
        try { parsed = parseScopeToken(`${mention.file}@${coordinate}`) } catch (e) {
          if (e instanceof SourceEvidenceError) fail(`${at}:${n}: malformed legacy ref citation 'ref/${mention.file} \u00a7${coordinate}' — ${e.message}`)
          throw e
        }
        unique.add(scopeToken(parsed))
      }
    }
  }
  return normalizeScopeArgs([...unique], { allowEmpty: true })
}

// One authoritative answer to "which frozen ref sections belong to this Task?".
// Every producer/consumer (source, pin, approve, validate, and the tree seal) calls it;
// accepting caller-provided scope without this comparison is the omission this protocol
// exists to remove.
export function taskRefAssignment (P, target, { requireCurrent = false } = {}) {
  if (!/^TASK-[0-9]+$/.test(target)) fail(`invalid target '${target}' -- expected TASK-N`)
  const taskText = P.read(P.taskPath(target))
  if (taskText === null) fail(`no such node: ${target}`)
  const explicit = refsField(taskText, P.taskPath(target))
  let assignment
  if (explicit.present) {
    assignment = { mode: 'explicit', scope: explicit.scope }
  } else {
    const scope = legacyCitations(taskText, P.taskPath(target))
    if (scope.length) assignment = { mode: 'legacy-citations', scope }
    else if (fmValue(taskText, 'origin') === 'mapped') assignment = { mode: 'legacy-mapped-no-ref', scope: [] }
    else fail(`${target}: no ref assignment — add canonical frontmatter 'refs: []' for intentional no-ref, or list every assigned coordinate`)
  }
  if (requireCurrent && assignment.scope.length) assertCurrentScope(P, assignment.scope)
  return assignment
}

function sameScope (a, b) {
  return a.length === b.length && a.every((row, i) => row.file === b[i].file && row.location === b[i].location)
}

export function sourceScopeDigest (P) {
  // D1 reviews both sides of the source-to-node map. Bind the full live numeric
  // catalog (not only rows currently selected), each node's assignment mode/scope,
  // and canonical material at every catalog/assigned coordinate. Moving a catalog
  // row or changing a heading/body therefore cannot inherit the old tree verdict.
  const selected = new Map()
  const treeIds = P.treeIds()
  let pureMappedNoRef = treeIds.length > 0
  const nodes = treeIds.map(target => {
    const assigned = taskRefAssignment(P, target)
    // Lifecycle evidence is not a source assignment. A mapped no-ref survey stays
    // code-grounded through both spec and result cycles; only an actual ref assignment
    // or a non-mapped node changes the tree's criterion. Otherwise merely creating a
    // verify record would stale the approved tree seal and stop the normal revise path.
    if (assigned.scope.length || P.originOf(target) !== 'mapped') pureMappedNoRef = false
    for (const scope of assigned.scope) selected.set(scopeToken(scope), scope)
    return {
      target,
      mode: assigned.mode,
      scope: assigned.scope.map(({ file, location }) => ({ file, location }))
    }
  })
  const hasAssignedSources = selected.size > 0
  // A surveyed brownfield tree made entirely of mapped, no-ref nodes still records
  // what IS, not what a brought-in catalog says should be.  But the catalog's observed
  // roster/material is a tripwire: if new intent arrives while every Task remains
  // unassigned, the old fidelity approval must go stale instead of silently retaining
  // an empty map.  `active:false` keeps it out of D1's semantic criterion; present/rows
  // bind only the observation made at the fidelity gate.
  const indexExists = P.read(P.refIndexPath()) !== null
  if (hasAssignedSources && !indexExists) fail(`ref catalog missing: ${P.refIndexPath()}`)
  const catalog = {
    active: !pureMappedNoRef,
    present: indexExists,
    rows: indexExists ? canonicalCurrentIndexRoster(P) : []
  }
  for (const row of catalog.rows) {
    const coordinate = { file: row.file, ...parseLocation(row.location) }
    selected.set(scopeToken(coordinate), coordinate)
  }
  if (hasAssignedSources) {
    for (const node of nodes) {
      if (node.scope.length) assertCurrentScope(P, node.scope, catalog.rows)
    }
  }
  const sources = [...selected.values()].sort(scopeSort).map(scope => {
    const material = materialForSection(P, scope)
    return {
      file: scope.file,
      location: scope.location,
      headings: material.headings,
      fences: material.fences,
      candidates: material.candidates
    }
  })
  return sha256(`${SOURCE_SCOPE_PROTOCOL}\n${JSON.stringify({ catalog, nodes, sources })}`)
}

export function buildSourcePacket (P, target, scopeInput = undefined) {
  if (!/^TASK-[0-9]+$/.test(target)) fail(`invalid target '${target}' -- expected TASK-N`)
  const taskText = P.read(P.taskPath(target))
  if (taskText === null) fail(`no such node: ${target}`)
  const digest = specDigest(taskText)
  if (digest === null) fail(`${target}: cannot digest -- Overview through AC sections are malformed`)
  const assigned = taskRefAssignment(P, target, { requireCurrent: true })
  if (scopeInput !== undefined) {
    const supplied = Array.isArray(scopeInput) && scopeInput.every(x => typeof x === 'string')
      ? normalizeScopeArgs(scopeInput, { allowEmpty: true })
      : normalizeScopeObjects(scopeInput)
    if (!sameScope(supplied, assigned.scope)) {
      const want = assigned.scope.length ? assigned.scope.map(scopeToken).join(' ') : '(no refs)'
      fail(`supplied source coordinates do not exactly match ${target}'s assigned refs — expected ${want}`)
    }
  }
  const scope = assigned.scope
  const materials = scope.map(s => ({ scope: s, material: materialForSection(P, s) }))
  const clauses = materials.flatMap(x => x.material.clauses)
  const roster = materials.map(({ scope, material }) => ({
    file: scope.file,
    location: scope.location,
    headings: material.headings,
    fences: material.fences,
    candidates: material.candidates
  }))
  return {
    protocol: SOURCE_PROTOCOL,
    schema: SOURCE_SCHEMA,
    target,
    spec_digest: digest,
    scope: scope.map(({ file, location }) => ({ file, location })),
    source_digest: sha256(`${SOURCE_ROSTER_PROTOCOL}\n${JSON.stringify(roster)}`),
    clauses
  }
}

function normalizeScopeObjects (scope) {
  if (!Array.isArray(scope)) fail('packet.scope must be an array')
  const args = scope.map((row, i) => {
    exactKeys(row, SCOPE_FIELDS, `packet.scope[${i}]`)
    if (typeof row.file !== 'string' || typeof row.location !== 'string') fail(`packet.scope[${i}] file/location must be strings`)
    return `${row.file}@${row.location.replace(/^\u00a7/, '')}`
  })
  return normalizeScopeArgs(args, { allowEmpty: true })
}

export function formatSourcePacket (packet) {
  return `\`\`\`${SOURCE_PROTOCOL}\n${JSON.stringify(packet, null, 2)}\n\`\`\``
}

// JSON.parse silently keeps the last spelling of a duplicate object key.  A packet
// with two `c1` fields would therefore LOOK different to a person and to pin.  This
// small recursive parser implements JSON's grammar while rejecting that ambiguity.
function parseStrictJson (raw, at) {
  let i = 0
  const syntax = message => fail(`${at} source-evidence body is not strict JSON at byte ${i}: ${message}`)
  const ws = () => { while (i < raw.length && /[\u0009\u000a\u000d\u0020]/.test(raw[i])) i++ }
  const string = () => {
    if (raw[i] !== '"') syntax('expected string')
    const start = i++
    let escaped = false
    while (i < raw.length) {
      const c = raw[i++]
      if (escaped) { escaped = false; continue }
      if (c === '\\') { escaped = true; continue }
      if (c === '"') {
        try { return JSON.parse(raw.slice(start, i)) } catch (e) { syntax(e.message) }
      }
      if (c.charCodeAt(0) < 0x20) syntax('control character in string')
    }
    syntax('unterminated string')
  }
  const value = path => {
    ws()
    if (raw[i] === '{') return object(path)
    if (raw[i] === '[') return array(path)
    if (raw[i] === '"') return string()
    for (const [token, result] of [['true', true], ['false', false], ['null', null]]) {
      if (raw.startsWith(token, i)) { i += token.length; return result }
    }
    const m = raw.slice(i).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/)
    if (m) { i += m[0].length; return Number(m[0]) }
    syntax('expected value')
  }
  const object = path => {
    i++
    const out = Object.create(null)
    const keys = new Set()
    ws()
    if (raw[i] === '}') { i++; return out }
    for (;;) {
      ws()
      const key = string()
      if (keys.has(key)) fail(`${at} has duplicate JSON field '${key}' at ${path}`)
      keys.add(key)
      ws()
      if (raw[i++] !== ':') syntax("expected ':'")
      out[key] = value(`${path}.${key}`)
      ws()
      const end = raw[i++]
      if (end === '}') return out
      if (end !== ',') syntax("expected ',' or '}'")
    }
  }
  const array = path => {
    i++
    const out = []
    ws()
    if (raw[i] === ']') { i++; return out }
    for (;;) {
      out.push(value(`${path}[${out.length}]`))
      ws()
      const end = raw[i++]
      if (end === ']') return out
      if (end !== ',') syntax("expected ',' or ']'")
    }
  }
  const result = value('packet')
  ws()
  if (i !== raw.length) syntax('trailing content')
  return result
}

export function parseSourcePacket (briefText, at = 'round brief') {
  const lines = splitLines(briefText)
  const marker = `\`\`\`${SOURCE_PROTOCOL}`
  const starts = []
  for (let i = 0; i < lines.length; i++) if (lines[i].trim() === marker) starts.push(i)
  if (starts.length !== 1) fail(`${at} must contain exactly one exact ${marker} fence (found ${starts.length})`)
  const start = starts[0]
  if (lines[start] !== marker) fail(`${at} source-evidence fence must not be indented or padded`)
  let end = -1
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] === '```') { end = i; break }
  }
  if (end === -1) fail(`${at} source-evidence fence is not closed`)
  let packet
  try { packet = parseStrictJson(lines.slice(start + 1, end).join('\n'), at) } catch (e) {
    if (e instanceof SourceEvidenceError) throw e
    fail(`${at} source-evidence body is not JSON: ${e.message}`)
  }
  exactKeys(packet, TOP_FIELDS, 'packet')
  if (packet.protocol !== SOURCE_PROTOCOL) fail(`packet.protocol must be '${SOURCE_PROTOCOL}'`)
  if (packet.schema !== SOURCE_SCHEMA) fail(`packet.schema must be ${SOURCE_SCHEMA}`)
  if (typeof packet.target !== 'string') fail('packet.target must be a string')
  if (typeof packet.spec_digest !== 'string' || !/^[0-9a-f]{64}$/.test(packet.spec_digest)) fail('packet.spec_digest must be a lowercase sha256')
  if (typeof packet.source_digest !== 'string' || !/^[0-9a-f]{64}$/.test(packet.source_digest)) fail('packet.source_digest must be a lowercase sha256')
  normalizeScopeObjects(packet.scope) // strict object fields/types and coordinate syntax
  if (!Array.isArray(packet.clauses)) fail('packet.clauses must be an array')
  const ids = new Set(); const sources = new Set()
  for (let i = 0; i < packet.clauses.length; i++) {
    const c = packet.clauses[i]
    exactKeys(c, CLAUSE_FIELDS, `packet.clauses[${i}]`)
    for (const key of CLAUSE_FIELDS) if (typeof c[key] !== 'string') fail(`packet.clauses[${i}].${key} must be a string`)
    if (!/^SC-[0-9a-f]{24}$/.test(c.id)) fail(`packet.clauses[${i}].id is not a canonical SC id`)
    if (ids.has(c.id)) fail(`packet has duplicate clause id '${c.id}'`)
    if (sources.has(c.source)) fail(`packet has duplicate clause source '${c.source}'`)
    ids.add(c.id); sources.add(c.source)
    if (c.heading === '' || c.heading !== oneSpace(c.heading)) fail(`packet.clauses[${i}].heading is not a canonical non-empty heading path`)
    if (!C1.has(c.c1)) fail(`${c.id}.c1 has unknown disposition '${c.c1}'`)
    if (!C3.has(c.c3)) fail(`${c.id}.c3 has unknown disposition '${c.c3}'`)
    // `carried` owes a REACHABILITY WALK, not just an anchor. The measured failure this
    // closes: a source clause naming a case ("a day with no record is 0 minutes") was
    // anchored to a Contract line that handles the topic, while a DIFFERENT Contract line
    // — the row set, "tags with a record today" — excluded the case before that handling
    // could run. Presence was satisfied; the case still could not reach output, and no
    // cold lens saw it. The walk forces the reviewer through the target's own selection
    // lines, which is where a narrowing lives.
    if (c.c1 === 'carried') {
      if (c.c1_case === 'UNSET' || c.c1_case.trim() === '') fail(`${c.id}.c1_case is required when c1 is 'carried' — walk the case: '<condition the clause names> -> <what the Task's own lines then make observable>'`)
      if (!c.c1_case.includes('->')) fail(`${c.id}.c1_case must be a walk of the form '<condition> -> <observable>' (the '->' is what makes it a walk, not a restatement)`)
    }
    // No converse rule: a walk left behind after a disposition moved off `carried` is
    // inert (nothing reads it, and that disposition is judged by its own basis rules),
    // while refusing it here preempted the specific message the real error owed.

  }
  return packet
}

function sectionLogicalLines (taskText, name, at) {
  const lines = visibleMarkdownLines(taskText, at)
  const start = lines.findIndex(entry => entry.headingEligible &&
    new RegExp(`^##[ \\t]+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ \\t]*$`).test(entry.line))
  if (start === -1) return []
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].headingEligible && /^##[ \t]+/.test(lines[i].line)) { end = i; break }
  }
  return logicalBlocks(lines.slice(start + 1, end)).map(block => block.text)
}

function basisAnchor (basis, taskSections, verifyText, clause, at) {
  if (basis === 'UNSET' || basis === '') fail(`${at} is not filled`)
  if (basis === clause.source) {
    return {
      kind: 'source',
      text: clause.source,
      content: JSON.stringify({ source: clause.source, heading: clause.heading, text: clause.text })
    }
  }
  let m = basis.match(/^(Contract|AC|Change Log):(\d+)$/)
  if (m) {
    const n = Number(m[2])
    if (!Number.isSafeInteger(n) || n < 1 || n > taskSections[m[1]].length) fail(`${at} '${basis}' does not resolve to a current Task logical line`)
    const text = taskSections[m[1]][n - 1]
    return { kind: m[1], text, content: text }
  }
  m = basis.match(/^finding:([A-Za-z0-9._-]+)$/)
  if (m) {
    const scalar = value => value.replace(/^(['"])(.*)\1$/, '$2').trim()
    const matches = ['found', 'open_issues', 'followups'].flatMap(list =>
      listItems(verifyText, list).map(item => ({ list, item })))
      .filter(entry => scalar(itemValue(entry.item, 'id')) === m[1])
    if (!matches.length) fail(`${at} '${basis}' does not resolve to a current finding id`)
    if (matches.length !== 1) fail(`${at} '${basis}' resolves to more than one current finding id`)
    const found = matches[0]
    return { kind: 'finding', text: m[1], content: JSON.stringify({ list: found.list, text: oneSpace(found.item) }) }
  }
  m = basis.match(/^adjudication:(\d+)$/)
  if (m) {
    const items = listItems(verifyText, 'adjudications')
    const n = Number(m[1])
    if (!Number.isSafeInteger(n) || n < 1 || n > items.length) fail(`${at} '${basis}' does not resolve to a current adjudication`)
    const text = oneSpace(items[n - 1])
    return { kind: 'adjudication', text, content: text }
  }
  fail(`${at} '${basis}' is not an exact Contract:n, AC:n, Change Log:n, finding:id, adjudication:n, or source coordinate anchor`)
}

function dispositionBasis (value, anchor, clause, lane, at) {
  if (value === 'UNSET') fail(`${at} is still UNSET`)
  if (value === 'missing') {
    if (anchor.kind !== 'finding') fail(`${at} missing requires finding:<id>`)
    return
  }
  if ((lane === 'c1' && value === 'carried') || (lane === 'c3' && value === 'handled')) {
    if (anchor.kind !== 'Contract' && anchor.kind !== 'AC') fail(`${at} ${value} requires Contract:n or AC:n`)
    return
  }
  if (value === 'deferred') {
    if (anchor.kind !== 'Contract' && anchor.kind !== 'AC') fail(`${at} deferred requires Contract:n or AC:n`)
    if (!/\[\s*\u2192\s*child\/deferred\s*:\s*[^\]]+\]/u.test(anchor.text)) fail(`${at} deferred anchor has no explicit '[\u2192 child/deferred: ...]' marker`)
    return
  }
  if (value === 'divergence') {
    if (anchor.kind !== 'Change Log') fail(`${at} divergence requires Change Log:n`)
    return
  }
  if (value === 'excluded') {
    if (anchor.kind !== 'adjudication') fail(`${at} excluded requires adjudication:n`)
    return
  }
  if (lane === 'c3' && value === 'not-edge') {
    if (anchor.kind !== 'source' || clause.source !== anchor.text) {
      fail(`${at} not-edge requires this clause's exact source coordinate`)
    }
    return
  }
  fail(`${at} has unsupported disposition '${value}'`)
}

function assertCompatibility (clause) {
  const compatible = clause.c3 === 'not-edge'
    ? !['missing', 'UNSET'].includes(clause.c1)
    : (clause.c3 === 'handled' && clause.c1 === 'carried') ||
      (clause.c3 === 'deferred' && clause.c1 === 'deferred') ||
      (clause.c3 === 'divergence' && clause.c1 === 'divergence') ||
      (clause.c3 === 'excluded' && clause.c1 === 'excluded') ||
      (clause.c3 === 'missing' && clause.c1 === 'missing')
  if (!compatible) fail(`${clause.id}: incompatible C1 '${clause.c1}' and C3 '${clause.c3}' dispositions`)
}

export function validateCompletedPacket (P, target, packet, verifyText) {
  const expected = buildSourcePacket(P, target, packet.scope)
  if (packet.target !== expected.target) fail(`packet.target '${packet.target}' does not match ${target}`)
  if (packet.spec_digest !== expected.spec_digest) fail(`packet.spec_digest is stale for current ${target}`)
  if (packet.scope.length !== expected.scope.length || packet.scope.some((row, i) =>
    row.file !== expected.scope[i].file || row.location !== expected.scope[i].location)) {
    fail('packet.scope is not the current canonical scope/order')
  }
  if (packet.source_digest !== expected.source_digest) fail('packet.source_digest is stale for the current source roster')
  if (packet.clauses.length !== expected.clauses.length) fail('packet clause roster has a missing or extra row')
  for (let i = 0; i < expected.clauses.length; i++) {
    const got = packet.clauses[i]; const want = expected.clauses[i]
    for (const key of ['id', 'source', 'heading', 'text']) {
      if (got[key] !== want[key]) fail(`packet.clauses[${i}].${key} differs from the current canonical source roster`)
    }
  }

  const taskPath = P.taskPath(target)
  const taskText = P.read(taskPath)
  if (taskText === null) fail(`Task missing: ${taskPath}`)
  const taskSections = Object.fromEntries(['Contract', 'AC', 'Change Log'].map(k => [k, sectionLogicalLines(taskText, k, taskPath)]))
  const resolvedBases = []
  for (const clause of packet.clauses) {
    const c1Anchor = basisAnchor(clause.c1_basis, taskSections, verifyText, clause, `${clause.id}.c1_basis`)
    const c3Anchor = basisAnchor(clause.c3_basis, taskSections, verifyText, clause, `${clause.id}.c3_basis`)
    dispositionBasis(clause.c1, c1Anchor, clause, 'c1', `${clause.id}.c1`)
    dispositionBasis(clause.c3, c3Anchor, clause, 'c3', `${clause.id}.c3`)
    assertCompatibility(clause)
    if (clause.c1 === 'missing' || clause.c3 === 'missing') fail(`${clause.id}: terminal spec pin refuses a missing source disposition`)
    resolvedBases.push({
      id: clause.id,
      c1: { basis: clause.c1_basis, kind: c1Anchor.kind, content: c1Anchor.content },
      c3: { basis: clause.c3_basis, kind: c3Anchor.kind, content: c3Anchor.content }
    })
  }
  return completedPacketDigest(packet, resolvedBases)
}

// The continuous binding ignores JSON whitespace/key order but nothing semantic.  Build
// the fixed field order explicitly so another host can reproduce the exact preimage.
export function completedPacketDigest (packet, resolvedBases = []) {
  const canonical = {
    protocol: packet.protocol,
    schema: packet.schema,
    target: packet.target,
    spec_digest: packet.spec_digest,
    scope: packet.scope.map(row => ({ file: row.file, location: row.location })),
    source_digest: packet.source_digest,
    clauses: packet.clauses.map(c => ({
      id: c.id,
      source: c.source,
      heading: c.heading,
      text: c.text,
      c1: c.c1,
      c1_case: c.c1_case,
      c1_basis: c.c1_basis,
      c3: c.c3,
      c3_basis: c.c3_basis
    })),
    resolved_bases: resolvedBases
  }
  return sha256(`${SOURCE_SEAL_PROTOCOL}\n${JSON.stringify(canonical)}`)
}

function canonicalRounds (target, verifyText) {
  const rounds = listItems(verifyText, 'rounds')
  const seen = new Set()
  let highest = null
  const parsed = []
  for (const item of rounds) {
    const raw = itemValue(item, 'n')
    if (!/^[1-9][0-9]*$/.test(raw)) fail(`${target}: a round has a non-canonical n '${raw}'`)
    const n = Number(raw)
    if (!Number.isSafeInteger(n)) fail(`${target}: round '${raw}' is outside the safe integer range`)
    if (seen.has(n)) fail(`${target}: duplicate round n ${n}`)
    seen.add(n)
    if (highest === null || n > highest) highest = n
    parsed.push({ n, phase: itemValue(item, 'phase') })
  }
  const declared = topValue(verifyText, 'round')
  if (!/^[1-9][0-9]*$/.test(declared) || Number(declared) !== highest) {
    fail(`${target}: top-level round '${declared}' does not match the highest rounds[] entry '${highest ?? ''}'`)
  }
  return parsed
}

export function assertFindRound (target, verifyText, round) {
  const found = canonicalRounds(target, verifyText).filter(r => r.n === round && r.phase === 'find')
  if (found.length !== 1) fail(`${target}: source_evidence_round ${round} is not exactly one current rounds[] phase=find entry`)
}

export function latestFindRound (target, verifyText) {
  const findRounds = canonicalRounds(target, verifyText).filter(r => r.phase === 'find').map(r => r.n)
  const latest = findRounds.length ? Math.max(...findRounds) : null
  if (latest === null) fail(`${target}: verify record has no rounds[] entry with phase=find`)
  return latest
}

export function latestFindBrief (P, target, verifyText) {
  return P.verifyRoundBriefPath(target, latestFindRound(target, verifyText))
}
