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
| `status` | enum | `backlog` \| `todo` \| `in-progress` \| `done` |
| `blocked_by` | list | `[TASK-2, ...]`, `[]` if none |
| `tdd` | bool | `true` \| `false` |
| `tdd_skip_reason` | string | required when `tdd: false` |

**Status lifecycle** (defined here once — skills point here, don't restate):
- `backlog` — just named in the tree (a hypothesis); parent not yet `done`, or spec not yet written.
- `todo` — spec written + human-confirmed, parent `done` (so it's unblocked, ready to implement). *grow* sets this.
- `in-progress` — being implemented, or reopened by *revise*.
- `done` — implemented + reviewed + human-confirmed.

Newly-defined children start at `backlog`; they flip to `todo` only when their parent skeleton is `done`.

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

## brief.md
frontmatter `name`. Sections (`##`, fixed): `Direction` · `Scope` · `Risks`.

## conventions.md
Sections (`##`, fixed): `Glossary` · `Common Rules`.

## ref-index.md
Table. Fixed columns: `Topic | File | Location`.

## config.yaml
Location: `.grovespec/config.yaml`. Keys: `version`, `language`, `paths` (`brief·tree·conventions·tasks·ref·src·tests·review` — only the locations are changeable; the structure is fixed), `review` (`strength` 1–3 · `max_rounds` · `scale`).

## review/<id>.yaml (review-cycle state)
One file per reviewed node, at `paths.review` (default `.grovespec/review/`); `<id>` = the node id. Fields: `target`, `target_type` (`spec|result`), `level` (`skip|light|standard|full`), `strength` (1–3), `repeat`, `max_rounds`, `round`, `consecutive_passes`, `status` (`in-progress|passed|escalated`), `rounds[]` (per-round outcome), `open_issues[]`, `adjudications[]`. Template: `.grovespec/templates/review-state.yaml`.
