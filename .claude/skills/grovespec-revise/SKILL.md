---
name: grovespec-revise
description: Changes an already-done node in GroveSpec — either changing its behavior under a new requirement (reopen), or changing the tree structure (split·merge·move). The key question is "did the contract change" — if it did, find the nodes that used that contract and re-review them (propagation); if not, fix just that spot. Use when the user wants to "change·fix this (already-done) thing / the requirement changed / split·merge·move this node / grovespec revise". For specs·implementation of not-yet-built nodes, use grovespec-grow·implement.
---

# grovespec-revise

Changing an already-`done` node *later*. (Fixing mid-build happens inside grow/implement.)

## The question that decides everything
> **Did the contract change?**
> - Unchanged → just that spot. *Don't touch the other nodes that use it.*
> - Changed → find the nodes that used that contract (grep + tree) and re-review them (propagation). This is the most expensive part.

**Don't eyeball this — make it mechanical.** Diff the node's `Contract` section (before vs after). *Any* changed line — added, removed, reworded — counts as changed; when unsure, treat it as changed. The asymmetry is the point: a false "unchanged" silently breaks every consumer (the one drift GroveSpec exists to stop), while a false "changed" just costs one cheap extra review. **Bias to changed.**

Don't make clones — one node = one Task. Old code lives in git; why it changed lives in the Change Log.

## Two kinds of change

### A. Behavior change (reopen)
1. Reopen the node: `status` `done` → `in-progress`.
2. Change it (spec·code).
3. **If the contract changed** → find the nodes that use that contract (grep + tree) and re-review them with `grovespec-review` (propagation). If it didn't change, skip this.
4. Review with `grovespec-review` → fix. **Pass the scope**: *did the contract change* (the top question) + *consumer count* (counted in step 3) → review picks the strength level (for a small change with an unchanged contract, `light`/`skip`).
5. Record *why it changed* in the Change Log. `status` → `done`.

### B. Structure change (split·merge·move)
Change the tree.md shape + **the parent Task('s) child list** (parents record their children). Here too, if the contract changes, propagate.

- **Move**: shift the position in tree.md + remove the child from the old parent's Task and add it to the new parent's Task. The node's own Task·code stays (if the contract didn't change). Usually "it's used in several places → move it up."
- **Split**: add children in tree.md + update the parent Task + divide the node's content into the new children's Tasks. *If you keep the outer contract and split only the inside*, the users aren't touched (the default). If you split the outer contract too → re-review the users.
- **Merge**: two into one. Update tree.md·parent Task, merge the Task content. Any node that used either one now points at the new node.

> Prefer *keeping the outer contract* — that's what keeps the touched area small and contained.

## Session
Thin — read only the Task·relevant code of the node you're changing, and (if propagating) the nodes that use the contract.

## When it's done
The changed node is `done` again, with the reason in the Change Log. If the contract changed, the consumers have been re-reviewed and are coherent again.
