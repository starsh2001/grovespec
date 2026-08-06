// approve / ratify — the two ends of a machine-taken gate.
//
// `approve` exists ONLY for the auto-run mode: it takes the gate that is due on a node
// (draft → approved, reviewed → done) and records that a MACHINE took it. It refuses
// anything that did not come out clean, because auto-approving a round the machine itself
// reported as escalated — or one that still lists open issues — is not approving work,
// it is deleting findings.
//
// `ratify` is the human coming back: the same records, stamped as theirs. Until then every
// run says so out loud (status · validate), so "approved" never quietly means "nobody looked".
import { writeFileSync } from 'node:fs'
import { topValue, listItemCount, setFmValue } from './core.mjs'
import { cmdPin } from './cmd-pin.mjs'

const say = s => process.stdout.write(s + '\n')

function upsertTop (text, key, value) {
  const lines = text.split('\n')
  const re = new RegExp(`^${key}[ \\t]*:`)
  const i = lines.findIndex(l => re.test(l.replace(/\r$/, '')))
  if (i === -1) return `${text.replace(/\n*$/, '')}\n${key}: ${value}\n`
  lines[i] = `${key}: ${value}${lines[i].endsWith('\r') ? '\r' : ''}`
  return lines.join('\n')
}

export function cmdApprove (P, n) {
  if (n === '') { say('usage: grovespec approve TASK-N'); return 2 }
  const taskText = P.read(P.taskPath(n))
  if (taskText === null) { say(`no such node: ${n}`); return 2 }

  const st = P.statusOf(n)
  let record, target, label
  if (st === 'draft') { record = P.verifyYamlPath(n); target = 'approved'; label = 'spec' }
  else if (st === 'reviewed') { record = P.reviewYamlPath(n); target = 'done'; label = 'result' }
  else {
    say(`${n}: no gate is due at status '${st}' — approve takes a due gate (draft → approved, reviewed → done)`)
    return 2
  }

  const text = P.read(record)
  if (text === null) { say(`${n}: no ${label} record (${record} missing) — run the cold gate first`); return 2 }
  const rst = topValue(text, 'status')
  if (rst !== 'passed') {
    say(`${n}: its ${label} record is '${rst === '' ? 'unset' : rst}', not passed — a gate that did not come out clean is never taken automatically`)
    return 2
  }
  if (listItemCount(text, 'open_issues') > 0) {
    say(`${n}: its ${label} record still lists open issues — clear them (grovespec-fix), never approve past them`)
    return 2
  }

  const flipped = setFmValue(taskText, 'status', target)
  if (flipped === null) { say(`${n}: cannot set status — frontmatter malformed (run grovespec validate)`); return 2 }
  writeFileSync(record, upsertTop(text, 'approved_by', 'machine'))
  writeFileSync(P.taskPath(n), flipped)
  P.forget()

  say(`approved by machine: ${n} ${st} → ${target} (${label} gate) — NOT human-approved; ratify it when you have looked`)
  return cmdPin(P, n)
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
      writeFileSync(p, upsertTop(P.read(p), 'approved_by', 'human'))
    }
    say(`ratified: ${n} (${labels.join(' · ')})`)
  }
  P.forget()
  return 0
}
