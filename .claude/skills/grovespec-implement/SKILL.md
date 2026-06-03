---
name: grovespec-implement
description: Implements a GroveSpec node — turns a confirmed spec into real code. Pre-checks (risks·conventions·search existing code) → tests first → code → review the result → fix → done. Use when the user wants to "implement this node / write the code / build it / grovespec implement", or wants to "implement now" after writing a spec with grow. For writing specs, use grovespec-grow; to change a done node, use grovespec-revise.
---

# grovespec-implement

Turning a confirmed spec into *code*. (Writing specs is `grovespec-grow`.) Both roles get implemented: a **feature**'s leaf behavior, and a **skeleton**'s own structural code (container·interface·dispatch) — the skeleton's code is written against its children's Contracts (already defined by grow), so the children aren't needed yet.

## Session
Thin — read only this node's Task and the *relevant code*. Don't pile up a long working context.

## Flow

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
- If the Task has `tdd: false`, skip (the reason is already in the meta). Exploratory prototypes·UI·hardware-dependent checks, etc.

### 3. Implement
Write code until the tests pass. Because you write *knowing* the risks and the existing code, the risky spots come out right from the start and no duplication creeps in.

### 4. Review (the result)
Call `grovespec-review` with `target_type: result` (scope by *node importance* — usually `standard`, `full` for an important node). Fix the confirmed issues right there (apply), and repeat until it passes.
- If the implementation differs from the spec: if **intentional**, fix the spec (concept) and note it in the Change Log. If a **mistake**, fix the code.

### 5. Human check → done
Show the result to the human and get it confirmed. If it's right, set the Task `status: done`.

## When it's done
Code·tests are in `src/`·`tests/`, the Task is `done`. Children·consumers that were blocked on this node are now unblocked — next is `grovespec-grow` (the next node), or implementing the unblocked nodes.
