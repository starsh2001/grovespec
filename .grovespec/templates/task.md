---
id: TASK-0
name: "{node name}"
role: feature              # skeleton (has children) | feature (leaf) — confirmed at implement
status: draft              # sketch | draft | approved | implemented | reviewed | fixed | done  (greenfield is born sketch; grow → draft)
blocked_by: []             # [TASK-2, ...] / [] if none
refs: []                   # canonical sorted [spec.md@4, spec.md@5.4] / [] = intentionally no ref source
tdd: true                  # true | false
tdd_skip_reason: ""        # required when tdd: false

---

# TASK-0 · {node name}

> {One line: what this node is responsible for. The lede a person reads before deciding whether to read on — not a restatement of the Overview's first sentence, and not the machine fields above.}

<!-- The blank line above the closing `---` is load-bearing: without it a Markdown renderer turns the whole frontmatter into this document's biggest heading. The `# TASK-N · name` title and the `>` lede replace it as the top of the page — keep both, and keep the title's id·name equal to the frontmatter's. Headers below are FIXED (the parser contract). Write the CONTENT in the project's language (config.language) — plain words, no coined terms, readable in one pass by someone new to the project. This file is read by a person and an agent alike (→ FORMATS.md "How the prose is written" · "How it reads when rendered" · "Layout"). -->

## Overview
{What this node is, and why. 2-3 sentences.}

## Requirements
{What it must do. From the user's point of view.}

## Contract
{What it guarantees to the outside (the parent · other nodes): what it takes · what it gives · invariants (units · order · empty cases). Other nodes rely on this without seeing the internals. The line is **consumer observability**: public names·boundary shapes·errors·ordering·observable atomicity/concurrency promises are contract; algorithms·private structure·transaction internals belong to implement or to children. Defer mechanism + child-owned edges with a marker — `[→ child/deferred: <what>]` — rather than pinning them here; a skeleton stays lean and defers most detail.}

## AC
<!-- One checkable claim per item, ≤200 characters — a plain item, no checkbox (the spec seal covers AC). The fixture, the number, the "this is what breaks" — those are NESTED items under it, not more sentences appended to it. Measurable non-functional targets (latency · throughput · error rate) are checkable items too, e.g. "- p95 < 200ms @ 100 rps". An item prefixed "(gap)" = behavior deliberately left undefined (see FORMATS: verify probes it; implement/review skip it). -->
- {one claim, stated so a reader can tell pass from fail}
  - {the fixture or number that settles it}

## Subtasks
<!-- A skeleton/root also builds its OWN structural deliverable (the glue/shell children slot into; the root: base environment + the walking skeleton — one real path through the main components) — include that as a step, not only delegating to its children. -->
- [ ] {implementation step}

## Change Log
<!-- The entries live in their own file, changelog/TASK-0.md beside this one (template: .grovespec/templates/changelog.md) — every step and every cold reviewer reads this file whole, so the history stays out of it. This section keeps only the link below; set its id to this node's. -->
- [changelog/TASK-0.md](changelog/TASK-0.md)
