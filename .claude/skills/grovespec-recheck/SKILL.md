---
name: grovespec-recheck
description: The reach check — when a contract change lands (its node back at done), ONE step judges every armed candidate dependent together, and it judges exactly one question, does the change reach this node's use? Untouched candidates close in place (their done and seals were never disturbed); only judged-touched nodes reopen — the touched verdict reopens them itself. Use when `grovespec next` names recheck, or the user asks to "judge the candidates / run the reach check / grovespec recheck / 후보 점검 / 영향 검사".
---

# grovespec-recheck

One step for the whole armed set — the candidate lane's judge (why and the measured cost of the old mass-reopen: METHODOLOGY §6). It answers **one question per candidate — does the origin's contract change reach this node's use? — and does nothing else**: no fixes, no spec edits, no reviews of anything the question doesn't need.

> **Language**: read `config.language` (`node .grovespec/bin/grovespec.mjs lang`) and write every reply and the record in it. These files are English; your output is not.

> **The asymmetry rule**: a false "untouched" is the silent drift this method exists to stop; a false "touched" costs one cheap revise cycle. When a wave cannot show *why* the change misses a use, the candidate is touched.

## Steps

### 1. Read the floor
**Claim the tree:** `node .grovespec/bin/grovespec.mjs claim tree recheck` — non-zero = **stop** and report what it printed. Then run **`node .grovespec/bin/grovespec.mjs recheck`** — the armed candidates, each with its origin, its declared need, and the machine's reach line. That line is **material for the waves, never a verdict**:
- **`machine: uses …`** — the exact names to open first in the use-site wave.
- **`machine: names unfound`** / **`machine: unknown`** — a reason the grep saw nothing, not a proof of non-use: a consumer of the *old* (renamed) name, or one coupled through a file or shared state, greps as absent while actually broken (measured — METHODOLOGY §6). **Nothing closes here** — every candidate goes to the waves.

### 2. The waves — differently-armed, ended by the streak
Judge every candidate in waves until **`verify.find_streak` consecutive waves confirm no new touched candidate** (the same rule every gate uses; a wave that finds one resets the count). Consecutive waves must be **differently-armed** — identically-armed repetition measures luck, not coverage (METHODOLOGY §6, v0.8 measured). Two arms that fit this question:
- **use-site wave**: open the candidate's footprint files at every use of the origin's names; for each use, show whether the changed clause alters what that line receives, returns, or assumes.
- **behavior wave**: take the origin's changed behavior (the declared `need`) and walk it through the candidate's role end-to-end — a change can reach a node through timing, ordering or state without touching a name (the class the launcher's recovery change was: no renamed symbol, a changed state flow).

Each wave writes its finding per candidate: **untouched** (with the shown miss — not "looks fine") or **touched** (with the reached use named).

### 3. Settle every candidate
A verdict settles one (candidate, origin) pair — when a candidate has two armed origins, name the one judged: `recheck close|open TASK-N TASK-FROM "…"`.
- **Untouched** → `grovespec recheck close TASK-N "<the shown reason>"` — its done and its seals were never disturbed; the verdict is the record.
- **Touched** → `grovespec recheck open TASK-N draft|approved "<the reached use>"` — the verdict **reopens the node itself**: `draft` when the reached use needs its spec to change, `approved` when only its code does; unsure → `draft`, the wider lane. Then add one Change Log line to that node — the origin and the reached use: its next step (verify for draft, implement for approved) reads it there. **The lane repeats one layer down**: if that node's own cycle changes *its* Contract, its dependents become candidates the same way (`recheck declare`) — never mass reopens.

### 4. The record, then the commit
Write **`<paths.review>/recheck-N.md`** (N = 1 + the highest existing): frontmatter `origins:` (the from-nodes judged), then per candidate the machine line, each wave's finding, and the settle. **Commit as `recheck #N: <one-line summary>`** — the record, the settled ledger (`.grovespec/candidates.yaml`), and each reopened node's Task and reset gate records — nothing else. Then release the tree: `node .grovespec/bin/grovespec.mjs claim release tree`.

> **Open and close in the step-report shape** (`FORMATS.md` "The step report"). *Your turn* typically carries: the nodes judged touched and now reopened (their cycles are the next steps) · nothing, when all closed untouched.

> **Cold means cold**: the session judging reach must not be the one that made the contract change (WORKFLOW §5) — the author's "surely this reaches nobody" is the judgment this step exists to replace.
