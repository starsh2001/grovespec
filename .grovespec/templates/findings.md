<!--
GroveSpec findings — brownfield backlog of NODE-LEVEL work spotted while mapping existing code into the tree.
The tree itself stays all-`done` (it maps what exists); these are parked, draft items that do NOT go in the tree.
Resolve each via the named step, then check it off (or delete it). Created only when there's something to record.
Optional leading severity tag is fine (e.g. `[high]`) so a board can sort. Content in config.language.
A board (e.g. Hammoc) can read this file and show each line as a draft issue. TREE-SHAPE problems go in restructuring.md.
-->

## Bugs
<!-- A defect in already-`done` code. Map the node as-is, but leave the broken AC item unchecked; fix later via `grovespec-revise` (reopen → fix). -->
- [ ] TASK-N {node} — {what's wrong, briefly} → revise

## Duplications
<!-- The same logic in 2+ places that isn't a shared node yet (Principle 3 — extract on discovery). Resolve: `grovespec-grow` the shared node, then repoint the callers via `grovespec-revise`. -->
- [ ] {the duplicated logic} @ TASK-A · TASK-B {· …} — → extract shared node

## Doc ↔ code mismatches
<!-- Only when reference docs exist. The design doc and the code disagree — that disagreement is signal, not noise. Per line say which it is: code wrong (→ a bug, revise) · doc describes unbuilt behavior (→ build it? a new node) · doc merely stale (→ note, leave ref as-is). -->
- [ ] {topic} — doc says {X}, code does {Y} → {bug | build it | doc stale}
