---
name: grovespec-grow
description: Grows the GroveSpec tree by one node — writes only the *concept spec* for the next node (no code). Start from a node that's unblocked (its parent is done). If it's a skeleton, also define the roles·contracts of its direct children and add them to tree.md. Use when the user wants to "write the next node / write the spec / unfold this node / grow the tree further / grovespec grow", or wants to "continue" right after init. For code, use grovespec-implement; to change a done node, use grovespec-revise.
---

# grovespec-grow

Growing the tree *one node at a time*. No code — **concept spec only**. (Implementation is `grovespec-implement`.)

## One principle: one layer only
Define only this node + (if it's a skeleton) its direct children. Don't go deeper. The tree is a hypothesis — bake it deep before the top is settled and you'll redo it all later.

## Flow

### 1. Pick a node
From `tree.md`, one of the *unblocked* nodes (its parent is done). Or the node the user pointed at.

### 2. Read only what you need (thin)
- The parent Task's **contract** — what this node has to fill.
- The risks in `brief.md` that this node touches.
- The relevant terms·rules in `conventions.md`.

Don't pile up a long working context. The truth is on disk; re-read when you need it.

### 3. Write the spec (concept only)
Copy `.grovespec/templates/task.md` and fill it in. The format is fixed by `.grovespec/templates/FORMATS.md` — frontmatter (role·status·blocked_by·tdd) + Overview·Requirements·**Contract**·AC. Write the *content* in `config.language`.
- **The contract matters most**: precise enough that *another node can rely on it alone, without seeing the internals* (what it takes·gives·empty cases).
- Don't write *how* the code will look — that emerges in implement.
- **`blocked_by`** = the shared/cross-tree nodes this one consumes (often `[]`); *not* the parent (that's in tree.md).

### 4. If it's a skeleton: define the children
If this node is a skeleton, also define the *roles·contracts* of its direct children.
- Add the children's ids to `tree.md` (indented under this node).
- Create each child's Task and write its role·contract.
- **The children's contracts must sum to this node's contract** — nothing missing, nothing overlapping.

### 5. Review (the spec)
Call `grovespec-review` against *this spec* (scope by *node importance* — usually `standard`, `full` for an important node). Fix the confirmed issue list it returns, right there, and repeat until clean. (review has cold reviewers verify the contract via *consumer-impersonator / gap-finder / coherence*.)

### 6. Human check
Show the spec to the human and get **"is this what you want?"** confirmed. The checkpoint *before* spending effort on implementation.

## When it's done
The node's Task is filled in as concept, status `todo`. Next — **both roles get implemented**:
- feature node → implement it with `grovespec-implement`.
- skeleton → implement it too (its container/interface/dispatch code, written against the children's Contracts). When the skeleton is `done`, its children unblock — then `grovespec-grow` each child.
