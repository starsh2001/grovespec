---
name: grovespec-grow
description: Grows the GroveSpec tree by one node — writes only the *concept spec* for the next node (no code). Start from a node that's unblocked (its parent is done). If it's a skeleton, also define the roles·contracts of its direct children and add them to tree.md. Use when the user wants to "write the next node / write the spec / unfold this node / grow the tree further / grovespec grow", or wants to "continue" right after init. For code, use grovespec-implement; to change a done node, use grovespec-revise.
---

# grovespec-grow

Growing the tree *one node at a time*. No code — **concept spec only**. (Implementation is `grovespec-implement`.)

> Reply in `config.language` (set at init) — these files are English, your replies aren't.

## One principle: one layer only
Define only this node + (if it's a skeleton) its direct children. Don't go deeper. The tree is a hypothesis — bake it deep before the top is settled and you'll redo it all later.

## Flow

### 1. Pick a node
From `tree.md`, pick an *unblocked* node. **Confirm it mechanically — `grovespec check <node>` (or `grovespec check` to list what's ready); only a ✓ node is eligible, don't eyeball it.** (Unblocked = parent `done` **and** every `blocked_by` `done`.) Or the node the user pointed at — but still run `check`; if it's ✗, it's blocked, so say so and grow the ready node instead. **Never grow/implement a node whose parent isn't done — that's bottom-up drift.**

### 2. Read only what you need (thin)
- The parent Task's **contract** — what this node has to fill.
- The risks in `brief.md` that this node touches.
- The relevant terms·rules in `conventions.md`.

Don't pile up a long working context. The truth is on disk; re-read when you need it.

### 3. Write the spec (concept only)
Copy `.grovespec/templates/task.md` and fill it in. The format is fixed by `.grovespec/templates/FORMATS.md` — frontmatter (role·status·blocked_by·tdd) + Overview·Requirements·**Contract**·AC. Set `id` to match the filename (`TASK-N`, not the template's `TASK-0`). **`tdd`**: default `true` (tests come first at implement); set `false` only for nodes that resist up-front tests (exploratory prototype · UI · hardware-dependent), and then `tdd_skip_reason` is required. Write the *content* in `config.language`.
- **The contract matters most**: precise enough that *another node can rely on it alone, without seeing the internals* (what it takes·gives·empty cases).
- Don't write *how* the code will look — that emerges in implement.
- **`blocked_by`** = the shared/cross-tree nodes this one consumes (often `[]`); *not* the parent (that's in tree.md).
- **Measurable NFR targets** (latency·throughput·error-rate, where they apply) go in the AC as checkable items — don't leave them implicit.

### 4. If it's a skeleton: define the children
If this node is a skeleton, also define the *roles·contracts* of its direct children.
- Add the children's ids to `tree.md` (indented under this node).
- Create each child's Task and write its role·contract.
- **The children's contracts must sum to this node's contract** — nothing missing, nothing overlapping. *Self-test (do it, don't eyeball):* list every clause of this node's Contract (takes · gives · each invariant · each empty-case); assign each to **exactly one** child — 0 unassigned (a gap), 0 claimed by two (an overlap). Record that clause→child map in this node's Change Log.
  - ✅ `storage` owns the record shape; `add` owns validation — each clause has one owner.
  - ❌ both `storage` and `add` validate the amount (overlap), or neither owns the empty-file case (gap).
- New children are created at `status: backlog` (they unblock when this skeleton is `done` — see `FORMATS.md` status lifecycle).

### 5. Review (the spec)
Call `grovespec-review` with `target_type: spec`. Don't eyeball "importance" — let review pick the level from checkable inputs (a skeleton, or a *shared* node others will depend on → `full`; an ordinary leaf → `standard`). Fix the confirmed issue list it returns, right there, then re-invoke review **on the same node** — it reuses that `<id>.yaml`, so rounds accumulate — until clean; on an `escalated` return, stop (don't confirm the spec). (review has cold reviewers verify the contract via *consumer-impersonator / gap-finder / coherence*.)

### 6. Human check
Show the spec to the human and get **"is this what you want?"** confirmed. The checkpoint *before* spending effort on implementation. (A node that was `backlog` flips to `todo` here, once confirmed.)

## When it's done
The node's Task is filled in as concept, status `todo`. Next — **both roles get implemented**:
- feature node → implement it with `grovespec-implement`.
- skeleton → implement it too (its container/interface/dispatch code, written against the children's Contracts). When the skeleton is `done`, its children unblock — then `grovespec-grow` each child.
