---
name: grovespec-init
description: Sets up GroveSpec in a project for the first time (just once). Looks at what you have (just an idea / rough spec / detailed spec doc / existing code / code+docs) and creates the initial brief, tree.md, top-level Tasks, and config. Use when the user wants to "start a new project with GroveSpec", "adopt GroveSpec in this codebase", "grovespec init", or "set up the spec/tree for the first time" and there's no tree.md yet. If a tree already exists and you're adding the next node, use grovespec-grow; to change an already-done node, use grovespec-revise.
---

# grovespec-init

The first-time setup of a GroveSpec project. Runs **once**. When it's done, `grovespec-grow` takes over.

## One principle: top in detail, the rest rough

Even if you brought a detailed spec, don't unfold the whole tree. Write **only the root + one layer below** properly; leave everything under that as a rough shape (a hypothesis).

Because — if you bake unverified assumptions into the whole tree, then when an assumption turns out wrong while building the top, you have to redo the whole tree below it. The tree is *a hypothesis, not a fixed design.*

## Flow

### 1. Figure out what you have
**Check the directory first** (glob for source files + any docs); ask the user only if it's ambiguous. You need two things:
- **Is there code?** (source files exist → brownfield)
- **Are there docs to reference?** (a spec doc, etc.) — and if so, *detailed or rough?* **Detailed = per-feature, AC-level behavior; anything less is a rough idea** → explore. When unsure, treat it as rough and `explore` (the cheap, reversible path).

| What you have | How to build the tree | Reference docs |
|---|---|---|
| Just an idea / rough spec | explore it out → a lean brief (`references/explore.md`) | none |
| Detailed spec doc | in conversation (one layer at a time) | keep in ref/ |
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
- **tree.md** — the rough whole tree, *ids only*. A hypothesis.
  ```
  - TASK-1
    - TASK-2
    - TASK-3
  ```
- **tasks/** — only the root (TASK-1) and *its direct children*. Concepts only. Follow `.grovespec/templates/task.md` and `.grovespec/templates/FORMATS.md`. **Status** (per `FORMATS.md` lifecycle): root `TASK-1` → `todo`; its children → `backlog`.
- **conventions.md** — start empty (filled in as you build). For a *brownfield* project, **do** fill in the facts the code guarantees (terms·global rules) — don't leave it empty (→ `references/code-to-tree.md` §7).
- **config** — copy `.grovespec/templates/config.yaml` → `.grovespec/config.yaml`; set `language` + any custom paths (defaults under `docs/...`).

### 6. Human check → hand off
Show the brief and the top of the tree to the human and get **"is this the right direction?"** confirmed. This is the checkpoint *before* spending more effort.
If it's right, you're done — **next, implement the root skeleton** (`grovespec-implement` `TASK-1`: its container/dispatch code, written against the children's Contracts); when the root is `done`, its children unblock → `grovespec-grow` each. If not, loop back to the relevant step (re-`explore` the brief / re-read the code) — don't proceed on a wrong direction.

## What it looks like when done
```
docs/
  brief.md           broad direction·scope·risks
  tree.md            rough whole tree (ids only)
  conventions.md     (empty greenfield / filled brownfield)
  tasks/             root + first level (concepts only)
  ref/               reference originals + location map (only if present)
```
