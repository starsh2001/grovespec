---
name: grovespec-plan
description: The planning pass — decides what to build next, then ends at the tree gate. Two modes by project state. Empty tree (greenfield, right after init) = plan #0 — draw out the intent (explore), write the intent record + brief, lay the whole sketch tree. Tree all done + parked work (followups · brownfield findings/restructuring backlogs · fresh hand-edits · new wants) = plan #N — collect it all, cluster, propose a disposition per cluster (reopen · structural change · new node · consciously drop), get the human's confirmation, translate into reopens/grows so `grovespec next` picks the work up again. Use when the user wants to "plan the next sprint / work off the followups / structure the backlog / what should the next round be / grovespec plan / 다음 스프린트 계획", or when `grovespec next` answers `next: plan`. For a single small change skip the ceremony — grovespec-revise directly.
---

# grovespec-plan

The planning pass. `init` records what *is* (config; brownfield: the surveyed tree); **plan decides what to build next** — from intent (plan #0) or from what the last round parked (plan #N) — and every plan ends at the **tree gate** (cold verify + human approval) before any node is built.

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `node .grovespec/bin/grovespec.mjs lang`) and write **every** reply in that language. These files are English; your output is not.

> **Decisions: recommend + leave a way out.** Every disposition you put to the user marks a recommended option `(추천)` with a one-line why, and always allows a free-form answer (AskUserQuestion's *Other*). Don't force a closed pick.

## Which mode — decided by the project's state
Run `node .grovespec/bin/grovespec.mjs next` (or look): **the tree is empty** → plan #0. **Every node is done + parked work exists** → plan #N. Anything else — nodes mid-build — is not plan's moment: the build cycle (`grow`/`verify`/`implement`/`review`) owns it; say so and stop.

## plan #0 — greenfield: lay the tree from intent
The one-time big exploration (this is what used to live in init):
1. **Draw out the intent** — `references/explore.md` (+ `elicitation.md` for the question mechanics). Rough idea → explore thoroughly; a user's spec doc → keep the original (`references/ref-docs.md`) and fill only the gaps it leaves blank.
2. **Write the intent record** — the detailed spec, saved under `ref/` with the location map (`ref-docs.md`). It is **frozen from here** (the ref series rule — FORMATS): later plans add new dated records; nobody edits an old one.
3. **Write `brief.md`** — the lean overview extracted from it: direction · scope · visible risks. The living scope SSoT (plan is also the only step that later amends it).
4. **Lay the whole tree as sketches** — `references/spec-to-tree.md`: every node one-line responsibility + rough I/O, `status: sketch`; mark the root's own deliverable (base env + runnable empty shell).
5. **End at the tree gate** — next is `grovespec-verify` on the tree (`target_type: tree`, the decomposition checklist D1–D5) → fix → human approves the vetted tree. Then the per-node build begins, top-down.

## plan #N — sprint planning: structure the parked work
The project is at "every node done + a backlog" (a finished sprint — which is also exactly where a brownfield adoption stands after its fidelity gate).

1. **Collect — mechanically.** `node .grovespec/bin/grovespec.mjs followups` (every parked finding across all gate records + the findings/restructuring backlog counts) and `grovespec fresh` (hand-edits that skipped the skills). Read the named review files and backlog files for the substance. Ask the user for **new wants** — anything they now know they need (this is a small `explore.md` pass, not a re-interview).
   - **It comes ordered — work it in that order.** `followups` names anything still graded **blocking** first (critical · should-fix, whatever its reach — `gate2: yes` lifts the cap, so a shown break of a promised clause can be critical with no verified hole), then groups the rest by `gate1`, the reach each item already answered for at its gate: **behavior** (the wrong behavior runs today) → **mechanism** (verified hole, one ordinary step reaches it) → **contrived · story**. The blocking block and the behavior group are what a human must rule on item by item; below them, cluster and dispose in bulk. A pool of 150 read flat is a pass that weighs everything before it can start anything — and the item whose wrong behavior runs today is somewhere in the middle of it.
   - **Don't re-grade to sort.** The order is the gate answers, already given by cold reviewers with the evidence in front of them; a planning pass that re-argues them is re-litigating a settled call. Bring a *changed* grade only with new measurement, and say what you measured.
2. **Cluster by `family`, not by node.** Three nodes each parking the same hole is **one design decision**, not three chores. Fresh signals join the cluster of the node they touch.
3. **Propose a disposition per cluster** — each with a recommendation and a way out:
   - **reopen** — behavior change on existing nodes → `grovespec-revise` will run it (spec touched → reopen to `draft`; code-only → `approved`).
   - **structural** — split · merge · move · a new shared node → tree.md change + sketch Tasks (`grovespec-grow` details them later).
   - **drop, consciously** — **move** the item: delete it from `followups` and record the verdict + reason in the *origin* review file's `adjudications` (adjudications never leave their file — the entry is the durable record). The deletion is what dries the pool: `followups`/`next` count only what still sits in a `followups` list, so a drop that leaves the item in place resurfaces forever.
4. **Human confirms the disposition table.** This is the decision of the pass — nothing is applied before it.
5. **Write the dated intent record** — a new file in `ref/` (never edit an old one): the new wants, **deltas only, each naming what it supersedes** ("this section replaces spec.md §4.1's X"), and the confirmed disposition table. Update `ref/index.md` so every topic points at its *current* record — the index moves, the records don't. Amend `brief.md` only if the scope itself changed.
6. **Apply** — drops → the move above (delete the `followups` item + write its adjudication); reopens → `node .grovespec/bin/grovespec.mjs reopen TASK-N draft|approved` (never hand-edit a status); new/structural → tree.md + sketch Task files, **each new id from `node .grovespec/bin/grovespec.mjs id`** (never counted by eye — it skips every number that ever existed, so a retired node's history can't attach to a new node); check off consumed backlog items in findings/restructuring.md.
7. **End at the tree gate when the tree's shape changed** (new/moved/split nodes) — `grovespec-verify` the tree explicitly (D1–D5; a small delta reviews at `light`, on a built tree reviewers read id·name·Overview only — reviewers.md). Shape unchanged (reopens only) → `validate`, and the build cycle takes over.

After either mode: `grovespec next` drives again — plan opened the doors; it never builds. **Plan edits no node's code**, and its write scope is: `ref/` (new record + index) · `brief.md` · `tree.md` · new sketch Tasks · reopen commands · adjudication entries in review files · backlog checkoffs.

**Commit as `plan #0: <summary>`** / `plan #N: <summary>` — everything the pass wrote: the `ref/` record + index, `brief.md`, `tree.md`, the new sketch Tasks, the adjudication edits, the backlog checkoffs, **and the `reopen` results** (the status-flipped Task files + their reset gate records — the same bytes revise commits when it runs the same command). Never a `TASK-N: ` prefix (that anchor belongs to a node's code cycle — `FORMATS.md` "Commits").

## What plan is not
- **Not a gate bypass.** A disposition cannot close an open issue — open issues belong to the fix/verify loop that owns them.
- **Not required for one small item.** A single trivial followup → `grovespec-revise` directly; a two-item sprint needs no ceremony.
- **Not a re-interview.** Config (language · strength · models) is init's; re-invoke init to reconfigure.

> **Where it runs.** Main session — the tree gate it ends on spawns cold reviewers as subagents (never run a grovespec skill *as* a subagent).

> **Open and close in the step-report shape** (`FORMATS.md` "The step report" — fixed `starting` opening; `Result · Open · Your turn · Next` closing, warm full sentences). Here, the closing's substance is: the disposition table · what was dropped and why · what the next sprint will build.

> **Recommend a new session for the next step** (the tree verify, or the first reopened node's cycle). Clean, bounded context per step (WORKFLOW §5). *(Driving with `grovespec next` in a loop? `@new` already starts that session — this recommendation is for a person going step by step, and it is never a reason to end the loop.)*
