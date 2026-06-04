---
name: grovespec-implement
description: Implements a GroveSpec node — turns an *approved* spec into real code. Pre-check (risks·conventions·search existing code) → tests first → write code → confirm whether this node needs children (record its decomposition) → status implemented. No review here; that's grovespec-review next. Use when the user wants to "implement this node / write the code / build it / grovespec implement" once a node is approved. For verifying the spec use grovespec-verify; for reviewing the code use grovespec-review; to change a done node use grovespec-revise.
---

# grovespec-implement

Turning an **`approved`** spec into *code*. (Verifying the spec is `grovespec-verify`; reviewing the code is `grovespec-review`.) Implement builds the node's own behavior — a **feature**'s leaf logic, or a **skeleton**'s structural code (container·interface·dispatch). It ends at `implemented`; it does **not** review or mark `done`.

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `bash .grovespec/bin/grovespec lang`) and write **every** reply in that language. These files are English; your output is not.

> **Decisions: recommend + leave a way out.** When you ask the user to decide (tech stack, library, approach…): **mark your recommended option `(추천)`** with a one-line why, and **always allow a free-form answer** (the AskUserQuestion tool's *Other*, or an explicit free-form choice in an inline list). Don't force a closed pick.

## Session
Thin — read only this node's Task and the *relevant* code. Don't pile up a long working context.

## Flow

### 0. Confirm it's this node's turn (the gate)
The node must be **`approved`** (cold-verified + human-approved) and unblocked. Run `grovespec check <node>`. If it's ✗ (blocked) or not yet `approved`, **STOP** — `grovespec-verify` it first, or implement the node `grovespec check` reports ready. **Never implement a node whose parent isn't `done`** (bottom-up drift), or whose spec isn't `approved`.

### 1. Pre-check (before writing)
- **Look up risks**: any risk in `brief.md` this node touches? Go in knowing it.
- **Check conventions**: the relevant terms·rules in `conventions.md`.
- **Search existing code (grep) — most important**:
  1. Pull the *key words* from what this node does.
  2. Search the code + `tasks/` for those words.
  3. Put what you find in front of you and answer **"reuse, or write new?"** before moving on.

  An isolated agent that writes the second copy, with the first not in front of it, won't know it duplicated — so "always search first here" is the rule.

### 2. Tests first
From the AC, write *failing* tests — the target the implementation must hit. Obey the Task's `tdd` field (set at grow): `tdd: true` → failing tests first; `tdd: false` → skip (its `tdd_skip_reason` says why). If the field looks wrong for this node, that's a spec fix — go back to `grovespec-revise`; don't override it silently here.

### 3. Implement
Write code until the tests pass.
- **Write-scope (blast radius):** write only *this node's* code (`src/`), its tests (`tests/`), and *this node's* Task — plus `tree.md` if you extract/split (next bullet). **Don't edit another existing node's code or Task** to make yours pass; if a *shared* node you depend on must change, stop and `grovespec-revise` it.
- If you find a chunk 2+ nodes will use, extract it as a shared node (or split this one): add its id to `tree.md` so structure stays in sync with the code.
- **If the code must diverge from the spec:** default to **conform the code to the spec** (the cheap, reversible direction). Call it *intentional* only if you can state the new contract clause that replaces the old — and that's a contract change, so do it via `grovespec-revise`, not a silent edit here.

### 4. Confirm whether this node needs children (decomposition)
Building the node is what **confirms** its `role` (grow's was only a hypothesis):
- **Leaf** → set `role: feature`. Nothing below it.
- **Needs children** (it turned out to be a container/dispatch holding sub-behaviors) → set `role: skeleton` and **record its decomposition in the Change Log**: the children it needs, each child's role, and which clause of *this* node's Contract each child owns — every clause to exactly one child (0 gaps, 0 overlaps). Those children are grown later, one at a time (`grovespec-grow`), *after* this node is `done`. **Don't create the child Tasks now.**

### 5. Hand off → implemented
Set the Task `status: implemented`. **Next: `grovespec-review`** — it runs the tests and a cold code review of *this node's diff*, then `grovespec-fix` if needed, then `done`. implement does not review its own work; cold eyes do.

## When it's done
Code·tests are in `src/`·`tests/`, the Task is `implemented` (plus a Change-Log decomposition if it became a skeleton). Next is `grovespec-review`.
