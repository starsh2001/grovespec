---
name: grovespec-fix
description: Applies the issues grovespec-review found — edits THIS node's code to clear the open issues, sets status fixed, and re-runs grovespec-review. The reviewed ⇄ fixed loop, until the code is clean. Use when the user wants to "fix the review issues / apply the fixes / address the findings / grovespec fix" after a review found problems. For the review itself use grovespec-review; to change a done node use grovespec-revise.
---

# grovespec-fix

Clearing the issues `grovespec-review` found — the `reviewed` → `fixed` → (re-review) half of the loop. (Finding the issues is `grovespec-review`; fixing needs no independence, so it's a separate, plain step in the implementer's context.)

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `node .grovespec/bin/grovespec.mjs lang`) and write **every** reply in that language. These files are English; your output is not.

## Flow

### 1. Pick the node + read the issues
*If no node is named*, take the `reviewed` node whose `<id>.review.yaml` carries `open_issues` — the one `grovespec-review` just handed back. Read that `open_issues` (the confirmed list). If it's empty there's nothing to fix; go back to `grovespec-review` (it's what gates `done`). Read the node's Task (AC·Contract) as the yardstick. Ignore any `followups`: they are later revise/verify work, not this step's queue.

### 2. Fix — this node's code only
Apply each open issue.
- **Write-scope (blast radius):** edit only *this node's* `src/`·`tests/` and *this node's* Task (+ `tree.md` if you extract/split, and `conventions.md` when the issue is a cross-cutting rule). **Don't edit another existing node's code or Task** to clear an issue — *reading* one is fine, *writing* it is that node's own turn. If a *shared* node must change, that's `grovespec-revise` on it. If the issue's owner is a node that **isn't built yet**, it stays in *this* node's record (Change Log · review record · `conventions.md` when it's a global rule) — **never written into that node's Requirements·Contract·AC.**
- If an issue says a **test was hollow or wrong**, fix the test (and the behavior it should have caught) — not just the code.
- **If an issue means the *spec* is wrong** (the contract, not the code) — stop: that's `grovespec-revise` (a contract change propagates to consumers), not a silent code patch here.
- Keep fixes to exactly what the issues call for — don't refactor beyond them; that just enlarges the next diff to review.
- **Default to subtract.** Prefer removing what made the issue possible, or a line of documentation, over a new mechanism (helper · wrapper · layer) — new code is the next round's input. Put the fix's net line delta (`+N/−N`) in the commit body.
- **Block the cause, not the demonstration.** A fix that only kills the *shown* path (the probe, the mutation, the one repro) leaves the hole for the next round to reach by another path — that case-by-case shape is what turns one hole into ten rounds. If the hole's source can't be removed, say so in the closing message instead of patching the path.
- **Three cases is a class — the counter that enforces the rule above.** Before writing a fix, count this cycle's fix commits that named the same `family` (the review record's round notes carry them). About to write the **third**: do not write case N+1. Either **close the class** — redesign the mechanism the family lives in so the whole shape of counterexample dies (this may be a bigger diff; that is the point) — or **stop and escalate to the human**, naming the family, the case-fixes so far, and why counterexamples keep arriving (an enumeration defending against an open-ended input space usually cannot converge case by case — METHODOLOGY §6).
- **If this round's issues all sit in code the *previous* fix introduced, revert that fix** — don't fix forward. **A revert reopens every item that fix had closed**: they go back to `open_issues` before the re-review, and the next confirmation re-runs their measurements.

### 3. Re-review
**Commit as `TASK-N: fix — <summary>`** (the `TASK-N:` prefix keeps the node's diff boundary mechanical — `FORMATS.md`). **Include the round's records in that commit** — `<id>.review.yaml` and the round files you just wrote: a gate's evidence that never enters git is one clean-up away from gone, and `git add src tests` is exactly how two records in the third run stayed outside it to the end (`validate` reprints a notice for each until they are in). Set the Task `status: fixed`, then **re-run `grovespec-review`** on the same node — it reuses `<id>.review.yaml`, runs the tests again, and re-enters the cycle **where it stands**: a fix of already-*judged* `open_issues` gets one cold **confirmation round scoped to your fix diff + the items it claims closed** (`reviewers.md` §The cycle) — not a fresh full sweep. But if find never ran or closed on this diff (the red-test shortcut sent the node straight here), review runs **find** now — a confirmation cannot stand in for the cold sweep. The `reviewed ⇄ fixed` loop continues until the confirmed list is empty and the last confirmation is clean → `done`.

## When it's done
The open issues are cleared, `status: fixed`, and `grovespec-review` is running again. fix never marks `done` itself — only review's clean terminal pass + human confirm does.

> **Open and close in the step-report shape** (`FORMATS.md` "The step report" — fixed `starting` opening; `Result · Open · Your turn · Next` closing, warm full sentences). Here, *Open / Your turn* typically carry: an issue you could *not* fix (spec-level · shared-node · needs a human ruling).

> **Recommend a new session to re-run `grovespec-review`** (or continue in-session if the fix was tiny). review spawns fresh cold reviewers either way, but a clean orchestrator keeps context bounded across the `reviewed ⇄ fixed` loop (WORKFLOW §5).
