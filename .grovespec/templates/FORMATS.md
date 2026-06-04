# GroveSpec artifact formats (the parser contract)

So that tools can read these files and process them mechanically, **the format is fixed**. Don't change header names·order, field names·types, or the date format on a whim. (This is itself GroveSpec's *contract* to outside tools.)

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
`version`, `language`, `paths`, `review` (`strength` 1–3 · `max_rounds` · `scale`).
