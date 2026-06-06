---
name: grovespec-init
description: Sets up GroveSpec in a project for the first time (just once). Looks at what you have (just an idea / rough spec / detailed spec doc / existing code / code+docs) and creates the initial brief, tree.md, top-level Tasks, and config. Use when the user wants to "start a new project with GroveSpec", "adopt GroveSpec in this codebase", "grovespec init", or "set up the spec/tree for the first time" and there's no tree.md yet. If a tree already exists and you're adding the next node, use grovespec-grow; to change an already-done node, use grovespec-revise.
---

# grovespec-init

The first-time setup of a GroveSpec project. Runs **once**. When it's done, the per-node cycle (`grow → verify → implement → review ⇄ fix → done`) takes over.

> **Language — set `config.language` from the OS locale, then reply in it.** Run `bash .grovespec/bin/grovespec locale`: it returns a code (`ko`/`en`/`ja`/…) read robustly from the OS — Unix `$LANG`/`LC_*`, and on **Windows/MSYS the registry** (because bash `$LANG` is empty there; the skill used to read that and wrongly fall through). **A returned code *is* `config.language`** — use it, English or otherwise. Only if it returns **nothing** (locale truly undetectable) do you **ASK** which language. **Never silently default to English** — an empty locale isn't a vote for English, it's a reason to ask. (These files are English; irrelevant to your output. Every later skill just *reads* `config.language` — §3.)

## One principle: only the root, nothing below yet (greenfield)

Starting from an idea or a spec doc, don't unfold the tree. Write **only the root** — one Task, `status: draft`. Everything below is grown later, one node at a time, *after* the root is built and `done`.

Because — bake unverified assumptions into the tree and, when one turns out wrong while building the top, you redo everything below it. The tree is *a hypothesis, not a fixed design*; commit nothing below the root until the root is done.

(*Brownfield* — existing code — is the exception: the code is already-built reality, so `references/code-to-tree.md` maps the whole existing structure at once, all `done`. "Root only" is about not pre-baking what *isn't built yet*.)

## Flow

### 1. Figure out what you have
**Check the directory first** (glob for source files + any docs); ask the user only if it's ambiguous. You need two things:
- **Is there code?** (source files exist → brownfield)
- **Are there docs to reference?** (a spec doc, etc.) — and if so, *detailed or rough?* **Detailed = per-feature, AC-level behavior; anything less is a rough idea** → explore. When unsure, treat it as rough and `explore` (the cheap, reversible path).

| What you have | How to build the tree | Reference docs |
|---|---|---|
| Just an idea / rough spec | explore it out → a lean brief (`references/explore.md`) | none |
| Detailed spec doc | root only; `grow` unfolds the rest later | keep in ref/ |
| Existing code (±docs) | read the code and extract it | in ref/ if present |

### 2. Per-case prep
- **If there are reference docs** → read and follow `references/ref-docs.md` (keep the originals as-is + make a location map. Don't convert them into a tree).
- **If there's code** → read and follow `references/code-to-tree.md` (read the code first to extract the tree. Even with docs present, code comes first — docs can drift from code). **Brownfield: set `paths` in `.grovespec/config.yaml` to the existing layout** (e.g. `src`, `tasks`) so later searches hit the real dirs — METHODOLOGY §7 calls this a hard requirement.
- **If it's just an idea / rough spec** (no code, no detailed doc) → read and follow `references/explore.md` (explore the idea as a thinking-partner; it lands on a lean brief — no tree or code yet).

### 3. Set the language (once)
Decide `config.language` — the language the *content* of the artifacts is written in. Match existing docs/README if there are any; otherwise default to the language the user works in. Write it to `.grovespec/config.yaml`. Headers and field names stay English; only the prose follows this. (Every later skill reads it from config — no re-detecting.)

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
- **config** — copy `.grovespec/templates/config.yaml` → `.grovespec/config.yaml`; set `language` + any custom paths (defaults under `docs/...`). Then **ask once: mix reviewer models, or one for all?** (AskUserQuestion; recommend the default, always allow a free-form *Other*):
  - **(추천) One model** — leave `models` unset → every reviewer uses the session model. No Opus needed, no extra cost; for all-strong, just run the session on a strong model. *Default if unsure.*
  - **Split** — uncomment the recommended `models` in `verify`/`review` (cheap finders + `correctness·security·coherence·triage` on a stronger model; needs access to it).

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
