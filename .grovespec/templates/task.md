---
id: TASK-0
name: "{node name}"
role: feature              # skeleton (has children) | feature (leaf) — confirmed at implement
status: draft              # sketch | draft | approved | implemented | reviewed | fixed | done  (greenfield is born sketch; grow → draft)
blocked_by: []             # [TASK-2, ...] / [] if none
tdd: true                  # true | false
tdd_skip_reason: ""        # required when tdd: false
---

<!-- Headers below are FIXED (the parser contract). Write the CONTENT in the project's language (config.language). -->

## Overview
{What this node is, and why. 2-3 sentences.}

## Requirements
{What it must do. From the user's point of view.}

## Contract
{What it guarantees to the outside (the parent · other nodes): what it takes · what it gives · invariants (units · order · empty cases). Other nodes rely on this without seeing the internals. State the *contract*, not the *mechanism* — atomicity·schemas·concurrency·API shapes belong to implement or to children. Defer mechanism + child-owned edges with a marker — `[→ child/deferred: <what>]` — rather than pinning them here; a skeleton stays lean and defers most detail.}

## AC
<!-- Measurable non-functional targets (latency · throughput · error rate) go here as checkable items, e.g. "- [ ] p95 < 200ms @ 100 rps". An item prefixed "(gap)" = behavior deliberately left undefined (see FORMATS: verify probes it; implement/review skip it). -->
- [ ] {acceptance criterion}
  - [ ] {detail}

## Subtasks
<!-- A skeleton/root also builds its OWN structural deliverable (the glue/shell children slot into; the root: base environment + an empty runnable shell) — include that as a step, not only delegating to its children. -->
- [ ] {implementation step}

## Change Log
<!-- Also record review outcomes + any dropped-as-nitpick / accepted-gap adjudications (with the reason) here, so a future cold review doesn't re-litigate them. For a skeleton, record the decomposition here too: which children it needs + which Contract clause each child owns. -->
- {YYYY-MM-DD} — {what changed and why, conceptually. Code diffs live in git.}
