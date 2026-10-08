// GroveSpec core — pure rules, no filesystem, no printing.
// One rule = one exported function, so the bash runtime this ports could be graded
// against it case by case (tests/regress.sh), and so a rule has exactly one spelling.

// How a line is read. The bash runtime's awk readers behave differently per platform
// (MSYS gawk strips a trailing CR, Linux gawk keeps it), so a CRLF checkout read
// differently on the two. This port strips it — the answer is platform-independent.
// A trailing empty element (from a final newline) is not a line. A leading UTF-8 BOM
// is not part of the first line either — Windows editors add one invisibly, and an
// unstripped BOM made `version:` on line one unfindable, which read as "no version
// line" and slid a foreign-format config past the refusal it was stamped for.
export function splitLines (s) {
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1)
  const l = s.split('\n')
  if (l.length && l[l.length - 1] === '') l.pop()
  return l.map(x => (x.endsWith('\r') ? x.slice(0, -1) : x))
}

// The bash sources write [[:space:]] with LC_ALL unset — in the C locale that class is
// space · tab · VT · FF · CR (newline can't occur inside a line). One spelling for it:
const SP = '[ \\t\\v\\f\\r]'
export const isFence = l => new RegExp(`^---${SP}*$`).test(l)

const reEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Inline YAML comments stripped only outside quotes, and only when the `#` starts
// a real comment (`value # note`). A quoted `"# AC-1"` or `path # section` stays data.
function stripComment (s) {
  let out = ''
  let q = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q !== '') {
      out += c
      if (c === q && s[i - 1] !== '\\') q = ''
      continue
    }
    if (c === '"' || c === '\'') { q = c; out += c; continue }
    if (c === '#' && (i === 0 || /[ \t\v\f\r]/.test(s[i - 1]))) break
    out += c
  }
  return out.replace(new RegExp(`${SP}*$`), '')
}

// Frontmatter value: first line-1 `---` fence to the next fence; `key :` at line start;
// strip trailing spaces, then one leading and one trailing quote. Missing → ''.
const escapedAt = (s, at) => {
  let slashes = 0
  for (let i = at - 1; i >= 0 && s[i] === '\\'; i--) slashes++
  return slashes % 2 === 1
}

function inlineBlockBoundary (line) {
  if (/^[ \t]*$/.test(line)) return true
  if (/^ {0,3}(?:#{1,6}(?:[ \t]+|$)|(?:`{3,}|~{3,})|>|<!--)/.test(line)) return true
  if (/^ {0,3}(?:[-+*][ \t]+|\d{1,9}[.)][ \t]+)/.test(line)) return true
  return /^ {0,3}(?:=+|-+)[ \t]*$/.test(line)
}

function hasCodeSpanClose (lines, lineIndex, column, length) {
  const headingLine = /^ {0,3}#{1,6}(?:[ \t]+|$)/.test(lines[lineIndex])
  for (let i = lineIndex; i < lines.length; i++) {
    if (i > lineIndex && (headingLine || inlineBlockBoundary(lines[i]))) return false
    const line = lines[i]
    for (let at = i === lineIndex ? column : 0; at < line.length;) {
      if (line[at] !== '\x60') { at++; continue }
      let n = 1
      while (line[at + n] === '\x60') n++
      if (n === length) return true
      at += n
    }
  }
  return false
}

// One Markdown block scan for every contract-bearing heading consumer. Fenced and
// indented code stays content but cannot introduce/terminate sections. HTML comments
// are hidden, except marker-shaped text inside inline code or behind a backslash.
// A problem is data, not an exception: validate can report malformed Markdown while
// digest readers fail closed.
export function markdownStructureLines (text) {
  const lines = splitLines(text)
  const visible = []
  let inComment = false
  let fence = null
  let inlineTicks = 0
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (fence !== null) {
      const close = raw.match(/^ {0,3}(\x60+|~+)[ \t]*$/)
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
        fence = null
        visible.push({ line: '', n: i + 1, headingEligible: false, fenced: true, fenceBoundary: 'close', fenceText: raw })
      } else {
        visible.push({ line: raw, n: i + 1, headingEligible: false, fenced: true, fenceBoundary: 'body', fenceText: raw })
      }
      continue
    }

    // Block structure wins before inline parsing. Fence info strings and indented
    // examples are literal code, so marker-shaped bytes there never open comments.
    if (!inComment && inlineTicks === 0) {
      const rawOpening = raw.match(/^ {0,3}(\x60{3,}|~{3,}).*$/)
      if (rawOpening) {
        fence = { char: rawOpening[1][0], length: rawOpening[1].length }
        visible.push({ line: '', n: i + 1, headingEligible: false, fenced: true, fenceBoundary: 'open', fenceText: raw })
        continue
      }
      if (/^(?: {4}|\t)/.test(raw)) {
        visible.push({ line: raw, n: i + 1, headingEligible: false, fenced: false, indentedCode: true })
        continue
      }
    }

    const codeAtLineStart = inlineTicks !== 0
    let kept = ''
    for (let at = 0; at < raw.length;) {
      if (inComment) {
        const end = raw.indexOf('-->', at)
        if (end === -1) break
        kept += ' '
        at = end + 3
        inComment = false
        continue
      }
      if (raw[at] === '\x60') {
        let n = 1
        while (raw[at + n] === '\x60') n++
        if (inlineTicks !== 0) {
          kept += raw.slice(at, at + n)
          if (n === inlineTicks) inlineTicks = 0
          at += n
          continue
        }
        if (!escapedAt(raw, at) && hasCodeSpanClose(lines, i, at + n, n)) inlineTicks = n
        kept += raw.slice(at, at + n)
        at += n
        continue
      }
      if (inlineTicks === 0 && raw.startsWith('<!--', at) && !escapedAt(raw, at)) {
        kept += ' '
        at += 4
        inComment = true
        continue
      }
      kept += raw[at]
      at++
    }
    visible.push({ line: kept, n: i + 1, headingEligible: !codeAtLineStart, fenced: false })
  }
  const problem = inComment
    ? 'unterminated HTML comment'
    : fence !== null ? 'unterminated Markdown fence' : null
  return { lines: visible, problem }
}

export function frontmatterLines (text) {
  const lines = splitLines(text)
  if (!lines.length || !isFence(lines[0])) return null
  const end = lines.findIndex((line, i) => i > 0 && isFence(line))
  return end === -1 ? null : lines.slice(1, end)
}

export function frontmatterBoundaryProblem (text) {
  const lines = splitLines(text)
  if (!lines.length || !isFence(lines[0])) return 'opening frontmatter fence is missing'
  return lines.findIndex((line, i) => i > 0 && isFence(line)) === -1
    ? 'closing frontmatter fence is missing'
    : null
}

export function fmValue (text, key) {
  const lines = frontmatterLines(text)
  if (lines === null) return ''
  const re = new RegExp(`^${reEscape(key)}${SP}*:`)
  for (const line of lines) {
    if (re.test(line)) {
      let v = line.replace(new RegExp(`^${reEscape(key)}${SP}*:${SP}*`), '')
      v = v.replace(new RegExp(`${SP}*$`), '')
      v = v.replace(/^"/, '').replace(/"$/, '')
      return v
    }
  }
  return ''
}

// YAML permits duplicate mapping keys in some parsers and rejects them in others.
// GroveSpec's deliberately small readers take the first spelling, so an agent-written
// duplicate would otherwise make routing depend on which reader touched the file.
// Return each duplicated top-level key once, in the order its second spelling appears.
function duplicateKeys (lines) {
  const seen = new Set(); const duplicated = new Set(); const out = []
  for (const line of lines) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*:/)
    if (!m) continue
    if (seen.has(m[1]) && !duplicated.has(m[1])) { duplicated.add(m[1]); out.push(m[1]) }
    seen.add(m[1])
  }
  return out
}

export function duplicateFrontmatterKeys (text) {
  const lines = frontmatterLines(text)
  return lines === null ? [] : duplicateKeys(lines)
}

export function duplicateTopKeys (text) {
  return duplicateKeys(splitLines(text))
}

// `## <name>` section headers, in file order (a header needs a space after ##).
function directMappingEntries (text, parent) {
  const lines = splitLines(text)
  const parentRe = new RegExp('^' + reEscape(parent) + SP + '*:')
  const parents = lines.map((line, index) => parentRe.test(line) ? index : -1).filter(index => index !== -1)
  if (parents.length !== 1) return []
  const start = parents[0]
  if (stripComment(lines[start].replace(parentRe, '')).trim() !== '') return []
  const candidates = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (new RegExp('^' + SP + '*(?:#.*)?$').test(line)) continue
    const indent = line.match(new RegExp('^' + SP + '*'))[0].length
    if (indent === 0) break
    const body = line.slice(indent)
    const match = body.match(/^([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*:[ \t]*(.*)$/)
    if (match) candidates.push({ key: match[1], value: stripComment(match[2]), indent })
  }
  if (!candidates.length) return []
  const directIndent = Math.min(...candidates.map(entry => entry.indent))
  return candidates.filter(entry => entry.indent === directIndent)
}

export function nestedValue (text, parent, key) {
  const found = directMappingEntries(text, parent).filter(entry => entry.key === key)
  return found.length === 1 ? found[0].value : ''
}

export function duplicateNestedKeys (text, parent) {
  return duplicateKeys(directMappingEntries(text, parent).map(entry => entry.key + ':'))
}

export function sectionsOf (text) {
  const scanned = markdownStructureLines(text)
  if (scanned.problem !== null) return []
  const out = []
  for (const entry of scanned.lines) {
    if (entry.headingEligible && new RegExp(`^##${SP}`).test(entry.line)) {
      out.push(entry.line.replace(new RegExp(`^##${SP}+`), '').replace(new RegExp(`${SP}*$`), ''))
    }
  }
  return out
}

// ---- readability: what the RENDERER shows as one thing ----------------------
// A person's eye measures rendered blocks, not source lines. A list item is its
// marker line plus every continuation line under it (its nested children are their
// own blocks); a paragraph is a run of non-blank lines. Both collapse their internal
// line breaks when rendered — so a limit applied per SOURCE line would be satisfied
// by re-wrapping the file without changing the page by one pixel. Measure the block.
//
// kind: 'heading' | 'item' | 'quote' | 'para'. `section` is the enclosing `## name`
// ('' before the first one). `text` is the block's content with the list marker,
// checkbox and blockquote angle stripped — the limit is about words, not syntax.
const LIST_MARKER = new RegExp(`^(${SP}*)(?:[-*+]|[0-9]+[.)])${SP}+(?:\\[[ xX]\\]${SP}+)?`)

export function logicalBlocks (text, fromLine = 1) {
  const scanned = markdownStructureLines(text)
  const out = []
  let open = null
  const close = () => {
    if (open) {
      open.text = open.parts.join(' ').trim()
      delete open.parts
      out.push(open)
    }
    open = null
  }
  let section = ''
  for (const entry of scanned.lines) {
    if (entry.n < fromLine || entry.fenced || entry.indentedCode) { close(); continue }
    const line = entry.line
    if (line.trim() === '') { close(); continue }
    if (entry.headingEligible && new RegExp(`^#{1,6}${SP}`).test(line)) {
      close()
      const depth = line.match(/^#+/)[0].length
      const title = line.replace(new RegExp(`^#+${SP}+`), '').replace(new RegExp(`${SP}*$`), '')
      if (depth === 2) section = title
      out.push({ kind: 'heading', depth, section, n: entry.n, indent: 0, text: title })
      continue
    }
    const marker = line.match(LIST_MARKER)
    if (marker) {                                   // a marker always starts a new block
      close()
      open = { kind: 'item', section, n: entry.n, indent: marker[1].length, parts: [line.slice(marker[0].length)] }
      continue
    }
    // A table is already the structured form these limits are asking for — measuring
    // its rows as one run-on paragraph would fail the tidiest thing a Contract can do.
    if (/^\s*\|/.test(line)) {
      if (!open || open.kind !== 'table') { close(); open = { kind: 'table', section, n: entry.n, indent: 0, parts: [] } }
      open.parts.push(line.trim())
      continue
    }
    const quote = line.match(new RegExp(`^(${SP}*)>${SP}?`))
    if (quote && (!open || open.kind !== 'quote')) {
      close()
      open = { kind: 'quote', section, n: entry.n, indent: quote[1].length, parts: [line.slice(quote[0].length)] }
      continue
    }
    if (open) { open.parts.push(quote ? line.slice(quote[0].length) : line.trim()); continue }
    open = { kind: 'para', section, n: entry.n, indent: line.match(new RegExp(`^${SP}*`))[0].length, parts: [line.trim()] }
  }
  close()
  return out
}

// `X<n>` in a read.jargon list means that letter followed by digits (C4, R11); every
// other token is a literal word. Matched whole, and never inside a code span — a
// backticked identifier is the machine lane being QUOTED, which is what code spans
// are for. Returns the distinct offending spellings, in the order they first appear.
export function jargonHits (text, tokens) {
  const bare = text.replace(/`[^`]*`/g, ' ')
  const hits = []
  for (const tok of tokens) {
    const shaped = tok.match(/^([A-Za-z])<n>$/)
    const re = shaped
      ? new RegExp(`(?<![A-Za-z0-9_-])${shaped[1]}[0-9]+(?![A-Za-z0-9_-])`, 'g')
      : new RegExp(`(?<![A-Za-z0-9_-])${reEscape(tok)}(?![A-Za-z0-9_-])`, 'g')
    for (const m of bare.matchAll(re)) hits.push({ at: m.index, spelling: m[0] })
  }
  hits.sort((a, b) => a.at - b.at)
  return [...new Set(hits.map(h => h.spelling))]
}

// Everything FORMATS.md "How it reads when rendered" states, measured. One short
// phrase per fault, already aggregated — the caller prints them as one line per file,
// because a wall-of-text Task would otherwise answer with a wall of text.
export function readabilityFindings (text, limits) {
  const { id = '', name = '', itemMax, paraMax, ledeMax, jargon = [] } = limits
  const raw = splitLines(text)
  const out = []
  if (!raw.length || !isFence(raw[0])) return out
  const end = raw.findIndex((line, i) => i > 0 && isFence(line))
  if (end === -1) return out

  // The blank line is the whole fix: without it CommonMark reads the closing fence as
  // a setext underline and the frontmatter BECOMES the document's largest heading.
  if (raw[end - 1].trim() !== '') out.push('frontmatter renders as this document\'s title — leave a blank line before the closing ---')

  const blocks = logicalBlocks(text, end + 2)
  const body = blocks.filter(b => b.kind !== 'heading' || b.depth !== 1)
  const title = blocks.find(b => b.kind === 'heading' && b.depth === 1)
  const firstSectionAt = blocks.find(b => b.kind === 'heading' && b.depth === 2)?.n ?? Infinity
  const want = name === '' ? `# ${id}` : `# ${id} · ${name}`
  if (!title || title.n > firstSectionAt) out.push(`no title line — open the body with '${want}'`)
  else {
    const missing = [id, name].filter(part => part !== '' && !title.text.includes(part))
    if (missing.length) out.push(`title '${title.text}' does not match the frontmatter (${missing.join(' · ')})`)
    const lede = blocks.find(b => b.n > title.n && b.n < firstSectionAt && b.kind !== 'heading')
    if (!lede || lede.kind !== 'quote') out.push('no lede — one \'> \' line under the title saying what this node is responsible for')
    else if ([...lede.text].length > ledeMax) out.push(`lede is ${[...lede.text].length} chars (max ${ledeMax})`)
  }

  for (const [kind, max, label] of [['item', itemMax, 'list item'], ['para', paraMax, 'paragraph']]) {
    const bad = body.filter(b => b.kind === kind && [...b.text].length > max)
    if (!bad.length) continue
    const worst = bad.reduce((a, b) => ([...b.text].length > [...a.text].length ? b : a))
    out.push(`${bad.length} over-long ${label}${bad.length > 1 ? 's' : ''} (max ${max}; worst ${[...worst.text].length} chars at line ${worst.n}, in ${worst.section || 'the body'})`)
  }

  const words = body.map(b => b.text).join('\n')
  const hits = jargonHits(words, jargon)
  if (hits.length) out.push(`machine-lane vocabulary a reader cannot act on: ${hits.slice(0, 6).join(', ')}${hits.length > 6 ? ` (+${hits.length - 6})` : ''} — that belongs in the gate record`)
  return out
}

// tree.md → rows {tid, parent, depth}. Comment lines (#) skipped; an item is
// `- TASK-N` alone on its line; depth = floor(leading SPACES / 2) (tabs count zero,
// as in the bash original); parent = the last row seen one level up.
export function treeRows (text) {
  const rows = []
  const stack = {}
  for (const l of splitLines(text)) {
    if (new RegExp(`^${SP}*#`).test(l)) continue
    if (!new RegExp(`^${SP}*-${SP}*TASK-[0-9]+${SP}*$`).test(l)) continue
    const depth = Math.floor((l.match(/^ */)[0].length) / 2)
    const tid = l.replace(new RegExp(`^${SP}*-${SP}*`), '').replace(new RegExp(`${SP}*$`), '')
    const parent = depth > 0 ? (stack[depth - 1] ?? '') : ''
    stack[depth] = tid
    rows.push({ tid, parent, depth })
  }
  return rows
}

// Strict structure rules for tree.md — the parser above stays lenient (it reads what it
// can), and validate uses THIS to refuse the shapes the parser would silently bend:
// odd indentation rounds down, a depth jump grabs a stale ancestor, a duplicate id makes
// every by-id lookup ambiguous. Returns ["<lineno>: <message>", …].
export function treeStrictProblems (text) {
  const out = []
  const lines = splitLines(text)
  const seen = new Set()
  let prevDepth = null
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (new RegExp(`^${SP}*#`).test(l)) continue
    if (!new RegExp(`^${SP}*-${SP}*TASK-[0-9]+${SP}*$`).test(l)) continue
    const lead = l.match(/^[ \t\v\f\r]*/)[0]
    const tid = l.replace(new RegExp(`^${SP}*-${SP}*`), '').replace(new RegExp(`${SP}*$`), '')
    if (/[^ ]/.test(lead)) out.push(`${i + 1}: indent uses tabs/odd whitespace — exactly 2 spaces per depth`)
    else if (lead.length % 2 !== 0) out.push(`${i + 1}: indent is ${lead.length} space(s) — exactly 2 per depth`)
    else {
      const depth = lead.length / 2
      if (prevDepth === null && depth !== 0) out.push(`${i + 1}: the first node must be at depth 0`)
      else if (prevDepth !== null && depth > prevDepth + 1) out.push(`${i + 1}: depth jumps ${prevDepth} → ${depth} — a child goes exactly one level below its parent`)
      prevDepth = depth
    }
    if (seen.has(tid)) out.push(`${i + 1}: duplicate ${tid} — an id appears once in the tree`)
    seen.add(tid)
  }
  return out
}

// tree.md lines validate rejects: not empty, not `#`/`<!--`, not a `- TASK-N` item.
// Returns ["<lineno>: <line>", ...] (1-based, as awk NR).
export function badTreeLines (text) {
  const out = []
  const lines = splitLines(text)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (new RegExp(`^${SP}*$`).test(l)) continue
    if (new RegExp(`^${SP}*#`).test(l)) continue
    if (/^<!--/.test(l)) continue
    if (!new RegExp(`^${SP}*-${SP}*TASK-[0-9]+${SP}*$`).test(l)) out.push(`${i + 1}: ${l}`)
  }
  return out
}

// blocked_by value "[TASK-2, TASK-3]" → ["TASK-2","TASK-3"] (strip []/spaces, split on
// commas, keep only TASK-N tokens — anything else is simply not a dependency).
export function blockedIds (value) {
  return value.replace(/[[\] ]/g, '').split(',').filter(t => /^TASK-[0-9]+$/.test(t))
}

// schema line `key: a|b|c` → value; pipes() splits it.
export function schValue (text, key) {
  for (const l of splitLines(text)) {
    const re = new RegExp(`^${reEscape(key)}:`)
    if (re.test(l)) return l.replace(new RegExp(`^${reEscape(key)}:${SP}*`), '')
  }
  return ''
}
// Tokens are trimmed and blanks dropped — `key: | ` must read as EMPTY, not as one
// whitespace token: the vacuity preflight counts these, and a token of spaces would
// count as "the schema has values" while enabling nothing.
export const pipes = s => s.split('|').map(t => t.trim()).filter(t => t !== '')

// THE hash rule — one spelling. A Task's spec digest covers the contract-bearing
// sections Overview·Requirements·Contract·AC (their `##` header lines included),
// and deliberately NOT the frontmatter, Subtasks or Change Log: status flips,
// checkbox ticks and log appends are legitimate post-approval changes, while an
// edit to what was verified must show up as a mismatch. CRLF-normalized via
// splitLines, joined with '\n'. Returns null when the span can't be found
// (malformed sections — validate flags those separately).
export function specSpanText (text) {
  const raw = splitLines(text)
  const scanned = markdownStructureLines(text)
  if (scanned.problem !== null) return null
  const start = scanned.lines.find(entry => entry.headingEligible && new RegExp(`^##${SP}+Overview${SP}*$`).test(entry.line))
  const end = scanned.lines.find(entry => entry.headingEligible && new RegExp(`^##${SP}+Subtasks${SP}*$`).test(entry.line))
  if (!start || !end || end.n <= start.n) return null
  return raw.slice(start.n - 1, end.n - 1).join('\n')
}

// Rewrite ONE frontmatter field in place. Works on the raw text — every other line keeps
// its bytes, and the edited line keeps its own line ending — so changing `status` in a
// CRLF Task file does not rewrite the whole file. null = no frontmatter, or no such key
// (the caller decides whether that is an error).
// A leading BOM is preserved, not part of the fence: the READERS strip it (splitLines),
// so a BOM'd task passed validate — and then this writer, checking the raw first line,
// refused to flip its status. A reader that accepts a byte binds the writer to it.
export function setFmValue (text, key, value) {
  const bom = text.charCodeAt(0) === 0xFEFF ? '\uFEFF' : ''   // the escape, never the literal — a literal BOM renders as nothing
  if (bom !== '') text = text.slice(1)
  const lines = text.split('\n')
  const bare = l => l.replace(/\r$/, '')
  if (!lines.length || !isFence(bare(lines[0]))) return null
  const end = lines.findIndex((line, i) => i > 0 && isFence(bare(line)))
  if (end === -1) return null
  const re = new RegExp(`^${reEscape(key)}${SP}*:`)
  for (let i = 1; i < end; i++) {
    if (re.test(bare(lines[i]))) {
      lines[i] = `${key}: ${value}${lines[i].endsWith('\r') ? '\r' : ''}`
      return bom + lines.join('\n')
    }
  }
  return null
}

// Review-state yamls have no frontmatter fences — a field is a top-level `key: value`
// line. Comment and trailing spaces stripped; missing → ''.
export function topValue (text, key) {
  const re = new RegExp(`^${reEscape(key)}${SP}*:`)
  for (const l of splitLines(text)) {
    if (re.test(l)) {
      return stripComment(l.replace(new RegExp(`^${reEscape(key)}${SP}*:${SP}*`), ''))
    }
  }
  return ''
}

// How many `- ` items a top-level list key holds (`key: []` and a bare `key:` followed
// by another top-level key are both zero). Good enough for the fixed review-state shape.
export function listItemCount (text, key) {
  const lines = splitLines(text)
  const re = new RegExp(`^${reEscape(key)}${SP}*:`)
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue
    const rest = stripComment(lines[i].replace(re, '')).trim()
    if (rest.startsWith('[]')) return 0
    if (rest.startsWith('[')) return 1
    let n = 0
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j]
      if (new RegExp(`^${SP}*$`).test(l)) continue
      if (new RegExp(`^${SP}*#`).test(l)) continue
      if (!new RegExp(`^${SP}`).test(l)) break            // next top-level key
      if (new RegExp(`^${SP}+-${SP}`).test(l)) n++
    }
    return n
  }
  return 0
}

// Which of these top-level list keys are written in FLOW style (`key: [ ... ]`).
// The readers here model BLOCK style only, so a flow list is read as zero items and every
// per-item check silently skips it — a finding written that way passed the grade rules AND
// vanished from the followups tally, in one line. `key: []` is the one flow form that
// means exactly what it says, so it is not flagged.
export function flowListKeys (text, keys) {
  const lines = splitLines(text)
  const out = []
  for (const key of keys) {
    const re = new RegExp(`^${reEscape(key)}${SP}*:`)
    for (const l of lines) {
      if (!re.test(l)) continue
      const rest = l.replace(re, '').trim()
      if (rest.startsWith('[') && !rest.startsWith('[]')) out.push(key)
      break
    }
  }
  return out
}

// ---- what a strict YAML reader makes of these records -----------------------
// The readers HERE are line-based: they strip one surrounding quote pair without
// interpreting escapes, and they end a list at the first non-indented line. Both
// choices open the same silent gap the other way around — bytes grovespec reads
// fine that strict YAML refuses ("…\Projects…" — \P is no escape; '…the
// 'quoted' phrase…' — closed at the inner '), and bytes grovespec silently LOSES
// that YAML may even accept (a list item fallen to column 0 ends the list for
// every reader here — the items below vanish from every per-item check, so a
// settled adjudication can re-fire; a block scalar's body is depth the readers
// skip). Measured: 6/39 records unreadable to js-yaml in one project, 3 files ·
// 4 items unread by grovespec in another — and validate said nothing for either.
// One pass per file over the format's own single-line shapes; returns
// [{ line, msg }] for the caller to report (as a notice — history is written).
const DQ_SIMPLE_ESCAPES = '0abtnvfre "/\\N_LP\t'
const DQ_HEX_ESCAPES = { x: 2, u: 4, U: 8 }

function quotedScalarProblem (s) {
  const q = s[0]
  let close = -1
  if (q === '"') {
    for (let i = 1; i < s.length; i++) {
      const c = s[i]
      if (c === '"') { close = i; break }
      if (c !== '\\') continue
      const e = s[i + 1]
      const hex = DQ_HEX_ESCAPES[e]
      if (hex !== undefined) {
        const digits = s.slice(i + 2, i + 2 + hex)
        if (digits.length !== hex || !/^[0-9a-fA-F]+$/.test(digits)) {
          return `\\${e} needs ${hex} hex digit(s) — a literal backslash in a "…" value is written \\\\`
        }
        i += 1 + hex
      } else if (e === undefined || !DQ_SIMPLE_ESCAPES.includes(e)) {
        return `\\${e ?? ''} is not a YAML escape — a literal backslash in a "…" value is written \\\\`
      } else i++
    }
  } else {
    for (let i = 1; i < s.length; i++) {
      if (s[i] !== '\'') continue
      if (s[i + 1] === '\'') { i++; continue }
      close = i
      break
    }
  }
  if (close === -1) return `the ${q}…${q} value never closes on its line — a strict YAML reader runs on into the next line`
  if (!new RegExp(`^${SP}*(?:#.*)?$`).test(s.slice(close + 1))) {
    return q === '"'
      ? 'the "…" value closes early — a literal " inside it is written \\"'
      : "the '…' value closes early — a literal ' inside it is doubled ('')"
  }
  return null
}

export function strictYamlProblems (text) {
  const out = []
  const push = (idx, msg) => out.push({ line: idx + 1, msg })
  let topKey = null                       // the current top-level key + whether its own line carries a value
  splitLines(text).forEach((raw, idx) => {
    if (new RegExp(`^${SP}*$`).test(raw)) return
    if (new RegExp(`^${SP}*#`).test(raw)) return
    const indent = raw.match(/^[ \t]*/)[0]
    if (indent.includes('\t')) push(idx, 'indentation contains a tab — YAML forbids tabs in indentation; use spaces')
    // A list item fallen to column 0: every reader here ends the enclosing list on
    // it, so it AND everything below leave grovespec's sight — and a YAML mapping
    // refuses a top-level sequence entry, so outside readers fail on the same line.
    if (/^-([ \t]|$)/.test(raw)) {
      push(idx, 'a list item at column 0 — every grovespec reader ends the enclosing list here (this item and everything below are invisible to per-item checks, so a settled finding can re-fire), and a YAML mapping refuses a top-level sequence entry; indent it under its key')
      topKey = null
      return
    }
    const top = indent.length === 0 ? raw.match(/^([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*:(.*)$/) : null
    if (top) topKey = { key: top[1], hasValue: stripComment(top[2]).trim() !== '', flagged: false }
    else if (topKey && topKey.hasValue && !topKey.flagged && new RegExp(`^${SP}+-(${SP}|$)`).test(raw)) {
      // Items under a key that already has a value: strict YAML refuses the block,
      // and no grovespec reader will ever return them (listItems asks only list keys).
      topKey.flagged = true
      push(idx, `list item(s) under '${topKey.key}', whose own line already carries a value — strict YAML refuses this block, and no grovespec reader returns these items; move them under their list key`)
    }
    const kv = raw.match(/^[ \t]*(?:-[ \t]+)?[A-Za-z_][A-Za-z0-9_-]*[ \t]*:[ \t]*(.*)$/)
    if (!kv || kv[1] === '') return
    const v = kv[1]
    const c0 = v[0]
    if (c0 === '"' || c0 === '\'') {
      const msg = quotedScalarProblem(v)
      if (msg !== null) push(idx, msg)
      return
    }
    // A block scalar header is VALID YAML — and exactly the depth these line-based
    // records refuse: the indented body is invisible to every per-item check here.
    if (/^[|>][+-]?[0-9]*[ \t]*(#.*)?$/.test(v)) {
      push(idx, 'a block scalar — its indented body is invisible to every grovespec check (these records are read line by line); write the value on one line, quoted if it needs escaping')
      return
    }
    // Plain values that YAML reads as syntax, not text.
    if (c0 === '*' || c0 === '&' || c0 === '!') {
      push(idx, `value begins with '${c0}' — strict YAML reads it as ${c0 === '*' ? 'an alias' : c0 === '&' ? 'an anchor' : 'a tag'}, not text; quote the value`)
      return
    }
    if (c0 === '@' || c0 === '\x60') {
      push(idx, `value begins with '${c0}' — a reserved YAML indicator; quote the value`)
      return
    }
    if (c0 === '{' || c0 === '[') {
      // The one-line flow forms the format does use must CLOSE on their line.
      let depth = 0; let q = ''
      for (let i = 0; i < v.length; i++) {
        const c = v[i]
        if (q !== '') { if (c === q) q = ''; continue }
        if (c === '"' || c === '\'') q = c
        else if (c === '{' || c === '[') depth++
        else if (c === '}' || c === ']') depth--
      }
      if (depth > 0 || q !== '') push(idx, `the ${c0 === '{' ? '{ … }' : '[ … ]'} value never closes on its line — a strict YAML reader runs on into the next lines`)
      return
    }
    // A plain value containing ': ' is a mapping key to strict YAML, not prose.
    const plain = stripComment(v)
    if (/:([ \t]|$)/.test(plain)) {
      push(idx, "the plain value contains ': ' — strict YAML reads a second mapping key there and refuses the line; quote the whole value")
    }
  })
  return out
}

// The `- ` items of a top-level list key, each returned as its own raw block.
// Same shape assumption as listItemCount: a nested list under a fixed-shape record.
export function listItems (text, key) {
  const lines = splitLines(text)
  const re = new RegExp(`^${reEscape(key)}${SP}*:`)
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue
    if (lines[i].replace(re, '').trim().startsWith('[]')) return []
    const items = []
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j]
      if (new RegExp(`^${SP}*$`).test(l)) continue
      if (!new RegExp(`^${SP}`).test(l)) break              // next top-level key
      if (new RegExp(`^${SP}+-${SP}`).test(l)) items.push([])
      if (items.length) items[items.length - 1].push(l)
    }
    return items.map(a => a.join('\n'))
  }
  return []
}

// One field of such an item. The first line carries `- key: value`, the rest `key: value`.
function directItemFields (item) {
  const lines = splitLines(item).filter(line =>
    !new RegExp('^' + SP + '*$').test(line) && !new RegExp('^' + SP + '*#').test(line))
  if (!lines.length) return []
  const dash = lines[0].search(/\S/)
  if (dash === -1 || lines[0][dash] !== '-') return []
  const after = lines[0].slice(dash + 1).search(/\S/)
  const indent = after === -1
    ? (lines.length > 1 ? lines[1].search(/\S/) : -1)
    : dash + 1 + after
  if (indent === -1) return []
  const out = []
  for (let i = 0; i < lines.length; i++) {
    if (i === 0 && after === -1) continue
    const column = i === 0 ? indent : lines[i].search(/\S/)
    if (column !== indent) continue
    const match = lines[i].slice(column).match(/^([A-Za-z_][A-Za-z0-9_-]*)[ \t]*:[ \t]*(.*)$/)
    if (match) out.push({ key: match[1], value: stripComment(match[2]).trim() })
  }
  return out
}

export function itemValue (item, key) {
  const found = directItemFields(item).filter(field => field.key === key)
  return found.length === 1 ? found[0].value : ''
}

export function duplicateListItemKeys (text, keys) {
  const out = []
  for (const list of keys) {
    listItems(text, list).forEach((item, index) => {
      for (const key of duplicateKeys(directItemFields(item).map(field => field.key + ':'))) {
        out.push({ list, index: index + 1, key })
      }
    })
  }
  return out
}

// Finding categories, with FIXED handling. THIS is the rule — reviewers.md describes
// it, and `validate` enforces the lanes: a must-fix category blocks (open_issues), a
// record category never does (followups), and no per-finding severity argument exists
// to re-run. The five/two split is the 2026-09-21 user decision that replaced the
// severity ladder + gate arithmetic — "how serious" drifted per round; "which of these
// seven" is a definition (METHODOLOGY §6).
export const MUST_FIX_CATEGORIES = ['crash', 'requirement-unmet', 'normal-use-bug', 'easy-abuse', 'security-hole']
export const RECORD_CATEGORIES = ['improvement', 'harmless-bug']
// Legacy (pre-0.13) grade fields, recognized only to tell a legacy-shaped finding from
// a malformed new one: decided records stay readable, in-progress ones must reclassify.
export const LEGACY_GRADE_FIELDS = ['severity', 'proposed', 'gate1', 'gate2', 'gate3']

// The 0.13 cycle's close conditions, checked as INVARIANTS on a passed record — one
// function, so `validate` (the floor) and `approve` (the decision) can never disagree
// about what a completed cycle looks like. A synthetic record that skipped the streak
// used to walk test → pin → approve to done; the skills prescribed the conditions but
// nothing recomputed them. Scope: NEW-FORMAT records only (find_streak present) — a
// decided legacy record was written under its own cycle's rules and stays readable.
// `round == max_rounds` passes when everything else holds (the budget is spent exactly);
// only round PAST the budget is refused — reaching a cap is never itself a pass.
export function completionProblems (text) {
  const has = key => splitLines(text).some(line => new RegExp(`^${key}[ \\t]*:`).test(line))
  if (!has('find_streak') || topValue(text, 'status') !== 'passed') return []
  const unq = s => s.replace(/^(['"])(.*)\1$/, '$2').trim()
  const out = []
  const n = Number(topValue(text, 'find_streak'))
  const streak = Number(topValue(text, 'no_new_streak') || '0')
  if (topValue(text, 'level') !== 'skip' && Number.isFinite(n) && Number.isFinite(streak) && streak < n) {
    out.push(`no_new_streak ${streak} has not reached find_streak ${n} — the find phase never met its close condition ('skip' is the one level that collapses the cycle)`)
  }
  const cur = unq(topValue(text, 'current_item'))
  if (cur !== '') out.push(`current_item '${cur}' is still open — a passed cycle has no item mid-fix`)
  listItems(text, 'found').forEach((it, i) => {
    if (unq(itemValue(it, 'judged')) === 'pending') {
      const id = unq(itemValue(it, 'id'))
      out.push(`found[${i + 1}]${id === '' ? '' : ` (${id})`} is still pending classification — an unresolved candidate cannot be part of a pass`)
    }
  })
  const r = Number(topValue(text, 'round')); const mx = Number(topValue(text, 'max_rounds'))
  if (Number.isFinite(r) && Number.isFinite(mx) && mx > 0 && r > mx) {
    out.push(`round ${r} is past max_rounds ${mx} — beyond the budget a cycle escalates, it does not pass`)
  }
  return out
}

// config value: an INDENTED `key: value` line (first hit anywhere — the flat paths:
// entries are the only indented keys the callers ask for), inline #comment stripped.
export function cfgValue (text, parent, key) {
  return nestedValue(text, parent, key)
}

// top-level `language:` (indent allowed, no space required after the colon).
export function langValue (text) {
  return topValue(text, 'language')
}
