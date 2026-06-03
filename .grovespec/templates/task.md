---
id: TASK-0
name: "{node name}"
role: feature              # skeleton | feature
status: backlog            # backlog | todo | in-progress | review | done
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
{What it guarantees to the outside (the parent · other nodes): what it takes · what it gives · invariants (units · order · empty cases). Other nodes rely on this without seeing the internals.}

## AC
- [ ] {acceptance criterion}
  - [ ] {detail}

## Subtasks
- [ ] {implementation step}

## Change Log
- {YYYY-MM-DD} — {what changed and why, conceptually. Code diffs live in git.}
