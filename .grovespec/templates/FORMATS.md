# GroveSpec artifact formats (the parser contract)

So that tools can read these files and process them mechanically, **the format is fixed**. Don't change header names·order, field names·types, or the date format on a whim. (This is itself GroveSpec's *contract* to outside tools.)

> **Machine source of truth:** the checkable lists (frontmatter fields · enums · sections) are defined in `.grovespec/schema` and enforced by `.grovespec/bin/grovespec.mjs validate`. This doc is the human-readable contract; the lists below mirror `schema` — if they ever differ, `schema` (what `validate` reads) wins. Edit `schema` first.

> Headers and field names are fixed and English. The *content* (prose) is written in the project's language (`config.language`).

> **How the prose is written.** Every artifact here is read by a **person and an agent, from the same file** — so write for a competent person who does *not* know this project and is reading it months later. This is the same bar the `non-expert` reviewer applies (C6), so writing to it is what gets a spec through:
> - **Plainest exact word wins.** Don't coin terms, labels, or tier names — say the thing. A term you genuinely can't avoid goes in `conventions.md` *Glossary*, and then it's always the same word (search finds letters, not meanings).
> - **No filler.** Cut anything that survives deletion — throat-clearing, a restated header, "it is important to note".
> - **Readable in one pass.** If a line needs a second read to parse, split it or cut it. Applies to the running record too: a Change-Log entry says *what changed and why* in a sentence, not a transcript.



## tasks/TASK-N.md
YAML frontmatter + fixed sections.

**frontmatter**

| field | type | value |
|---|---|---|
| `id` | string | `TASK-N` — immutable, same as the filename |
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
- `Contract`: states the contract (takes·gives·guarantees), **not** the mechanism; may carry **deferral markers** `[→ child/deferred: <what>]` for detail intentionally left to a child or to implement — correct delegation, not a gap (verify treats a marked deferral as resolved; markers seed grow).
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

## ref-index.md
Table. Fixed columns: `Topic | File | Location`.

## findings.md / restructuring.md  (brownfield backlog — optional)
Lightweight checklists `code-to-tree` parks while mapping existing code into the all-`done` tree; they hold what's *wrong with* that reality, kept **out** of the tree. **Not** strict frontmatter artifacts — documented here but deliberately **not** in `.grovespec/schema`/`validate` (a checklist-shaped optional backlog; strict validation would be ceremony). Created only when non-empty (absent for greenfield or clean code). Content in `config.language`; a board may read them as draft issues.
- **findings.md** — node-level. `##` sections: `Bugs` · `Duplications` · `Doc ↔ code mismatches`. Each item a `- [ ]` line naming *where* + the resolving step (`grovespec-revise`, or extract via `grovespec-grow`). Template `.grovespec/templates/findings.md`.
- **restructuring.md** — tree-level structural debt. A flat `- [ ]` list, each naming the structural problem + the proposed `grovespec-revise` split·merge·move. Template `.grovespec/templates/restructuring.md`.

## config.yaml
Location: `.grovespec/config.yaml`. Keys: `version`, `language`, `paths` (`brief·tree·conventions·tasks·ref·findings·restructuring·src·tests·review` — only the locations are changeable; the structure is fixed; `findings·restructuring` are brownfield-optional), `verify` (`strength` 1–3 · `max_rounds` · `scale` · optional `models` — the spec cold-review) and `review` (`strength` · `max_rounds` · `scale` · `test` command · optional `models` — the code diff-review). `models` (optional, either block) maps a lens name — or `default` / `triage` — to a model; **omit it and every reviewer inherits the session model** (no forced cost).

## Commits (the node diff boundary)
Commits made while working a node are prefixed **`TASK-N: `** (`TASK-3: implement — …`, `TASK-3: fix — …`); *implement* and *fix* each **end with one**. A node's **cycle diff** — what *review* reads — is everything since the parent of the cycle's first `TASK-N:` commit, plus uncommitted changes, limited to the node's files. A cycle starts when the node leaves `approved`; a *revise* reopening starts a new cycle. (*implement* starts from a clean working tree, so nothing unrelated blurs the boundary.) `grovespec diff TASK-N` is the one mechanical derivation of this — skills read the cycle from it, never assemble it by hand.

## review-cycle state (verify & review)
*verify* (spec) and *review* (code) each run the cold-reviewer cycle and keep state at `paths.review` (default `.grovespec/review/`). Because both act on the **same** node id at different stages, they write **separate** files so they never collide:
- `tree.verify.yaml` — the **decomposition** cycle (`target_type: tree`): a one-time cold review of the whole greenfield sketch tree at init, before any node is built.
- `<id>.verify.yaml` — the spec-verification cycle (`target_type: spec`).
- `<id>.review.yaml` — the code-review cycle (`target_type: result`, diff-scoped).

Fields (all): `target`, `target_type` (`tree|spec|result`), `level` (`skip|light|standard|full`), `strength` (1–3), `repeat`, `max_rounds`, `round`, `consecutive_passes`, `status` (`in-progress|passed|escalated`), `rounds[]` (per-round outcome), `open_issues[]`, `adjudications[]`. Template: `.grovespec/templates/review-state.yaml`.

**Status ↔ evidence.** A Task's `status` is a claim about gates passed, and `validate` checks the claim against these records: `approved` or beyond requires the node's `<id>.verify.yaml` with `status: passed`; `done` also requires `<id>.review.yaml` with `status: passed`; a `passed` record may not still carry `open_issues`. `origin: mapped` nodes with **no** review files are exempt — brownfield init maps existing code straight to `done`; the rules bind from the first gate a reopened node enters.

**`last_test` + `<id>.test.log`.** `grovespec test TASK-N` runs `config.review.test` and writes the machine record itself: a `last_test:` block in `<id>.review.yaml` (`command` · `exit` · `when`) plus the full output in `<id>.test.log`. "The tests passed" is this record, not a session's reading of its scrollback.

**`approved_by` — who took the gate.** Absent means a human did (the normal path, and every record written before this field existed). `machine` is written *only* by `grovespec approve`, the auto-run mode's gate: it flips the status and marks that nobody looked. `status` and `validate` list every unratified one on every run, and `grovespec ratify <id>…` is the human coming back — it stamps `human`. An auto-approved node is a real state, never a human-approved one; the two must stay distinguishable in the file, or "approved" stops meaning anything. `approve` refuses an escalated record or one carrying open issues.

**Pins — `spec_digest` · `reviewed_commit`.** Written only by `grovespec pin TASK-N`: at approve, the spec digest into `<id>.verify.yaml`; at done-confirm, the reviewed commit (HEAD) + spec digest into `<id>.review.yaml`. The digest has **one spelling** (`bin/lib/core.mjs specSpanText`): sha256 over the `## Overview` … `## AC` sections (headers included, CRLF-normalized) — frontmatter, Subtasks and Change Log are excluded because status flips, checkbox ticks and log appends are legitimate after approval. `validate` flags a mismatch as a stale spec (the verdict no longer covers these bytes), and `diff` uses `reviewed_commit` as the previous cycle's closing line. A record without a digest is **legacy-unbound** — preserved, binds nothing.
