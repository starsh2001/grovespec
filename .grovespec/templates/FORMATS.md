# GroveSpec artifact formats (the parser contract)

So that tools can read these files and process them mechanically, **the format is fixed**. Don't change header names·order, field names·types, or the date format on a whim. (This is itself GroveSpec's *contract* to outside tools.)

> **Machine source of truth:** the checkable lists (frontmatter fields · enums · sections) are defined in `.grovespec/schema` and enforced by `.grovespec/bin/grovespec validate`. This doc is the human-readable contract; the lists below mirror `schema` — if they ever differ, `schema` (what `validate` reads) wins. Edit `schema` first.

> Headers and field names are fixed and English. The *content* (prose) is written in the project's language (`config.language`).

## tasks/TASK-N.md
YAML frontmatter + fixed sections.

**frontmatter**

| field | type | value |
|---|---|---|
| `id` | string | `TASK-N` — immutable, same as the filename |
| `name` | string | node name — may change (rename) |
| `role` | enum | `skeleton` \| `feature` |
| `status` | enum | `draft` \| `approved` \| `implemented` \| `reviewed` \| `fixed` \| `done` |
| `blocked_by` | list | `[TASK-2, ...]`, `[]` if none |
| `tdd` | bool | `true` \| `false` |
| `tdd_skip_reason` | string | required when `tdd: false` |

**Status lifecycle** (defined here once — skills point here, don't restate). Each status = a completed gate; a node advances one skill at a time:
- `draft` — spec just written by *init* (the root) or *grow* (a child). Not yet verified.
- `approved` — spec passed *verify* (cold multi-persona) + human-approved → ready to implement. *verify* sets this.
- `implemented` — code written by *implement*; the node's own tests pass. Not yet reviewed.
- `reviewed` — code passed *review* (tests + cold code personas on the diff). Awaiting human confirm, or `fix` if issues remain.
- `fixed` — *fix* applied review's issues; needs another *review*. Ping-pongs `reviewed ⇄ fixed` until clean.
- `done` — reviewed clean + human-confirmed. A `done` skeleton's children can now be grown.

A node is born at `draft` (created by *grow*/*init*) — there is **no** pre-spec status: a node that isn't grown yet has no task file and is **not** in `tree.md` at all; it exists only as an entry in its parent's decomposition (the parent's Change Log — see *role* below). It enters `tree.md` at `draft` the moment *grow* creates it. *revise* reopens a `done` node by setting it back to the earliest status its change touches: `draft` if the spec/contract changes (needs re-verify), else `approved` (spec still valid → re-implement → re-review).

**`role` & decomposition** — `role` says whether the node has children:
- `skeleton` — has children (a container/dispatch holding sub-nodes); its children are grown later, one at a time.
- `feature` — a leaf: terminal behavior, no children.

`role` starts as a hypothesis at `draft`, is scrutinised at `verify`, and is **confirmed by `implement`** (building the node reveals whether it really needs children). A `skeleton`'s **decomposition** — which children it needs, and which clause of its Contract each child owns — is recorded in the node's **Change Log** (not in child task files: those don't exist until each child is grown). Turning a `done` `feature` into a `skeleton` later (it grew to need children) is a *revise*.

**body sections** — this order, all `##`:
`Overview` · `Requirements` · `Contract` · `AC` · `Subtasks` · `Change Log`
- `AC`·`Subtasks`: `- [ ]` / `- [x]` checkboxes.
- `Change Log`: `- YYYY-MM-DD — text` (ISO date).

## tree.md
2-space indented list. Items are `id` only. Indent depth = tree depth.
```
- TASK-1
  - TASK-2
```
The single source of truth for parent-child structure. (Task files don't record their parent.)
**It holds only nodes that currently exist** (have a task file) — never a hypothesised-but-ungrown child. A child appears here the moment *grow* creates it, not when its parent merely plans it; so `tree.md` reflects the present. `grovespec validate` requires every id here to have a task file and vice-versa.

## brief.md
frontmatter `name`. Sections (`##`, fixed): `Direction` · `Scope` · `Risks`.

## conventions.md
Sections (`##`, fixed): `Glossary` · `Common Rules`.

## ref-index.md
Table. Fixed columns: `Topic | File | Location`.

## config.yaml
Location: `.grovespec/config.yaml`. Keys: `version`, `language`, `paths` (`brief·tree·conventions·tasks·ref·src·tests·review` — only the locations are changeable; the structure is fixed), `verify` (`strength` 1–3 · `max_rounds` · `scale` · optional `models` — the spec cold-review) and `review` (`strength` · `max_rounds` · `scale` · `test` command · optional `models` — the code diff-review). `models` (optional, either block) maps a lens name — or `default` / `triage` — to a model; **omit it and every reviewer inherits the session model** (no forced cost).

## review-cycle state (verify & review)
*verify* (spec) and *review* (code) each run the cold-reviewer cycle and keep state at `paths.review` (default `.grovespec/review/`). Because both act on the **same** node id at different stages, they write **separate** files so they never collide:
- `<id>.verify.yaml` — the spec-verification cycle (`target_type: spec`).
- `<id>.review.yaml` — the code-review cycle (`target_type: result`, diff-scoped).

Fields (both): `target`, `target_type` (`spec|result`), `level` (`skip|light|standard|full`), `strength` (1–3), `repeat`, `max_rounds`, `round`, `consecutive_passes`, `status` (`in-progress|passed|escalated`), `rounds[]` (per-round outcome), `open_issues[]`, `adjudications[]`. Template: `.grovespec/templates/review-state.yaml`.
