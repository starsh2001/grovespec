---
name: grovespec-grow
description: Grows the GroveSpec tree by one node — writes the *draft spec* for ONE new node (a child of a node that's already `done`); no code, and the new node's own children are decided later (at implement), not here. Use when the user wants to "write the next node / write the next spec / unfold this / grow the tree further / add a child / grovespec grow". For verifying a draft use grovespec-verify; for code use grovespec-implement; to change a done node use grovespec-revise.
---

# grovespec-grow

Writing **one new node's draft spec** — a child of a node that's already `done`. No code, concept only. (Verifying the draft is `grovespec-verify`; building it is `grovespec-implement`.)

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `bash .grovespec/bin/grovespec lang`) and write **every** reply in that language. These files are English; your output is not.

> **Decisions: recommend + leave a way out.** When you ask the user to decide (an approach, a contract choice…): **mark your recommended option `(추천)`** with a one-line why, and **always allow a free-form answer** (the AskUserQuestion tool's *Other*, or an explicit free-form choice in an inline list). Don't force a closed pick.

## One principle: one node, only under a done parent
Grow exactly **one** node — a child its `done` parent already planned (in that parent's decomposition). **Don't define this node's *own* children here**; whether it needs any, and which, is decided when *this* node is implemented. Going deeper before a node is built bakes a hypothesis you'll likely redo.

## Flow

### 1. Pick what to grow
Grow a child of a node that is **`done`**. A done node records its **decomposition** — the children it needs + each child's role and the Contract clause it owns — in its Change Log; `grovespec check` flags done skeletons that still have children to grow.
- **The parent must be `done`** — confirm it mechanically (`grovespec check`, or read the parent's `status`). **Never grow under a parent that isn't done** — that's bottom-up drift, the exact failure this prevents.
- Pick the next ungrown child from the parent's decomposition (or the one the user points at). It is *not* in `tree.md` yet — this step creates it.

### 2. Read only what you need (thin)
- The parent's **Contract** + the parent's **decomposition entry for this child** (its role · which Contract clause it must fill).
- The risks in `brief.md` this node touches; the relevant terms·rules in `conventions.md`.

Don't pile up a long context. The truth is on disk; re-read when you need it.

### 3. Write the draft (concept only)
Copy `.grovespec/templates/task.md`, fill it in, set `id` to the new `TASK-N`, `status: draft`. Format is fixed by `FORMATS.md` (frontmatter + Overview·Requirements·**Contract**·AC). Write the *content* in `config.language`.
- **The Contract matters most**: precise enough that another node can rely on it alone, without seeing the internals (what it takes·gives·empty cases) — and it must fill the clause the parent's decomposition assigned to this child.
- **`role` is a hypothesis here** (skeleton if it'll likely hold children, feature if a leaf). It's **confirmed at implement**, not pinned now — and you do *not* define this node's children here.
- **`tdd`**: default `true` (tests come first at implement). Set `false` only for nodes that resist up-front tests (exploratory prototype · UI · hardware-dependent), and then `tdd_skip_reason` is required.
- **`blocked_by`** = the shared/cross-tree nodes this one consumes (often `[]`); *not* the parent (that's in tree.md).
- **Measurable NFR targets** (latency·throughput·error-rate, where they apply) go in the AC as checkable items — don't leave them implicit.
- **Add this node's id to `tree.md`**, indented under its parent — it enters the tree now, at `draft`.

### 4. Done → verify next
The node's Task now exists as concept (`status: draft`) and is in `tree.md`. **Next is `grovespec-verify <this node>`** — the cold multi-persona check of the draft + human approval (`draft` → `approved`). grow itself does **no** review and sets **no** approval; that is verify's job, kept separate so the reviewers stay cold.

## When it's done
One new node's draft is written (`draft`) and placed in `tree.md`. The expensive steps follow, one at a time: `grovespec-verify` → (human approve → `approved`) → `grovespec-implement` → `grovespec-review` → (human confirm → `done`). Only once *this* node is `done` are *its* children grown.
