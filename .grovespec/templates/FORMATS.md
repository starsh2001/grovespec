# GroveSpec artifact formats (the parser contract)

So that tools can read these files and process them mechanically, **the format is fixed**. Don't change header names·order, field names·types, or the date format on a whim. (This is itself GroveSpec's *contract* to outside tools.)

> **Machine source of truth:** the checkable lists (frontmatter fields · enums · sections) are defined in `.grovespec/schema` and enforced by `.grovespec/bin/grovespec.mjs validate`. This doc is the human-readable contract; the lists below mirror `schema` — if they ever differ, `schema` (what `validate` reads) wins. Edit `schema` first.

> Headers and field names are fixed and English. The *content* (prose) is written in the project's language (`config.language`).

> **How the prose is written.** Every artifact here is read by a **person and an agent, from the same file** — so write for a competent person who does *not* know this project and is reading it months later. This is the same bar the `non-expert` reviewer applies (C6), so writing to it is what gets a spec through:
> - **Plainest exact word wins.** Don't coin terms, labels, or tier names — say the thing. A term you genuinely can't avoid goes in `conventions.md` *Glossary*, and then it's always the same word (search finds letters, not meanings).
> - **Established names travel as names.** GroveSpec's and the stack's existing terms (cold review, skeleton, gate…) keep their established form in every output language — transliterated (콜드 리뷰) or kept in English — never re-invented as a translation (냉정 검토): an invented rendering is a second name for the same concept, and different runs will invent different ones.
> - **Register: a document vs. addressing the person.** Artifacts are documents — write them in the language's documentary register (Korean: plain `~한다`/`~이다`). The step report, and anything else spoken *to* the person, uses that language's respectful-address register — Korean: formal polite **`~합니다`/`~하겠습니다`**, not casual `~해요`, and never plain `~한다`, which addressed to a person reads as rude. Warmth lives in *what gets explained*, not in the endings. (The fixed setup-interview strings keep their own register.)
> - **No filler.** Cut anything that survives deletion — throat-clearing, a restated header, "it is important to note".
> - **Readable in one pass.** If a line needs a second read to parse, split it or cut it. Applies to the running record too: a Change-Log entry says *what changed and why* in a sentence, not a transcript.



## tasks/TASK-N.md
YAML frontmatter + fixed sections.

**frontmatter**

| field | type | value |
|---|---|---|
| `id` | string | `TASK-N` — immutable, same as the filename. New ids come from `grovespec id` (highest number that left a trace + 1: tree · files · gate records, plus convention subjects **and** task-file paths across every reachable ref); **a retired id is never reused** — its commits would become the new node's cycle diff. Unreachable history (deleted branch, rewritten commit) is beyond any tool's reach; the command says so |
| `name` | string | node name — may change (rename) |
| `role` | enum | `skeleton` \| `feature` |
| `status` | enum | `sketch` \| `draft` \| `approved` \| `implemented` \| `reviewed` \| `fixed` \| `done` |
| `blocked_by` | list | `[TASK-2, ...]`, `[]` if none |
| `tdd` | bool | `true` \| `false` |
| `tdd_skip_reason` | string | required when `tdd: false` |
| `origin` | enum, optional | `mapped` — brownfield only: born `done` from existing code (code-to-tree), no gate records behind it. Absent on every built node. |

**Status lifecycle** (defined here once — skills point here, don't restate). Each status = a completed gate; a node advances one skill at a time:
- `sketch` — **greenfield only.** Placed in the tree with a one-line responsibility + rough I/O, no full contract yet. Created by *init* (`spec-to-tree`) for the whole tree at once. Detailed into `draft` by *grow*. (Brownfield nodes skip this — they're born `done`.)
- `draft` — full contract written (by *grow* detailing a sketch, or by *revise*). A grounded hypothesis, not yet verified.
- `approved` — spec passed *verify* (cold multi-persona) + human-approved → ready to implement. *verify* sets this.
- `implemented` — code written by *implement*; the node's own tests pass. Not yet reviewed.
- `reviewed` — code passed *review* (tests + cold code personas on the diff). Awaiting human confirm, or `fix` if issues remain.
- `fixed` — *fix* applied review's issues; needs another *review*. Ping-pongs `reviewed ⇄ fixed` until clean.
- `done` — reviewed clean + human-confirmed. A `done` skeleton's children (already sketched) are now unblocked to detail.

A greenfield node is born at `sketch` (the whole tree, mapped by *init* from the detailed spec); *grow* details it to `draft`. A brownfield node is born at `done` (existing code, mapped by *code-to-tree*). **`sketch` and `draft` are pre-commitment** — not yet verified, so you edit or delete them *freely* (edit the file, or drop it from `tree.md`): no skill call, no propagation. **Commitment begins at `approved`** (verify passed): from there a change goes through *revise*, and propagates to consumers if the contract moved. *revise* reopens a `done` node to the earliest status its change touches: `draft` if the spec/contract changes (needs re-verify), else `approved` (spec still valid → re-implement → re-review).

**`role` & decomposition** — `role` says whether the node has children:
- `skeleton` — has children (a container/dispatch holding sub-nodes); greenfield, its children are **already sketched** in the tree (from init), detailed one at a time after this node is `done`.
- `feature` — a leaf: terminal behavior, no children.

`role` starts as a hypothesis (from the sketch), is scrutinised at `verify`, and is **confirmed by `implement`** — building the node reconciles its *sketched* children against reality: a sketched child that's now wrong is revised/dropped, a newly-revealed one is added as a sketch. The confirmed **decomposition** is recorded in the node's **Change Log**. Turning a `done` `feature` into a `skeleton` later (it grew to need children) is a *revise*.

**body sections** — this order, all `##`:
`Overview` · `Requirements` · `Contract` · `AC` · `Subtasks` · `Change Log`
- `Contract`: states what a consumer can **observe and rely on** (takes·gives·guarantees — public names, boundary shapes, errors, ordering, observable atomicity), never the unobservable inside (algorithms · private structure · how a transaction is done); may carry **deferral markers** `[→ child/deferred: <what>]` for detail intentionally left to a child or to implement — correct delegation, not a gap (verify treats a marked deferral as resolved; markers seed grow).
- `AC`·`Subtasks`: `- [ ]` / `- [x]` checkboxes. An AC item prefixed **`(gap)`** marks behavior *deliberately left undefined* (the spec/code is silent there): *verify* probes it (resolved into behavior, or adjudicated `accepted-gap` — then the item stays, and the Change-Log adjudication stops re-litigation); *implement* builds nothing for it; *review* excludes it from the every-AC-has-a-test mapping. A later *revise* turns a gap into behavior.
- `Change Log`: `- YYYY-MM-DD — text` (ISO date). `text` = **what changed and why, in one plain sentence** a newcomer can follow — not a transcript of the review. Written at every step that touches the node (`verify` approve · `implement` decomposition · `review` done · each `revise`), so it is the running record a person reads to understand why the node is the way it is: the prose rule above applies to it as much as to the Contract.

## tree.md
2-space indented list. Items are `id` only. Indent depth = tree depth.
```
- TASK-1
  - TASK-2
```
The single source of truth for parent-child structure. (Task files don't record their parent.)
**It holds every node that has a task file** — greenfield, that's the whole tree from init (the `sketch` nodes too); a node's id and its task file appear together. (implement may drop or add a sketched child when it reconciles the decomposition against the build, so the tree still reflects the present.) `grovespec validate` requires every id here to have a task file and vice-versa.

## brief.md
frontmatter `name`. Sections (`##`, fixed): `Direction` · `Scope` · `Risks`.

## conventions.md
Sections (`##`, fixed): `Glossary` · `Common Rules`.

## ref/ — the intent-record series
ref/ holds **frozen intent records** — plan #0's detailed spec, then one *dated* record per later planning pass (its new wants, deltas, and the confirmed disposition table). **Never edit an existing record**: a later record states *deltas only*, each naming what it supersedes ("this section replaces spec.md §4.1's X"). A wrong intent is a new record, not an edit — the series is the history of intent (the brief stays the current summary; Change Logs hold each node's history).

## ref-index.md
Table. Fixed columns: `Topic | File | Location`. **The living catalog over the frozen series**: when a later record supersedes a section, the *index row* moves to the current record — records never change, the index does. Readers (grow · verify) reach ref *through the index*, so they always read current truth.

## findings.md / restructuring.md  (brownfield backlog — optional)
Lightweight checklists `code-to-tree` parks while mapping existing code into the all-`done` tree; they hold what's *wrong with* that reality, kept **out** of the tree and **worked off in rounds by `grovespec-plan`** (a single item may go straight to `grovespec-revise`). **Not** strict frontmatter artifacts — documented here but deliberately **not** in `.grovespec/schema`/`validate` (a checklist-shaped optional backlog; strict validation would be ceremony). Created only when non-empty (absent for greenfield or clean code). Content in `config.language`; a board may read them as draft issues.
- **findings.md** — node-level. `##` sections: `Bugs` · `Duplications` · `Doc ↔ code mismatches`. Each item a `- [ ]` line naming *where* + the resolving step (`grovespec-revise`, or extract via `grovespec-grow`). Template `.grovespec/templates/findings.md`.
- **restructuring.md** — tree-level structural debt. A flat `- [ ]` list, each naming the structural problem + the proposed `grovespec-revise` split·merge·move. Template `.grovespec/templates/restructuring.md`.

## config.yaml
Location: `.grovespec/config.yaml`. Keys: `version`, `language`, `paths` (`brief·tree·conventions·tasks·ref·findings·restructuring·src·tests·review` — only the locations are changeable; the structure is fixed; `findings·restructuring` are brownfield-optional). **Every path is relative, inside the project, and spelled as the filesystem spells it** (case included): absolute · drive-relative (`C:src`) · `..` escaping the project · the project root itself (`.`) are refused, because these paths are compared against git's own output and a spelling git never prints reads as "nothing to report" rather than as an error. `./x/`, `x//`, `a/../x` are accepted (one canonical form). Also: `verify` (`strength` 1–3 · `max_rounds` · `scale` · optional `models` — the spec cold-review) and `review` (`strength` · `max_rounds` · `scale` · `test` command · optional `models` — the code diff-review). `models` (optional, either block) maps a lens name — or `default` / `triage` — to a host-accepted model id; **omit it and every reviewer inherits the session model** (the portable default). A configured id the host cannot select is an explicit stop, never a silent fallback to another model.

## Commits (the node diff boundary)
**Every step and every decision turn ends by committing what it wrote — whatever the outcome, whatever the target.** A pass, an **escalate stop** (`<step> TASK-N: escalated — …` · tree: `verify tree: escalated — …`) and a decision all commit the same way; a node and the tree alike. The step is not finished while its output sits only in the working tree, and an escalated record is exactly what the human ruling will read. The table names the shapes; the skills' enumerations are examples, never fences:

| step | commit subject | why this shape |
|---|---|---|
| `implement` · `fix` | **`TASK-N: <step> — <summary>`** | the `TASK-N: ` prefix is the **cycle-diff anchor**: these are the commits `diff` collects |
| `grow` · `verify` · `review` · `revise` · `plan` · `init` — the gate flip, an escalate stop, any non-cycle step | **`<step> TASK-N: <summary>`** (`grow TASK-3: …`, `verify TASK-3: …`, `revise TASK-3: …`; tree gate: `verify tree: …`; no node: `plan #N: …` · `init: …`) | the step name comes *first* precisely so it does **not** match `^TASK-N: ` — a spec-cycle commit inside the code cycle's anchor drags spec edits into the diff a cold round reads |
| a **decision turn** — `approve [--human]` · `ratify` run on their own | **`approve TASK-N: <summary>`** · `approve tree: …` · `ratify TASK-2 TASK-5: …` (one commit may name every id the run stamped) | approve writes the Task status *and* the record, ratify the record, both *after* any gate commit — those bytes need an owner too, in the same non-anchor shape |

A step's commit carries **everything that step produced** — the enumerations in the skills are examples, not fences: anything else the step wrote goes in the same commit. For a gate that means its record under `paths.review`: the yaml plus **every round file of this cycle not yet in git** (brief/judge/confirm files, the test log — a verify cycle has no fix commits, so the gate commit is the only ride those files get). A gate whose evidence never enters git is a verdict whose subject is one clean-up away from gone. `validate` notices an untracked **passed** record yaml on every run; an escalated record and the round files ride on this rule alone — nothing warns about them. (Measured: two records passed their gates and stayed untracked for the rest of a run, because `git add src tests` was the habit.)

A node's **cycle diff** — what *review* reads — is everything since the parent of the cycle's first `TASK-N:` commit, plus uncommitted changes, limited to the node's files. A cycle starts when the node leaves `approved`; a *revise* reopening starts a new cycle. (*implement* starts from a clean working tree, so nothing unrelated blurs the boundary.) `grovespec diff TASK-N` is the one mechanical derivation of this — skills read the cycle from it, never assemble it by hand.

**The gate records are held out of that diff.** A *fix* commit rightly carries the round record it just updated — so `diff` excludes everything under `paths.review` (counted in the output, never named — a filename alone tells a cold reader which record to go open). That is why `paths.review` may not overlap any other configured path: everything in its region is held, so an overlap would hide real code under a held-out count. `validate` refuses such a config. Otherwise the next **cold** round opens the diff and reads the previous rounds' verdicts, reasons and dropped findings, and the blankness the method rests on is gone before it reads a line of code. Commit discipline cannot close this one: the record belongs in that commit; the diff is what must exclude it.

## review-cycle state (verify & review)
*verify* (spec) and *review* (code) each run the cold-reviewer cycle and keep state at `paths.review` (default `.grovespec/review/`). Because both act on the **same** node id at different stages, they write **separate** files so they never collide:
- `tree.verify.yaml` — the **decomposition** cycle (`target_type: tree`): a one-time cold review of the whole greenfield sketch tree at init, before any node is built.
- `<id>.verify.yaml` — the spec-verification cycle (`target_type: spec`).
- `<id>.review.yaml` — the code-review cycle (`target_type: result`, diff-scoped).

Fields (all): `target`, `target_type` (`tree|spec|result`), `level` (`skip|light|standard|full`), `strength` (1–3), `repeat` (minimum find waves — the recall floor), `max_rounds`, `round` (total spawned passes), `consecutive_passes` (legacy bookkeeping — no rule reads it since 0.8.0), `phase` (`find|judge|fix` — the cycle's three phases: find waves over a frozen target → ONE judge pass over everything found → fix + per-fix confirmation; `reviewers.md` §The cycle), `status` (`in-progress|passed|escalated` — **`escalated` means one thing: the cycle spent `max_rounds` without closing, so a human must rule.** Confirmed defects inside the budget are `in-progress`/`reviewed` + `open_issues`, which is ordinary progress into the fix step; `validate` refuses `escalated` at a round inside `max_rounds`, because that word stops an auto loop over work the machine could have done), `approved_by` (`pending|human|machine`), `strategies[]` (the find ledger), `found[]` (raw finds, judged once), `checks[]` (verify/tree: the C#/D#/F# table with shown evidence + basis — what a resumed session reads find's progress from), `rounds[]` (per-pass outcome: `n` · `outcome` required, `phase` · `found` · a **one-line** `note` optional — the pass's reasoning lives in its own round file (`<id>.round<n>.brief.md` · `.judge.md` · `.confirm.md`) and the note points at it. An entry is **flat**: every field on one line at the entry's own indent, `found` written as a one-line flow map. `validate` reads depth, so a block scalar, a plain multi-line scalar and a nested mapping are each refused, as is any field the schema doesn't list). **Every list in this record is block style** — one `- ` item per line; a flow list (`followups: [ {...} ]`) is refused, because these records are read line by line and flow style switched every per-item check off silently rather than failing it (`[]` for an empty list is fine), `open_issues[]`, `followups[]`, `adjudications[]`, plus the seal fields below. Template: `.grovespec/templates/review-state.yaml`. **A record is evidence only for the node its filename names** — `validate` requires filename ↔ `target` ↔ `target_type` to agree, and flags an orphan record (no such task).

**The gate binding model.** A gate's verdict must say *who decided it, which bytes it covers, and (for code) which run proved it* — and each binding is written **at the moment it becomes true**, by the runtime:

- **Seal — `grovespec pin` at the cycle's pass.** When a cold cycle terminally passes, the gate skill runs `pin TASK-N` (spec: `spec_digest` into `<id>.verify.yaml` · result: `reviewed_commit` (HEAD) + `spec_digest` into `<id>.review.yaml`) or `pin tree` (`tree_digest` — the parsed structure, so indentation/comments don't invalidate an approval but a moved/added/removed node does). The seal also marks the verdict `approved_by: pending`: *a verdict exists; nobody has decided on it.* The spec digest has **one spelling** (`bin/lib/core.mjs specSpanText`): sha256 over the `## Overview` … `## AC` sections (headers included, CRLF-normalized) — frontmatter, Subtasks and Change Log are excluded because status flips, checkbox ticks and log appends are legitimate after approval.
- **Decide — `grovespec approve` writes no evidence.** It verifies the seal still covers the *current* bytes (spec digest match; result: the code at `reviewed_commit` is the code at HEAD) and only then flips the Task status and stamps `approved_by`: `--human` (the person's judgment — the skills' approve/confirm step runs this; **never hand-edit a status**) or machine (auto mode). The result binding is on **the code, not on the commit's name**: HEAD may have moved since the seal as long as nothing under src/tests did — the same coordinates the clean-tree check uses, so both halves of "is the tested code the current code?" measure the same paths. A moved code path is named in the refusal, as is a seal that is not a canonical full commit id or not an ancestor of HEAD. (Committing the passing record is what the workflow *asks* for; while this compared commit ids, that commit destroyed the seal it was recording and left no path to `done` for machine or human alike.) A **machine result approval additionally requires** a recorded green test run bound to exactly this code: `last_test` with `exit: 0` and a `commit` that covers HEAD by the same rule, and no uncommitted src/tests changes. `approve` refuses an escalated record, open issues, a legacy record, an unsealed record, and any binding mismatch. `approve tree` is **human-only in every mode**. All checks run before any write; an interrupted approval (status flipped, record still `pending`) is named by `validate` and completed by re-running `approve`.
- **Reopen — `grovespec reopen TASK-N draft|approved`** (revise's transition): the gate records restart as fresh cycles, so a past cycle's `passed` can never double as the new cycle's evidence; `reviewed_commit` survives as the next `diff`'s base, and **`adjudications` survive in the record itself** (a settled call is a boundary, not evidence — before the next round the caller prunes entries whose written reason leaned on the old substrate: the old contract on a `draft` reopen, code that no longer exists on a `result` reopen). Everything else — old rounds, open issues, followups, narrative — lives on in git history.

**`approved_by` states.** `pending` = sealed verdict awaiting a decision (this — and only this — is what `status`/`next` show as *waiting on you*, and what `approve` will decide). `human` / `machine` = decided; every machine-taken gate is named by `status`/`validate` until `grovespec ratify <id>…` stamps it `human`. **Absent = legacy** (written before this model): it binds nothing — not shown as awaiting, not approvable; re-run the gate to seal a fresh cycle. The tree gate opens only on `human` (legacy tree records stay open for old projects).

**Evidence outside git.** A record that passed a gate but is not tracked is a verdict whose subject is one clean-up away from gone. `validate` says so as a **notice, never a problem**: a record is born untracked and every gate passes before anything stages it, so blocking there would fail at the moment each gate first succeeds. The line reprints every run until the record is added, the same way an unratified machine gate keeps reprinting.

**Status ↔ evidence.** A Task's `status` is a claim about gates passed, and `validate` checks the claim against these records: `approved`+ requires `<id>.verify.yaml` `passed` and not `pending`; `done` also requires `<id>.review.yaml` `passed` and not `pending`; a `passed` record may not still carry `open_issues`; a machine-approved `done` must show its bound green `last_test`. `origin: mapped` nodes with **no** review files are exempt — brownfield init maps existing code straight to `done`; the rules bind from the first gate a reopened node enters.

**`last_test` + `<id>.test.log`.** `grovespec test TASK-N` runs `config.review.test` and writes the machine record itself: a `last_test:` block in `<id>.review.yaml` (`command` · `exit` · `when` · `commit` — the HEAD it ran on) plus the full output in `<id>.test.log`. "The tests passed" is this record — including *which code* it passed on — not a session's reading of its scrollback.

## The step report (what a skill says to the person)

Every step skill **opens and closes in the same shape**, so the person finds the same information in the same place on every run — a human gate only works if the report feeding it reads the same way the tenth time as the first. The labels are fixed English (like every header in this file); the prose between them is written in `config.language`, **warmly and in full sentences** (in the language's respectful-address register — the writing rules at the top of this file), for the same reader as the setup interview — someone who may not code. The artifact rules at the top of this file cut filler because artifacts are re-read; a report is spoken once to *orient a person*, so here the explanation is the payload — never compress it into a telegram line ("R2 pass, no issues" fails this format even when it's true).

**Opening** — the first message when the skill starts:
```
[grovespec <skill> <target>] starting
```
followed by a short paragraph (2–4 sentences): what this step is for, in plain words — even if the person has seen it ten times; what it is about to do on this target; and what the person will have when it ends.

**Closing** — the last message of the run: the anchor line, then all four slots, this order, no slot ever dropped (an empty slot is information — write the sentence that says so):
```
[grovespec <skill> <target>] done — <the outcome in half a line>
Result: <what actually happened, with its evidence — rounds, tests, counts, decisions taken.>
Open: <what this step leaves unresolved — open issues, parked findings, accepted gaps, unverified targets. "Nothing open" is a claim: say it only checked.>
Your turn: <what now waits on the person — the substance itself: what it is, the issue in one line, what's needed. A file path or command comes after the substance, never instead of it. If nothing waits, say what that means for the flow.>
Next: <the next step and where to run it — including the new-session recommendation when the workflow calls for one.>
```
A run that ends without reaching its normal end (escalated · blocked · refused) closes the same way with **`stopped — <why>`** instead of `done`. The structure is what's fixed; the content must be **this run's facts** — every sentence checkable against what just happened, no stock reassurance.

Filled, it reads like this (prose in the project's language):
```
[grovespec review TASK-3] done — cycle closed: 2 find waves · 3 of 9 finds confirmed · fixes verified, 14/14 tests green
Result: All 14 tests pass. Two cold find waves exhausted the strategy ledger; the judge kept 3 of the 9 raised finds and dropped the rest with reasons; the fixes closed all 3, and the confirmation round on the fix diff came back clean. The gate record is sealed to exactly this code.
Open: Nothing is left open on this node — the confirmed list is empty, and the drops are condensed into do-not-raise.
Your turn: The last word is yours: if this result matches what you wanted from TASK-3, approve it with `grovespec approve TASK-3 --human` and the node is done.
Next: Once approved, TASK-4 is ready to grow — best started in a fresh session, so its reviewers stay cold.
```
