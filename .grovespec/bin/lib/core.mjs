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
export function fmValue (text, key) {
  const lines = splitLines(text)
  if (!lines.length || !isFence(lines[0])) return ''
  const re = new RegExp(`^${reEscape(key)}${SP}*:`)
  for (let i = 1; i < lines.length; i++) {
    if (isFence(lines[i])) return ''
    if (re.test(lines[i])) {
      let v = lines[i].replace(new RegExp(`^${reEscape(key)}${SP}*:${SP}*`), '')
      v = v.replace(new RegExp(`${SP}*$`), '')
      v = v.replace(/^"/, '').replace(/"$/, '')
      return v
    }
  }
  return ''
}

// `## <name>` section headers, in file order (a header needs a space after ##).
export function sectionsOf (text) {
  const out = []
  for (const l of splitLines(text)) {
    if (new RegExp(`^##${SP}`).test(l)) {
      out.push(l.replace(new RegExp(`^##${SP}+`), '').replace(new RegExp(`${SP}*$`), ''))
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
  const lines = splitLines(text)
  const start = lines.findIndex(l => new RegExp(`^##${SP}+Overview${SP}*$`).test(l))
  const end = lines.findIndex(l => new RegExp(`^##${SP}+Subtasks${SP}*$`).test(l))
  if (start === -1 || end === -1 || end <= start) return null
  return lines.slice(start, end).join('\n')
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
  const re = new RegExp(`^${reEscape(key)}${SP}*:`)
  for (let i = 1; i < lines.length; i++) {
    if (isFence(bare(lines[i]))) return null
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
    const rest = lines[i].replace(re, '').trim()
    if (rest.startsWith('[]')) return 0
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
export function itemValue (item, key) {
  const re = new RegExp(`^${SP}*(-${SP}+)?${reEscape(key)}${SP}*:`)
  for (const l of splitLines(item)) {
    if (re.test(l)) return stripComment(l.replace(re, '')).trim()
  }
  return ''
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
export function cfgValue (text, key) {
  const re = new RegExp(`^${SP}+${reEscape(key)}:${SP}`)
  for (const l of splitLines(text)) {
    if (re.test(l)) {
      return stripComment(l.replace(new RegExp(`^${SP}+${reEscape(key)}:${SP}*`), ''))
    }
  }
  return ''
}

// top-level `language:` (indent allowed, no space required after the colon).
export function langValue (text) {
  for (const l of splitLines(text)) {
    if (new RegExp(`^${SP}*language:`).test(l)) {
      return stripComment(l.replace(new RegExp(`^${SP}*language:${SP}*`), ''))
    }
  }
  return ''
}
