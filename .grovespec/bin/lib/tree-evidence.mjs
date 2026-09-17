// The tree gate reviews more than tree.md.  A decomposition reviewer also reads the
// brief and each Task's cheap identity/intent fields; a fidelity reviewer reads the
// mapped Contracts, the code, and the two brownfield backlogs.  This module gives that
// mode-specific input set one deterministic spelling so `pin tree` can bind the exact
// substrate and `approve tree` can prove it did not change under the verdict.
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { fmValue, splitLines, treeRows } from './core.mjs'
import { taskRefAssignment, visibleMarkdownLines } from './source-evidence.mjs'
import { git, ignoredState, repoState, showPrefix } from './git.mjs'

export const TREE_EVIDENCE_PROTOCOL = 'grovespec-tree-evidence/v1'
export const TREE_EVIDENCE_MODES = ['decomposition', 'fidelity']

export class TreeEvidenceError extends Error {}

const sha256 = value => createHash('sha256').update(value).digest('hex')
const normalizedText = text => splitLines(text).join('\n')

function sectionText (text, name, path) {
  const raw = splitLines(text)
  let lines
  try { lines = visibleMarkdownLines(text, path) } catch (e) {
    throw new TreeEvidenceError(e.message)
  }
  const start = lines.findIndex(entry => entry.headingEligible && new RegExp(`^##[ \\t]+${name}[ \\t]*$`).test(entry.line))
  if (start === -1) throw new TreeEvidenceError(`${path}: missing ## ${name} section`)
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].headingEligible && /^##[ \t]+/.test(lines[i].line)) { end = i; break }
  }
  const startLine = lines[start].n
  const endLine = end === lines.length ? raw.length + 1 : lines[end].n
  return raw.slice(startLine, endLine - 1).join('\n')
}

function readTask (P, file) {
  const text = P.read(file)
  if (text === null) throw new TreeEvidenceError(`${file}: Task disappeared while sealing the tree review`)
  return text
}

function taskIdentity (P, file, mode) {
  const text = readTask(P, file)
  const target = P.tidOf(file)
  if (mode === 'decomposition' && fmValue(text, 'status') === 'sketch') {
    let refs
    try { refs = taskRefAssignment(P, target) } catch (e) {
      throw new TreeEvidenceError(e.message)
    }
    return {
      target,
      sketch: normalizedText(text),
      refs: {
        mode: refs.mode,
        scope: refs.scope.map(({ file, location }) => ({ file, location }))
      }
    }
  }
  const common = {
    target,
    id: fmValue(text, 'id'),
    name: fmValue(text, 'name'),
    overview: sectionText(text, 'Overview', file)
  }
  if (mode === 'decomposition') {
    let refs
    try { refs = taskRefAssignment(P, target) } catch (e) {
      throw new TreeEvidenceError(e.message)
    }
    return {
      ...common,
      refs: {
        mode: refs.mode,
        scope: refs.scope.map(({ file, location }) => ({ file, location }))
      }
    }
  }
  return {
    ...common,
    origin: fmValue(text, 'origin'),
    contract: sectionText(text, 'Contract', file)
  }
}

// Exact filesystem inventory for fidelity's code criterion.  Paths, entry types,
// behavior-relevant mode bits and file bytes are bound; timestamps are deliberately
// not evidence. Symlinks fail closed: hashing only the link would miss changes to the
// followed code, while following one needs an explicit containment policy.
function entryFor (absolute, path, label) {
  let stat
  try { stat = lstatSync(absolute) } catch (e) {
    if (e.code === 'ENOENT') return null
    throw new TreeEvidenceError(`${label}/${path}: cannot read fidelity evidence (${e.message})`)
  }
  if (stat.isSymbolicLink()) {
    throw new TreeEvidenceError(`${label}/${path}: symlinks are not sealable fidelity evidence -- move the reviewed code into the configured tree`)
  }
  if (!stat.isFile()) {
    throw new TreeEvidenceError(`${label}/${path}: expected a regular file in the fidelity inventory`)
  }
  let bytes
  try { bytes = readFileSync(absolute) } catch (e) {
    throw new TreeEvidenceError(`${label}/${path}: cannot read file (${e.message})`)
  }
  return { path, type: 'file', mode: stat.mode & 0o777, sha256: sha256(bytes) }
}

function gitVisibleTree (P, root, label) {
  const prefix = showPrefix(P.root)
  if (prefix === null) throw new TreeEvidenceError(`${label}: git cannot locate the project while selecting fidelity evidence`)
  const projectArea = root.startsWith(`${P.root}/`) ? root.slice(P.root.length + 1) : null
  if (projectArea === null) throw new TreeEvidenceError(`${label}: configured fidelity path is outside the project`)
  const repoArea = `${prefix}${projectArea}`
  const listed = git(P.root, ['ls-files', '--full-name', '--cached', '--others', '--exclude-standard', '-z', '--', `:(top,literal)${repoArea}`])
  if (!listed.ok) throw new TreeEvidenceError(`${label}: git cannot enumerate tracked and non-ignored source files`)
  const paths = listed.out.split('\0').filter(Boolean)
    .filter(path => path === repoArea || path.startsWith(`${repoArea}/`))
    .sort()
  const entries = []
  for (const repoPath of paths) {
    const relative = repoPath === repoArea ? '.' : repoPath.slice(repoArea.length + 1)
    const entry = entryFor(`${P.root}/${repoPath.slice(prefix.length)}`, relative, label)
    if (entry !== null) entries.push(entry) // an unstaged tracked deletion is absent code
  }
  return { label, present: entries.length > 0, selection: 'git-visible', entries }
}

function rawFilesystemTree (root, label) {
  const entries = []
  const walk = (absolute, relative) => {
    let stat
    try { stat = lstatSync(absolute) } catch (e) {
      if (e.code === 'ENOENT' && relative === '') return false
      throw new TreeEvidenceError(`${label}${relative === '' ? '' : `/${relative}`}: cannot read fidelity evidence (${e.message})`)
    }
    const path = relative === '' ? '.' : relative
    if (stat.isSymbolicLink()) throw new TreeEvidenceError(`${label}/${path}: symlinks are not sealable fidelity evidence -- move the reviewed code into the configured tree`)
    if (stat.isDirectory()) {
      entries.push({ path, type: 'directory', mode: stat.mode & 0o777 })
      let names
      try { names = readdirSync(absolute).sort() } catch (e) {
        throw new TreeEvidenceError(`${label}/${path}: cannot list directory (${e.message})`)
      }
      for (const name of names) walk(`${absolute}/${name}`, relative === '' ? name : `${relative}/${name}`)
      return true
    }
    if (stat.isFile()) {
      let bytes
      try { bytes = readFileSync(absolute) } catch (e) {
        throw new TreeEvidenceError(`${label}/${path}: cannot read file (${e.message})`)
      }
      entries.push({ path, type: 'file', mode: stat.mode & 0o777, sha256: sha256(bytes) })
      return true
    }
    throw new TreeEvidenceError(`${label}/${path}: unsupported special filesystem entry`)
  }
  const present = walk(root, '')
  return { label, present, selection: 'all-files-no-git', entries }
}

function filesystemTree (P, root, label) {
  const state = repoState(P.root)
  if (state === 'broken') throw new TreeEvidenceError(`${label}: git state is unreadable, so the fidelity read scope cannot be selected safely`)
  if (state === 'repo') {
    const ignored = ignoredState(P.root)
    if (ignored === 'broken') throw new TreeEvidenceError(`${label}: git ignore state is unreadable`)
    if (ignored === 'yes') throw new TreeEvidenceError(`${label}: this project is ignored by its containing repository -- give it its own repository before the fidelity gate`)
    return gitVisibleTree(P, root, label)
  }
  // Before git exists there is no ignore authority. Bind every entry rather than
  // guessing language-specific cache names; once git exists, ignored outputs vanish
  // from the canonical reviewer scope while tracked + non-ignored new files remain.
  return rawFilesystemTree(root, label)
}

function optionalText (P, path, label) {
  const text = P.read(path)
  return text === null
    ? { label, present: false }
    : { label, present: true, text: normalizedText(text) }
}

export function treeEvidenceMode (P) {
  // A pristine mapped tree is the one fidelity moment.  Every other explicit tree
  // cycle (including a built tree reopened by revise) asks the decomposition question.
  return P.treeGateKind() === 'fidelity' ? 'fidelity' : 'decomposition'
}

export function treeEvidenceDigest (P, mode) {
  if (!TREE_EVIDENCE_MODES.includes(mode)) {
    throw new TreeEvidenceError(`tree_evidence_mode '${mode}' is invalid -- use ${TREE_EVIDENCE_MODES.join('|')}`)
  }
  const structure = treeRows(P.treeText()).map(({ tid, parent }) => ({ target: tid, parent }))
  const tasks = P.taskFiles().map(file => taskIdentity(P, file, mode))
  let evidence
  if (mode === 'decomposition') {
    const brief = P.read(P.briefPath)
    if (brief === null) throw new TreeEvidenceError(`${P.briefPath}: missing decomposition brief`)
    evidence = {
      mode,
      structure,
      brief: normalizedText(brief),
      tasks
    }
  } else {
    evidence = {
      mode,
      structure,
      tasks,
      code: [
        filesystemTree(P, P.srcDir, 'src'),
        filesystemTree(P, P.testsDir, 'tests')
      ],
      backlogs: [
        optionalText(P, P.findingsPath, 'findings'),
        optionalText(P, P.restructuringPath, 'restructuring')
      ]
    }
  }
  return sha256(`${TREE_EVIDENCE_PROTOCOL}\n${JSON.stringify(evidence)}`)
}
