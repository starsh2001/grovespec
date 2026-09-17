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

// The severity gates, as arithmetic. THIS is the rule — the prose in reviewers.md
// describes it, and `validate` enforces what it computes. Levels: nice 1 · should-fix 2 · critical 3.
//
// gate1 — what can you exhibit TODAY, by running committed code?
//   behavior  — the wrong behavior itself runs today                     → no cap
//   mechanism — the defect is verified (a probe/mutation shows the hole)
//               AND the step that turns it into wrong behavior is ONE
//               ORDINARY act (a natural future edit, an in-scope consumer
//               doing the documented thing) — named in `trigger`         → caps at should-fix
//   contrived — the hole is shown, but reaching wrong behavior needs
//               abnormal action relative to the product's stated reality:
//               deliberately violating a documented rule, two independent
//               edits coinciding, input/scale outside the brief           → caps at nice-to-have
//   story     — no verified hole: the victim is predicted, not shown      → caps at nice-to-have
// gate2 yes — a SHOWN break of an explicitly promised clause lifts the cap for
//             mechanism/story — NOT for contrived: a promise that only breaks under
//             deliberate abnormal action is not a promise the product breaks.
// gate3 yes — a documented workaround / an existing signal already catches it → one level down
//
// The boundary this guards is should-fix ↔ nice: at strength 2, critical and should-fix
// block identically, so demoting between THEM ends nothing — what ends a loop is a
// should-fix dying to nice. Two shapes feed a loop forever and both cap at nice here:
// a story surviving as should-fix, and a CONTRIVED mechanism re-shown through ever more
// elaborate probes, each patched case by case. Neither can block on its own.
export const SEVERITY_RANK = { 'nice-to-have': 1, 'should-fix': 2, critical: 3 }
export function severityCap (proposed, gate1, gate2, gate3) {
  let cap = SEVERITY_RANK[proposed]
  if (cap === undefined) return null
  if (gate1 === 'contrived') cap = Math.min(cap, 1)
  else if (gate2 !== 'yes') {
    if (gate1 === 'mechanism') cap = Math.min(cap, 2)
    else if (gate1 === 'story') cap = Math.min(cap, 1)
  }
  if (gate3 === 'yes') cap -= 1
  return Math.max(cap, 1)
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
