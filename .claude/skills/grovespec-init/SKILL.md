---
name: grovespec-init
description: Sets up GroveSpec in a project — opens with a fixed setup interview (language · review strength · reviewer models · test command), then creates the brief, tree.md, the root Task, and config. Use when the user wants to "start a new project with GroveSpec", "adopt GroveSpec in this codebase", "grovespec init", "set up the spec/tree", or "reconfigure / change the review settings or language". Re-invoking init on an existing project re-runs the setup interview and updates config (it does not recreate the project). To add the next node use grovespec-grow; to change a done node use grovespec-revise.
---

# grovespec-init

Setup of a GroveSpec project — it **opens with a fixed setup interview** (`references/setup.md`: language · review strength · reviewer models · test command), then builds the brief + root. When that's done, the per-node cycle (`grow → verify → implement → review ⇄ fix → done`) takes over. **Re-invoke init anytime to *reconfigure*** — it re-asks the interview and updates `.grovespec/config.yaml`, without recreating the project.

> **Language — detect, then CONFIRM (don't assume).** Run `bash .grovespec/bin/grovespec locale` → a code (`ko`/`en`/`ja`/…) read from the OS (Unix `$LANG`/`LC_*`; on **Windows/MSYS the registry**, since bash `$LANG` is empty there). **Then confirm it with the user** — that's the setup interview's Q1 (*"locale=ko — 이 언어로 진행할까요?"*, default = the detected one). Reply in the chosen language from word one. If detection returns **nothing**, **ASK** outright; **never silently default to English** (an empty locale isn't a vote for English). The choice is written to `config.language`; later skills just read it. (These files are English — irrelevant to your output.)

## One principle: only the root, nothing below yet (greenfield)

Starting from an idea or a spec doc, don't unfold the tree. Write **only the root** — one Task, `status: draft`. Everything below is grown later, one node at a time, *after* the root is built and `done`.

Because — bake unverified assumptions into the tree and, when one turns out wrong while building the top, you redo everything below it. The tree is *a hypothesis, not a fixed design*; commit nothing below the root until the root is done.

(*Brownfield* — existing code — is the exception: the code is already-built reality, so `references/code-to-tree.md` maps the whole existing structure at once, all `done`. "Root only" is about not pre-baking what *isn't built yet*.)

## Flow

### 1. Figure out what you have
**Check the directory first** (glob for source files + any docs); ask the user only if it's ambiguous. **Already a GroveSpec project (a `tree.md` exists)?** → this is a *reconfigure*: run only **§2 (the setup interview)**, update config, and **stop** — don't recreate brief/tree/tasks. (Add a node → grovespec-grow; change a done node → grovespec-revise.) Otherwise, first-time setup — you need two things:
- **Is there code?** (source files exist → brownfield)
- **Are there docs to reference?** (a spec doc, etc.) — and if so, *detailed or rough?* **Detailed = per-feature, AC-level behavior; anything less is a rough idea** → explore. When unsure, treat it as rough and `explore` (the cheap, reversible path).

| What you have | How to build the tree | Reference docs |
|---|---|---|
| Just an idea / rough spec | explore it out → a lean brief (`references/explore.md`) | none |
| Detailed spec doc | root only; `grow` unfolds the rest later | keep in ref/ |
| Existing code (±docs) | read the code and extract it | in ref/ if present |

### 2. Setup interview (the fixed questionnaire — ask before starting)
Run the **fixed** interview in `references/setup.md` — **language** (confirm the detected locale) · **review strength** · **reviewer models** · **test command** — and write the answers to `.grovespec/config.yaml`. Ask **exactly** those questions, in order (don't improvise or skip any) — a fixed interview is what keeps every project configured the same and nothing decided silently. Do this **before** per-case prep, so the rest of init runs in the chosen language. (Re-invoked on an existing project, this is the *only* step — update config and stop.)

### 3. Per-case prep
- **If there are reference docs** → read and follow `references/ref-docs.md` (keep the originals as-is + make a location map. Don't convert them into a tree).
- **If there's code** → read and follow `references/code-to-tree.md` (read the code first to extract the tree. Even with docs present, code comes first — docs can drift from code). **Brownfield: set `paths` in `.grovespec/config.yaml` to the existing layout** (e.g. `src`, `tasks`) so later searches hit the real dirs — METHODOLOGY §7 calls this a hard requirement.
- **If it's just an idea / rough spec** (no code, no detailed doc) → read and follow `references/explore.md` (explore the idea as a thinking-partner; it lands on a lean brief — no tree or code yet).

### 4. Write brief.md
Only the **broad direction · scope · visible risks**. Short, plain words — *a person should be able to read it at a glance and say "yes, that's right."*

Risks hold only "where it might break." Leave out "what to build."
- In: "payment and inventory totals can drift out of sync"
- Out: "the profile should have name and email"

### 5. Make the files
- **tree.md** — *greenfield*: just the root. *brownfield*: the whole existing structure (from `code-to-tree.md`). Ids only.
  ```
  - TASK-1
  ```
- **tasks/** — *greenfield*: only the root (`TASK-1`), concept only, `status: draft`. *brownfield*: one Task per existing node, `status: done` (see `code-to-tree.md`). Follow `.grovespec/templates/task.md` + `FORMATS.md`. **Don't create any child Task here** — greenfield children are grown one at a time later; brownfield children already exist.
- **conventions.md** — start empty (filled in as you build). For a *brownfield* project, **do** fill in the facts the code guarantees (terms·global rules) — don't leave it empty (→ `references/code-to-tree.md` §7).
- **config** — `.grovespec/config.yaml` was created from the template and filled by the **§2 setup interview** (`language` · `verify/review.strength` · `models` · `review.test`). Here, only set any custom **paths** — *brownfield*: point them at the existing layout (e.g. `src`, `tasks`); *greenfield*: keep the defaults under `docs/...`.

### 6. Human check → hand off
Show the brief and the root (greenfield) or the extracted tree (brownfield) to the human and get **"is this right?"** confirmed — the checkpoint *before* more effort.
- *Greenfield*: **next is `grovespec-verify TASK-1`** (cold-verify the root's draft → human approve → `approved`), then `implement` → `review` → `done`; once the root is `done`, `grovespec-grow` its first child.
- *Brownfield*: the tree is now documented (`done`). Work proceeds via `grovespec-grow` / `grovespec-revise` on the parts you change next.

If it's not right, loop back (re-`explore` the brief / re-read the code) — don't proceed on a wrong direction.

## What it looks like when done
```
docs/
  brief.md           broad direction·scope·risks
  tree.md            greenfield: just the root · brownfield: the whole existing tree (ids only)
  conventions.md     (empty greenfield / filled brownfield)
  tasks/             greenfield: root only (draft) · brownfield: one per existing node (done)
  ref/               reference originals + location map (only if present)
```
