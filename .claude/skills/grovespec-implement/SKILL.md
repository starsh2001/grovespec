---
name: grovespec-implement
description: Implements a GroveSpec node — turns a confirmed spec into real code. Pre-checks (risks·conventions·search existing code) → tests first → code → review the result → fix → done. Use when the user wants to "implement this node / write the code / build it / grovespec implement", or wants to "implement now" after writing a spec with grow. For writing specs, use grovespec-grow; to change a done node, use grovespec-revise.
---

# grovespec-implement

Turning a confirmed spec into *code*. (Writing specs is `grovespec-grow`.) Both roles get implemented: a **feature**'s leaf behavior, and a **skeleton**'s own structural code (container·interface·dispatch) — the skeleton's code is written against its children's Contracts (already defined by grow), so the children aren't needed yet.

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `bash .grovespec/bin/grovespec lang`) and write **every** reply in that language. These files are English; your output is not.

> **Decisions: recommend + leave a way out.** When you ask the user to decide (tech stack, library, approach…): **mark your recommended option `(추천)`** with a one-line why, and **always allow a free-form answer** (the AskUserQuestion tool's *Other*, or an explicit free-form choice in an inline list). Don't force a closed pick.

## Session
Thin — read only this node's Task and the *relevant code*. Don't pile up a long working context.

## Flow

### 0. Confirm it's this node's turn (the top-down gate)
Run `grovespec check <node>`. If it exits **✗** (blocked / no spec), **STOP — do not implement this node**; implement the node `grovespec check` reports ready instead. This gate keeps the build top-down: *never* implement a node whose parent isn't `done` (building a leaf before its skeleton is bottom-up drift — exactly the failure this prevents).

### 1. Pre-check (before implementing)
- **Look up risks**: any risk in `brief.md` that this node touches? If so, go in knowing it.
- **Check conventions**: the relevant terms·rules in `conventions.md`.
- **Search existing code (grep) — most important**:
  1. Pull the *key words* from what this node is trying to do.
  2. Search the code + `tasks/` for those words.
  3. Put what you find in front of you and explicitly answer **"reuse, or write new?"** before moving on.

  *The same word for the same concept* is what makes search hit. An isolated agent writing the second one, with the first not in front of it, won't even know it duplicated — so "always search first at this step" is the rule.

### 2. Tests first
From the AC, write *failing* tests. These tests are the target of the implementation.
- TDD is decided by the Task's `tdd` field (set at grow, with `tdd_skip_reason`) — here you only **obey** it: `tdd: true` → write failing tests first; `tdd: false` → skip, no judgment call. If the field looks wrong for this node, that's a spec fix — go back to grow/revise; don't override it silently here.

### 3. Implement
Write code until the tests pass.
- **Write-scope (blast radius):** write only *this node's* code (`src/`), its tests (`tests/`), and *this node's* Task — plus `tree.md` if you extract/split (next bullet). **Don't edit another existing node's code or Task** to make yours pass; if a *shared* node you depend on needs changing, stop and use `grovespec-revise` on it.
- If you find a chunk that 2+ nodes will use, extract it as a shared node (or split this one): add its id to `tree.md` so the structure stays in sync with the code.

### 4. Review (the result)
Call `grovespec-review` with `target_type: result`. Don't eyeball "importance" — let review pick the level (an ordinary node → `standard`; a contract many nodes consume → `full`). Fix the confirmed issues right there (apply), then re-invoke review **on the same node** (reuses its `<id>.yaml`; rounds accumulate) until it passes; on an `escalated` return, stop — **do not set `done`** (open issues go to the human).
- If the implementation differs from the spec: **default to "mistake" — conform the code to the spec.** Call it *intentional* (fix the spec + note why in the Change Log) only if you can state the new contract clause that replaces the old one. (Matching the spec is the cheap, reversible direction; rewriting the contract is the expensive one — don't do it by accident.)

### 5. Human check → done
Show the result to the human and get it confirmed. If it's right, set the Task `status: done`.

## When it's done
Code·tests are in `src/`·`tests/`, the Task is `done`. Children·consumers that were blocked on this node are now unblocked — next is `grovespec-grow` (the next node), or implementing the unblocked nodes.
