---
name: grovespec-retro
description: The milestone's closing look — when every node is done, ONE cross-node retrospective runs before the next plan. It measures the milestone (grovespec retro), then runs cold lenses that read ACROSS contract seams for defects no node-scoped gate can see, and dispositions the findings into the standing backlogs. It never reopens a node — the milestone stays closed; the next milestone gains its reasons. Use when `grovespec next` names retro, or the user asks for a "milestone retrospective / closing review / grovespec retro / 회고 / 마일스톤 마무리 검토".
---

# grovespec-retro

The one look that crosses node boundaries — for the defect class no node-scoped gate can see (why and the measured case: METHODOLOGY §6) — run **once per milestone**, so its cost scales with milestones, not nodes.

> **Language**: read `config.language` (`node .grovespec/bin/grovespec.mjs lang`) and write every reply and the record in it. These files are English; your output is not.

> **Termination safety — the one rule that must survive every edit of this file.** A capable reviewer asked again always returns *something*, so a closing review that could veto completion is a completion that never comes. The retro **never reopens a node, never blocks `done`, never runs a fix**: its must-fix findings become `- [ ]` items in the standing backlogs (`findings.md` / `restructuring.md`), which the terminal already routes to the next plan. The milestone stays closed; the next milestone gains its reasons.

## Steps

### 1. Measure — the machine speaks first
Run **`node .grovespec/bin/grovespec.mjs retro`**: is a retro owed, and the milestone's numbers (nodes × cycle commits, gate/step commits, escalations, live waits, ratify backlog, fresh debt). Not owed → report that and stop. Owed → **claim the tree:** `node .grovespec/bin/grovespec.mjs claim tree retro` — non-zero = **stop** and report what it printed. Then carry the numbers into the record verbatim, then add the honest prose: what the milestone set out to do (the plan/intent record that opened it), what it cost, where it dragged — name the heaviest node and why (escalations · repeated waves · waits).

### 2. The ledger first — a finding that already exists is cited, never re-raised
Before any lens raises anything, collect the do-not-raise ground: `grovespec followups`, every `(gap)` AC line across the done Tasks, and the `adjudications` in the gate records. A candidate the ledger already measured is **cited with its coordinates**, not re-found (the measured slip: METHODOLOGY §6).

### 3. The cross-node cold wave
Spawn **three cold reviewers** (fresh sessions; they see the tree and the specs, never this milestone's reasoning or any clean-claim; spawned and spoken to once, residents cleared first — `reviewers.md` §Spawning), one lens each — every lens deliberately reads *across* node boundaries:
- **journey** — walk real end-to-end user paths through several nodes' behavior and ask "then what?" at every stop (the lens that catches a dead-end no single node owns).
- **seam** — producer→consumer value lifecycles across Contracts: who writes each shared value, who reads it, and *when*; a consumer built before its producer defines the value is this lens's finding.
- **composition** — states, resources and orderings composed from several nodes' guarantees (lifetimes · locks · sequencing) that no single Contract owns.

Each reviewer reads the tree plus every done node's **id · name · Overview · Contract** (not whole Tasks — that is the cost bound), descending into code only where a trail demands it, with §2's ground handed itemized as do-not-raise. Classify every finding by the fixed categories (`grovespec-review`'s reviewers.md). **One wave**; run a second only if the first confirmed a must-fix (a quiet wave ends it — the retro is a sweep, not a cycle).

### 4. Disposition — into the standing backlogs, never into the milestone it closes
- **Must-fix categories** → one `- [ ]` item each: node-level into `findings.md`, tree-level into `restructuring.md` — each naming its evidence and the nodes it crosses. The next `grovespec-plan` structures them; nothing reopens now.
- **Record categories** (improvement · harmless-bug) → listed in the retro record only.

### 5. The record, then the commit
Write **`<paths.review>/retro-N.md`** (N from the `retro` command's last line): frontmatter `anchor: <git rev-parse HEAD>` **taken before your own commit** (that anchor is what makes the next milestone owe its own retro), then the body — the measured numbers, the milestone's story in plain sentences, the findings table with dispositions, and the lessons a next milestone should read. **Commit as `retro #N: <one-line summary>`** — the record plus the backlog edits, nothing else. Then release the tree: `node .grovespec/bin/grovespec.mjs claim release tree`.

> **Open and close in the step-report shape** (`FORMATS.md` "The step report"). *Your turn* typically carries: the must-fix items now waiting in the backlogs (the next plan's mandatory reading) · the ratify backlog if one exists.

> **Cold means cold**: the session driving this retro must not be one that built or reviewed this milestone's nodes (WORKFLOW §5) — the whole point is eyes that did not watch the milestone happen.
