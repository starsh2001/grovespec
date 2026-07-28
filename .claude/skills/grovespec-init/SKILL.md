---
name: grovespec-init
description: Sets up GroveSpec in a project — opens with a fixed setup interview (language · review strength · reviewer models), then creates the brief, the detailed spec, the whole task tree (greenfield: all `sketch`; brownfield: all `done`), and config. Use when the user wants to "start a new project with GroveSpec", "adopt GroveSpec in this codebase", "grovespec init", "set up the spec/tree", or "reconfigure / change the review settings or language". Re-invoking init on an existing project re-runs the setup interview and updates config (it does not recreate the project). To detail or add a node use grovespec-grow; to change a done node use grovespec-revise.
---

# grovespec-init

Setup of a GroveSpec project — it **opens with a fixed setup interview** (`references/setup.md`: language · review strength · reviewer models — the test command is auto-detected, not asked), then builds the brief + the sketched tree. When that's done, the per-node cycle (`grow → verify → implement → review ⇄ fix → done`) takes over. **Re-invoke init anytime to *reconfigure*** — it re-asks the interview and updates `.grovespec/config.yaml`, without recreating the project.

> **Language — detect, then CONFIRM (don't assume).**
> - **Detect**: `bash .grovespec/bin/grovespec locale` → a code (`ko`/`en`/`ja`/…) read from the OS (Unix `$LANG`/`LC_*`; on **Windows/MSYS the registry**, since bash `$LANG` is empty there).
> - **Confirm it with the user** — that's the setup interview's Q1, asked with the language as a **word, not the code** (*"OS 언어가 한국어로 잡혔어요 — 이 언어로 진행할까요?"*, default = the detected one; the code is stored to `config.language`, never shown). Reply in the chosen language from word one.
> - **Detection returned nothing? ASK outright** — **never silently default to English** (an empty locale isn't a vote for English).
>
> The choice is written to `config.language`; later skills just read it. (These files are English — irrelevant to your output.)

## One principle: the full tree up front, all `sketch` (greenfield)

Starting from an idea or a spec doc, **draw out a detailed spec and map the whole tree as sketches** — every node placed with a one-line responsibility + rough I/O (`status: sketch`), no full contracts yet. The build details each sketch into a contract (`grow`), then runs it through the gates (verify → implement → review → `done`). Nothing is frozen — `sketch` and `draft` are both hypotheses.

(*Brownfield* — existing code — maps the same way but all `done`: the code is already-built reality, so `references/code-to-tree.md` maps the whole existing structure at once.)

## Flow

### 1. Figure out what you have
**Check the directory first** (glob for source files + any docs); ask the user only if it's ambiguous. Three cases:

- **Already a GroveSpec project** (a `tree.md` exists) → this is a *reconfigure*: run only **§2 (the setup interview)**, update config, and **stop** — don't recreate brief/tree/tasks. (Add a node → grovespec-grow; change a done node → grovespec-revise.)
- **A *half-finished* init** (a prior session stopped mid-way) → resume where the artifacts stop, don't restart: a `ref/` spec but no `tree.md` → re-enter at `spec-to-tree.md` (brownfield: `code-to-tree.md`); a brief but no ref spec → resume `explore.md` (re-reading the brief so far). The §2 interview still runs (three quick questions — confirm or adjust).
- **First-time setup** → you need two things:
- **Is there code?** (source files exist → brownfield)
- **Are there docs to reference?** (a spec doc, etc.) — and if so, *detailed or rough?* **Detailed = per-feature, AC-level behavior; anything less is a rough idea.** Either way, the goal is the same: a **detailed spec** (drawn out via `explore.md` or read from the user's doc + gaps filled) that `spec-to-tree.md` maps into the full tree of all-`sketch` Tasks.

| What you have | How to build the tree | Reference docs |
|---|---|---|
| Just an idea / rough spec | explore → detailed spec → `spec-to-tree` → all-`sketch` tree | the spec (produced, saved as ref) |
| Detailed spec doc | fill the gaps the doc leaves blank (`explore.md`) → `spec-to-tree` → all-`sketch` tree | the doc (kept in ref/) |
| Existing code (±docs) | `code-to-tree` → all-`done` tree | in ref/ if present |

### 2. Setup interview (the fixed questionnaire — ask before starting)
Run the **fixed** interview in `references/setup.md` — **language** (confirm the detected locale) · **review strength** · **reviewer models** — and write the answers to `.grovespec/config.yaml`.
- Ask **exactly those three questions, in order** — don't improvise or skip any. A fixed interview is what keeps every project configured the same and nothing decided silently.
- The **test command is not asked** — it's a derivable value, auto-detected per `setup.md`'s note (see §3/§5).
- Run this **before** per-case prep, so the rest of init runs in the chosen language. (Re-invoked on an existing project, this is the *only* step — update config and stop.)

### 3. Per-case prep
- **If there are reference docs** → read and follow `references/ref-docs.md` (keep the originals as-is + make a location map) — **and fill the gaps the doc leaves blank with the user** via `references/explore.md` (the direction facets + any missing feature detail). Then `references/spec-to-tree.md` maps the result into the all-`sketch` tree.
- **If there's code** → read and follow `references/code-to-tree.md` (read the code first to extract the tree — even with docs present, code comes first, since docs drift from code).
  - **Set `paths` in `.grovespec/config.yaml` to the existing layout** (e.g. `src`, `tasks`) so later searches hit the real dirs — METHODOLOGY §7 calls this a hard requirement.
  - **Detect the test command here** (`package.json` `scripts.test` / `pyproject`·pytest config / `Makefile` / `cargo`·`go` layout / …) and write `review.test` — a derivable value, not an interview question (`setup.md`). Leave it empty only if nothing is clearly detectable.
- **If it's just an idea / rough spec** (no code, no detailed doc) → read and follow `references/explore.md` (explore the idea thoroughly — direction facets + feature detail — it lands on a detailed spec saved as ref + a brief). Then `references/spec-to-tree.md` maps the spec into the all-`sketch` tree.

### 4. Write brief.md + detailed spec
- **The detailed spec** (produced by explore, or the user's doc with gaps filled) is saved in `ref/` — it's the original intent, unedited from here (same as any ref doc).
- **brief.md** is the lean overview extracted from the spec: **direction · scope · visible risks**. Short, plain words — *a person should be able to read it at a glance and say "yes, that's right."*

Risks hold only "where it might break." Leave out "what to build."
- In: "payment and inventory totals can drift out of sync"
- Out: "the profile should have name and email"

### 5. Make the files
- **tree.md** — *greenfield*: the full tree from `spec-to-tree.md`, all `sketch`. *brownfield*: the whole existing structure from `code-to-tree.md`, all `done`. Ids only.
- **tasks/** — *greenfield*: all Tasks from `spec-to-tree.md`, `status: sketch` (thinly filled — one-line responsibility + rough I/O; `grovespec-grow` details each into a full contract later). *brownfield*: one Task per existing node, `status: done` (see `code-to-tree.md`). Follow `.grovespec/templates/task.md` + `FORMATS.md`.
  - **Mark the root's own deliverable in its sketch.** The root isn't pure delegation: note (in its sketch) that it builds the **base environment + an empty runnable shell** (smoke-testable — blank page loads / server boots / CLI runs). Its full smoke-test AC + base-env Subtask get written when `grovespec-grow` details the root sketch; the stack is chosen at the root's `implement` (→ METHODOLOGY "Skeleton role").
- **conventions.md** — *greenfield*: start empty; it gets **seeded at the root's `implement`** (the chosen stack + foundational patterns) and grows as each node establishes a cross-cutting rule (→ `grovespec-implement`). For a *brownfield* project, **do** fill in the facts the code guarantees (terms·global rules) now — don't leave it empty (→ `references/code-to-tree.md` §7).
- **findings.md · restructuring.md** — *brownfield only, and only if non-empty*: the backlog `code-to-tree.md` parked while mapping (`findings.md` = node-level bugs·duplications·doc↔code mismatches; `restructuring.md` = tree-level structural debt). The tree stays all-`done`; these hold what's *wrong with* it, for `grovespec-revise` to work off. **Greenfield / clean code: don't create them** (no empty files).
- **config** — `.grovespec/config.yaml` was created from the template and filled by the **§2 setup interview** (`language` · `verify/review.strength` · `models`).
  - **paths** — *brownfield*: point them at the existing layout (e.g. `src`, `tasks`); *greenfield*: keep the defaults under `docs/...`.
  - **`review.test` is not from the interview** — *brownfield*: write the command detected in §3; *greenfield*: leave it `""` (the first `grovespec-review` derives it from the stack and writes it back).

### 6. Hand off — the decomposition gate (greenfield) / human check (brownfield)
- *Greenfield*: the **sketch tree** is a *hypothesis*, and it gets the cold gate — not just a human glance. Briefly show the tree, then **next is `grovespec-verify` on the tree** (`target_type: tree`): cold reviewers check the decomposition (D1–D5: scope coverage · system completeness · actor closure · boundaries · depth) → fix → **human approves the *vetted* tree**. Only then does the per-node build begin — `grovespec-grow` the root (detail its sketch → `draft`) → `verify` (spec) → `implement` → `review`, top-down.
- *Brownfield*: no decomposition gate — the code *is* the decomposition (all `done`), and what's wrong with it is already parked in `findings.md`·`restructuring.md`. Show the brief + extracted tree + those backlogs to the human, get **"is this right?"** confirmed. Work proceeds via `grovespec-revise` on the parts you change, or `grovespec-grow` to add what's new.

> **Recommend a new session for the next step** (greenfield: `verify` the tree; brownfield: `revise`/`grow`). The agent that just built the tree shouldn't also orchestrate its cold review — start it fresh, with clean bounded context (WORKFLOW §5).

If it's not right, loop back (re-`explore` the brief / re-read the code) — don't proceed on a wrong direction.

## What it looks like when done
```
docs/
  brief.md           broad direction·scope·risks
  tree.md            greenfield: the full tree, all sketch · brownfield: the whole existing tree, all done (ids only)
  conventions.md     (seeded if the spec/code states cross-cutting rules / empty otherwise)
  tasks/             greenfield: all Tasks (sketch) · brownfield: one per existing node (done)
  findings.md        brownfield backlog: bugs·duplications·doc↔code mismatches (only if non-empty)
  restructuring.md   brownfield backlog: tree-level structural debt (only if non-empty)
  ref/               greenfield: the detailed spec explore authored (always) · brownfield: brought-in originals (if any) + location map
```
