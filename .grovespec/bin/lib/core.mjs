// GroveSpec core — pure rules, no filesystem, no printing.
// One rule = one exported function, so the bash runtime this ports could be graded
// against it case by case (tests/regress.sh), and so a rule has exactly one spelling.

// How a line is read. The bash runtime's awk readers behave differently per platform
// (MSYS gawk strips a trailing CR, Linux gawk keeps it), so a CRLF checkout read
// differently on the two. This port strips it — the answer is platform-independent.
// A trailing empty element (from a final newline) is not a line.
export function splitLines (s) {
  const l = s.split('\n')
  if (l.length && l[l.length - 1] === '') l.pop()
  return l.map(x => (x.endsWith('\r') ? x.slice(0, -1) : x))
}

// The bash sources write [[:space:]] with LC_ALL unset — in the C locale that class is
// space · tab · VT · FF · CR (newline can't occur inside a line). One spelling for it:
const SP = '[ \\t\\v\\f\\r]'
export const isFence = l => new RegExp(`^---${SP}*$`).test(l)

const reEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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
export const pipes = s => s.split('|').filter(x => x !== '')

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

// Review-state yamls have no frontmatter fences — a field is a top-level `key: value`
// line. Comment and trailing spaces stripped; missing → ''.
export function topValue (text, key) {
  const re = new RegExp(`^${reEscape(key)}${SP}*:`)
  for (const l of splitLines(text)) {
    if (re.test(l)) {
      return l.replace(new RegExp(`^${reEscape(key)}${SP}*:${SP}*`), '')
        .replace(new RegExp(`${SP}*#.*$`), '')
        .replace(new RegExp(`${SP}*$`), '')
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

// config value: an INDENTED `key: value` line (first hit anywhere — the flat paths:
// entries are the only indented keys the callers ask for), inline #comment stripped.
export function cfgValue (text, key) {
  const re = new RegExp(`^${SP}+${reEscape(key)}:${SP}`)
  for (const l of splitLines(text)) {
    if (re.test(l)) {
      return l.replace(new RegExp(`^${SP}+${reEscape(key)}:${SP}*`), '')
        .replace(new RegExp(`${SP}*#.*$`), '')
        .replace(new RegExp(`${SP}*$`), '')
    }
  }
  return ''
}

// top-level `language:` (indent allowed, no space required after the colon).
export function langValue (text) {
  for (const l of splitLines(text)) {
    if (new RegExp(`^${SP}*language:`).test(l)) {
      return l.replace(new RegExp(`^${SP}*language:${SP}*`), '')
        .replace(new RegExp(`${SP}*#.*$`), '')
        .replace(new RegExp(`${SP}*$`), '')
    }
  }
  return ''
}
