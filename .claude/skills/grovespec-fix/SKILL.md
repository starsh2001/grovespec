---
name: grovespec-fix
description: Applies the issues grovespec-review found — edits THIS node's code to clear the open issues, sets status fixed, and re-runs grovespec-review. The reviewed ⇄ fixed loop, until the code is clean. Use when the user wants to "fix the review issues / apply the fixes / address the findings / grovespec fix" after a review found problems. For the review itself use grovespec-review; to change a done node use grovespec-revise.
---

# grovespec-fix

Clearing the issues `grovespec-review` found — the `reviewed` → `fixed` → (re-review) half of the loop. (Finding the issues is `grovespec-review`; fixing needs no independence, so it's a separate, plain step in the implementer's context.)

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `node .grovespec/bin/grovespec.mjs lang`) and write **every** reply in that language. These files are English; your output is not.

## Flow

### 1. Pick the node + read the issues
*If no node is named*, take the `reviewed` node whose `<id>.review.yaml` carries `open_issues` — the one `grovespec-review` just handed back. Read that `open_issues` (the confirmed list). If it's empty there's nothing to fix; go back to `grovespec-review` (it's what gates `done`). Read the node's Task (AC·Contract) as the yardstick.

### 2. Fix — this node's code only
Apply each open issue.
- **Write-scope (blast radius):** edit only *this node's* `src/`·`tests/` (+ `tree.md` if you extract/split). **Don't edit another node's code** to clear an issue; if a *shared* node must change, that's `grovespec-revise` on it.
- If an issue says a **test was hollow or wrong**, fix the test (and the behavior it should have caught) — not just the code.
- **If an issue means the *spec* is wrong** (the contract, not the code) — stop: that's `grovespec-revise` (a contract change propagates to consumers), not a silent code patch here.
- Keep fixes to exactly what the issues call for — don't refactor beyond them; that just enlarges the next diff to review.

### 3. Re-review
**Commit as `TASK-N: fix — <summary>`** (the `TASK-N:` prefix keeps the node's diff boundary mechanical — `FORMATS.md`). Set the Task `status: fixed`, then **re-run `grovespec-review`** on the same node — it reuses `<id>.review.yaml`, runs the tests again, and spawns a *fresh* cold round, so the fix is checked by cold eyes (not the fixer). The `reviewed ⇄ fixed` loop continues until a clean terminal pass → `done`.

## When it's done
The open issues are cleared, `status: fixed`, and `grovespec-review` is running again. fix never marks `done` itself — only review's clean terminal pass + human confirm does.

> **Surface, don't point.** An issue you could *not* fix (spec-level, shared-node, needs a human ruling) goes *in the closing message itself* (what it is · the issue in one line · what's needed); a file path comes after the substance, never instead of it.

> **Recommend a new session to re-run `grovespec-review`** (or continue in-session if the fix was tiny). review spawns fresh cold reviewers either way, but a clean orchestrator keeps context bounded across the `reviewed ⇄ fixed` loop (WORKFLOW §5).
