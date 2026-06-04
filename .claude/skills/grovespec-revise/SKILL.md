---
name: grovespec-revise
description: Changes an already-done node in GroveSpec — either changing its behavior under a new requirement (reopen), or changing the tree structure (split·merge·move). The key question is "did the contract change" — if it did, find the nodes that used that contract and re-review them (propagation); if not, fix just that spot. Use when the user wants to "change·fix this (already-done) thing / the requirement changed / split·merge·move this node / grovespec revise". For specs·implementation of not-yet-built nodes, use grovespec-grow·implement.
---

# grovespec-revise

Changing an already-`done` node *later*. (Fixing mid-build happens inside grow/implement.)

## The question that decides everything
> **Did the contract change?**
> - Unchanged → just that spot. *Don't touch the other nodes that use it.*
> - Changed → re-review the nodes that used that contract — the *consumer set*, computed mechanically (below) (propagation). This is the most expensive part.

**Don't eyeball this — make it mechanical.** Diff the node's `Contract` section (before vs after). *Any* changed line — added, removed, reworded — counts as changed; when unsure, treat it as changed. The asymmetry is the point: a false "unchanged" silently breaks every consumer (the one drift GroveSpec exists to stop), while a false "changed" just costs one cheap extra review. **Bias to changed.**

**And make the consumer set mechanical too.** When the contract changed, *consumers* = (a) every Task whose `blocked_by` lists this node's id ∪ (b) code/specs that grep-hit this node's **exported symbol names** (from its Contract) across `src/` + `tasks/`. Grep the *symbol*, never the node name (names get renamed — `FORMATS.md`). The re-review set is that union; it's complete when both lists are enumerated. *Under-counting here is exactly the silent drift the whole tool exists to stop.*

Don't make clones — one node = one Task. Old code lives in git; why it changed lives in the Change Log.

## Two kinds of change

### A. Behavior change (reopen)
1. Reopen the node: `status` `done` → `in-progress`.
2. Change it (spec·code).
3. **If the contract changed** → compute the consumer set (above) and re-review them with `grovespec-review` (propagation). If it didn't change, skip this.
4. Review with `grovespec-review` → fix. **Pass the scope**: *did the contract change* (the top question) + *consumer count* (counted in step 3) → review picks the strength level (for a small change with an unchanged contract, `light`/`skip`). Re-invoke on the same node (reuses its `<id>.yaml`); on an `escalated` return, stop — don't re-close the node.
5. Record *why it changed* in the Change Log. `status` → `done`.

### B. Structure change (split·merge·move)
Change the shape in **`tree.md` only** — it's the single source of truth for parent-child structure; Task files don't record parent or children (`FORMATS.md`). Here too, if the contract changes, propagate (consumer set as above).

- **Move**: re-indent the node under its new parent in `tree.md`. The node's own Task·code stays (if the contract didn't change). ✅ exactly one parent in tree.md after the move. ❌ left under the old parent *and* the new → two parents, structure corrupted. Usually "it's used in several places → move it up."
- **Split**: add the children's ids under this node in `tree.md` + divide the node's content into the new children's Tasks. *Keep the outer contract and split only the inside* → users aren't touched (the default). Split the outer contract too → that *is* a contract change: it reopens every consumer; compute the consumer set (above) first, so you see the blast radius before committing.
- **Merge**: two ids into one in `tree.md`, merge the Task content into the surviving Task. Any node whose `blocked_by` listed either one now points at the merged node (update those).

> Prefer *keeping the outer contract* — that's what keeps the partial tree small and contained.

## Session
Thin — read only the Task·relevant code of the node you're changing, and (if propagating) the nodes that use the contract.

## When it's done
The changed node is `done` again, with the reason in the Change Log. If the contract changed, the consumers have been re-reviewed and are coherent again.
