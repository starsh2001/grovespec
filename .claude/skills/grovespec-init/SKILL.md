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
Look at the directory, or ask the user. You only need two things:
- **Is there code?** (an existing project)
- **Are there docs to reference?** (a spec document, etc.)

| What you have | How to build the tree | Reference docs |
|---|---|---|
| Just an idea / rough spec | draw it out in conversation | none |
| Detailed spec doc | in conversation (one layer at a time) | keep in ref/ |
| Existing code (±docs) | read the code and extract it | in ref/ if present |

### 2. Per-case prep
- **If there are reference docs** → read and follow `references/ref-docs.md` (keep the originals as-is + make a location map. Don't convert them into a tree).
- **If there's code** → read and follow `references/code-to-tree.md` (read the code first to extract the tree. Even with docs present, code comes first — docs can drift from code).
- **If neither** → draw out the broad direction in conversation.

### 3. Set the language (once)
Decide `config.language` — the language the *content* of the artifacts is written in. Match existing docs/README if there are any; otherwise default to the language the user works in. Write it to `config.yaml`. Headers and field names stay English; only the prose follows this. (Every later skill reads it from config — no re-detecting.)

### 4. Write brief.md
Only the **broad direction · scope · visible risks**. Short, plain words — *a person should be able to read it at a glance and say "yes, that's right."*

Risks hold only "where it might break." Leave out "what to build."
- In: "payment and inventory totals can drift out of sync"
- Out: "the profile should have name and email"

### 5. Make the files
- **tree.md** — the rough whole tree, *ids only*. A hypothesis.
  ```
  TASK-1
  ├─ TASK-2
  └─ TASK-3
  ```
- **tasks/** — only the root (TASK-1) and *its direct children*. Concepts only. Follow `.grovespec/templates/task.md` and `.grovespec/templates/FORMATS.md`.
- **conventions.md** — start empty (filled in as you build). For a *brownfield* project you may fill in facts the code guarantees (terms·global rules) → `references/code-to-tree.md`.
- **config** — paths, language, etc. (defaults under `docs/...`).

### 6. Human check → hand off
Show the brief and the top of the tree to the human and get **"is this the right direction?"** confirmed. This is the checkpoint *before* spending more effort.
If it's right, you're done — next, `grovespec-grow` grows it one node at a time.

## What it looks like when done
```
docs/
  brief.md           broad direction·scope·risks
  tree.md            rough whole tree (ids only)
  conventions.md     (empty)
  tasks/             root + first level (concepts only)
  ref/               reference originals + location map (only if present)
```
