---
name: grovespec-retro
description: The milestone's closing look — when every node is done, ONE cross-node retrospective runs before the next plan. It measures the milestone (grovespec retro), runs the close run (the whole suite and the product, once — a failure reopens the node it points at), then cold lenses that read ACROSS contract seams for defects no node-scoped gate can see, their findings dispositioned into the standing backlogs — the lenses never reopen anything. Use when `grovespec next` names retro, or the user asks for a "milestone retrospective / closing review / grovespec retro / 회고 / 마일스톤 마무리 검토".
---

# grovespec-retro

The one look that crosses node boundaries — for the defect class no node-scoped gate can see (why and the measured case: METHODOLOGY §6) — run **once per milestone**, so its cost scales with milestones, not nodes.

> **Language**: read `config.language` (`node .grovespec/bin/grovespec.mjs lang`) and write every reply and the record in it. These files are English; your output is not. **What a retro closes is a *milestone*** in every language and in everything you write — replies, the record's headings, the commit. *Round* is only a review round: where an earlier `retro-N.md` or plan record calls the milestone a round, don't copy their word.

> **Termination safety — the one rule that must survive every edit of this file.** A capable reviewer asked again always returns *something*, so a closing review that could veto completion is a completion that never comes. The retro's lenses **never reopen a node, never block `done`, never run a fix**: their must-fix findings become `- [ ]` items in the standing backlogs (`findings.md` / `restructuring.md`), which the terminal already routes to the next plan. **The one exception is the close run (§2):** a failed run holds the milestone open until a fix — a run, unlike a reviewer, passes once fixed (METHODOLOGY §6).

## Steps

### 1. Measure — the machine speaks first
Run **`node .grovespec/bin/grovespec.mjs retro`**: is a retro owed, and the milestone's numbers (nodes × cycle commits, gate/step commits, escalations, live waits, ratify backlog, fresh debt). Not owed → report that and stop. Owed → **claim the tree:** `node .grovespec/bin/grovespec.mjs claim tree retro` — non-zero = **stop** and report what it printed. Then carry the numbers into the record verbatim, then add the honest prose: what the milestone set out to do (the plan/intent record that opened it), what it cost, where it dragged — name the heaviest node and why (escalations · repeated waves · waits). To each work package the measure lists, add what the host measured where it can (sessions, tokens); for one far over or under its budget, propose the next budget in the record — the person sets it (`config packages:`).

### 2. The close run — the suite and the product, once
The node reviews ran only `review.test`; the slow suite and the product itself run here, once, on the code the milestone closes on:
- **`node .grovespec/bin/grovespec.mjs test milestone`** runs `milestone.test` (`review.test` when it is empty) and records the result with the commit it ran on; it refuses uncommitted product changes. A suite that outlasts your shell's time limit runs in the background and the turn waits for it (`reviewers.md` §Spawning) — a run the shell cut off is rerun, never read as a failure.
- **The direct run:** start the product and walk the paths this milestone added or changed, end to end, keeping what it printed or showed. A run that touches the person's machine waits for their OK (`FORMATS.md` "The person's machine").
- **Both pass** → run `grovespec retro` again: its `next record:` line now names the record, and §3 goes on.
- **Either fails** → the milestone does not close. Find the node that owns the failing behavior — the failing test's node (`grovespec files TASK-N`), or the node whose Contract promises it — and reopen it as `grovespec-revise` §A does: `approved` when its code is wrong, `draft` when its spec must change, and when that is its Contract, its consumers declared as recheck candidates in the same commit. Write what failed into its Change Log, then **commit as `retro #N: close run failed — reopened TASK-N (<what failed>)`** with the log and the reopen's bytes, release the tree, and stop. `next` then routes to that node, and the retro reruns once it is done.
- A failure that is not the product's (the environment, an outside service that is down) is asked: fix it and rerun. The milestone closes only on a passing run.

### 3. The ledger first — a finding that already exists is cited, never re-raised
Before any lens raises anything, collect the do-not-raise ground: `grovespec followups`, every `(gap)` AC line across the done Tasks, and the `adjudications` in the gate records. A candidate the ledger already measured is **cited with its coordinates**, not re-found (the measured slip: METHODOLOGY §6).

### 4. The cross-node cold wave
Spawn **three cold reviewers** (fresh sessions; they see the tree and the specs, never this milestone's reasoning or any clean-claim; spawned and spoken to once, residents cleared first — `reviewers.md` §Spawning), one lens each — every lens deliberately reads *across* node boundaries:
- **journey** — walk real end-to-end user paths through several nodes' behavior and ask "then what?" at every stop (the lens that catches a dead-end no single node owns).
- **seam** — producer→consumer value lifecycles across Contracts: who writes each shared value, who reads it, and *when*; a consumer built before its producer defines the value is this lens's finding.
- **composition** — states, resources and orderings composed from several nodes' guarantees (lifetimes · locks · sequencing) that no single Contract owns.

Each reviewer reads the tree plus every done node's **id · name · Overview · Contract** (not whole Tasks — that is the cost bound), descending into code only where a trail demands it, with §3's ground handed itemized as do-not-raise. Classify every finding by the fixed categories (`grovespec-review`'s reviewers.md). **One wave**; run a second only if the first confirmed a must-fix (a quiet wave ends it — the retro is a sweep, not a cycle).

### 5. Disposition — into the standing backlogs, never into the milestone it closes
- **Must-fix categories** → one `- [ ]` item each: node-level into `findings.md`, tree-level into `restructuring.md` — each naming its evidence and the nodes it crosses. The next `grovespec-plan` structures them; nothing reopens now.
- **Record categories** (improvement · harmless-bug) → listed in the retro record only.

### 6. The record, then the commit
Write **`<paths.review>/retro-N.md`** (N from the `retro` command's `next record:` line): frontmatter `anchor: <git rev-parse HEAD>` **taken before your own commit** (that anchor is what makes the next milestone owe its own retro), then the body — the measured numbers, the close run's result, the milestone's story in plain sentences, the findings table with dispositions, and the lessons a next milestone should read. **Commit as `retro #N: <one-line summary>`** — the record, the close run's log and the backlog edits, nothing else. Then release the tree: `node .grovespec/bin/grovespec.mjs claim release tree`.

> **Open and close in the step-report shape** (`FORMATS.md` "The step report"). *Your turn* typically carries: a failed close run and the node it reopened · the must-fix items now waiting in the backlogs (the next plan's mandatory reading) · the ratify backlog if one exists.

> **Cold means cold**: the session driving this retro must not be one that built or reviewed this milestone's nodes (WORKFLOW §5) — the whole point is eyes that did not watch the milestone happen.
