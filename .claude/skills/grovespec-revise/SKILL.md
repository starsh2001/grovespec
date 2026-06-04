---
name: grovespec-revise
description: Changes an already-done node in GroveSpec — change its behavior under a new requirement (reopen), change the tree structure (split·merge·move), or promote a leaf to a skeleton (it grew to need children). The key question is "did the contract change" — if it did, find the nodes that used that contract and re-verify·re-review them (propagation); if not, fix just that spot. Use when the user wants to "change·fix this (already-done) thing / the requirement changed / scale this up / split·merge·move this node / grovespec revise". For not-yet-built nodes use grovespec-grow·verify·implement.
---

# grovespec-revise

Changing an already-`done` node *later*. (Fixing mid-build is `grovespec-verify` for the spec, and `grovespec-review` → `grovespec-fix` for the code.)

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `bash .grovespec/bin/grovespec lang`) and write **every** reply in that language. These files are English; your output is not.

> **Decisions: recommend + leave a way out.** When you ask the user to decide (split·merge·move, how to change…): **mark your recommended option `(추천)`** with a one-line why, and **always allow a free-form answer** (the AskUserQuestion tool's *Other*, or an explicit free-form choice in an inline list). Don't force a closed pick.

## The question that decides everything
> **Did the contract change?**
> - Unchanged → just that spot. *Don't touch the other nodes that use it.*
> - Changed → re-review the nodes that used that contract — the *consumer set*, computed mechanically (below) (propagation). This is the most expensive part.

**Don't eyeball this — make it mechanical.** Diff the node's `Contract` section (before vs after). *Any* changed line — added, removed, reworded — counts as changed; when unsure, treat it as changed. The asymmetry is the point: a false "unchanged" silently breaks every consumer (the one drift GroveSpec exists to stop), while a false "changed" just costs one cheap extra review. **Bias to changed.**

**And make the consumer set mechanical too.** When the contract changed, *consumers* = (a) every Task whose `blocked_by` lists this node's id ∪ (b) code/specs that grep-hit this node's **exported symbol names** (from its Contract) across `src/` + `tasks/`. Grep the *symbol*, never the node name (names get renamed — `FORMATS.md`). The re-review set is that union; it's complete when both lists are enumerated. *Under-counting here is exactly the silent drift the whole tool exists to stop.*

Don't make clones — one node = one Task. Old code lives in git; why it changed lives in the Change Log.

## Two kinds of change

### A. Behavior change (reopen)
1. **Reopen** to the earliest status the change touches: `done` → `draft` if the spec/contract changes (needs re-`verify`), or `done` → `approved` if only the code changes (spec still valid → re-`implement` → re-`review`).
2. Change it (spec and/or code), then run it forward through the normal gates from there: `draft` → `grovespec-verify` → `grovespec-implement` → `grovespec-review` → `done`; or `approved` → `grovespec-implement` → `grovespec-review` (→ `fix`) → `done`.
3. **If the contract changed** → compute the consumer set (above) and **propagate**: reopen each consumer the same way (its spec touched → `draft` + re-`verify`; only its code touched → `approved` + re-`implement` → re-`review`) and run it forward. The expensive part — bias to doing it; a missed consumer is the silent drift this whole tool exists to stop. (`grovespec impact <id>` lists the blast radius.)
4. Record *why it changed* in the Change Log of each touched node; each returns to `done` through its own gate. On an `escalated` verify/review, stop — don't re-close that node.

### B. Structure change (split·merge·move)
Change the shape in **`tree.md` only** — it's the single source of truth for parent-child structure; Task files don't record parent or children (`FORMATS.md`). Here too, if the contract changes, propagate (consumer set as above).

- **Move**: re-indent the node under its new parent in `tree.md`. The node's own Task·code stays (if the contract didn't change). ✅ exactly one parent in tree.md after the move. ❌ left under the old parent *and* the new → two parents, structure corrupted. Usually "it's used in several places → move it up."
- **Split**: add the children's ids under this node in `tree.md` + divide the node's content into the new children's Tasks. *Keep the outer contract and split only the inside* → users aren't touched (the default). Split the outer contract too → that *is* a contract change: it reopens every consumer; compute the consumer set (above) first, so you see the blast radius before committing.
- **Merge**: two ids into one in `tree.md`, merge the Task content into the surviving Task. Any node whose `blocked_by` listed either one now points at the merged node (update those).

> Prefer *keeping the outer contract* — that's what keeps the partial tree small and contained.

### C. Leaf grew to need children (feature → skeleton)
A `done` `feature` turns out to need sub-nodes ("scale this up / more behavior attaches here"). Reopen it, set `role: skeleton`, and **record its decomposition in the Change Log** (the children + which Contract clause each owns — exactly as `implement` would). Then:
- **Outer Contract unchanged** (it just gains internal structure) → consumers untouched; re-`implement` its own structural code if needed → `review` → `done`, then `grovespec-grow` each child one at a time.
- **Outer Contract changed** → propagate to consumers as in A.3 first.
The role promotion *is* the change; the children themselves are grown afterward, normally.

## Session
Thin — read only the Task·relevant code of the node you're changing, and (if propagating) the nodes that use the contract.

## When it's done
The changed node is `done` again, with the reason in the Change Log. If the contract changed, the consumers have been re-reviewed and are coherent again.
