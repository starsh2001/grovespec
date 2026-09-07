# GroveSpec workflow and skills

> This document defines how GroveSpec actually runs — which steps, in what order, what comes out, and how the skills are divided.
> The *why* lives in [METHODOLOGY.md](METHODOLOGY.md).

---

## 1. The big picture

GroveSpec's goal is to **minimize the drift between spec and code**. To do that, whatever you change, you keep the changed area to a **partial tree**: the node you change plus the few nodes its contract touches (its children and its consumers), never the whole tree.

```
init (once: config · scaffolding; brownfield: survey the code → all-done tree + backlogs → fidelity gate)
  → plan (#0 greenfield: intent → whole tree as sketches · brownfield #1: backlog → the first round)
  → verify (tree):  cold review the decomposition (D1–D5) → fix → human approve
  → per node:  grow (detail sketch → draft) → verify → implement → review ⇄ fix → done
  → every node done + parked work (followups · backlogs) → plan (#N: the next round) → …
  → revise (a single done node, anytime — no plan needed for one small change)
```

- **init records what *is*** (config; brownfield: the surveyed code); **plan decides what to build next** — the split is by truth criterion: init's outputs are checkable against the machine/code, plan's come from the user's intent.
- The whole tree is **sketched at plan #0**; each node is then *detailed* and gated top-down, **one node at a time**.
- A finished round leaves **parked work** — non-blocking `followups` in the gate records, the brownfield backlogs, hand-edits `fresh` reports. `grovespec next` routes an all-done tree with parked work back to **plan**, which clusters it, gets the human's disposition (reopen · structural change · consciously drop), and translates it into reopens/grows the driver picks up again. Sprints, without the driver ever ending silently on known work. (`fresh`'s bound: committed history is classified from the adoption anchor at the repo toplevel; a project nested in a larger repo contributes its **uncommitted** src/tests changes only — `fresh` states this in its output, and `next`'s quiet terminal line carries the same caveat instead of a bare "every node is done".)
- Each node is detailed by `grow` (sketch → `draft`), cold-**verified** into `approved`, then **implemented**, then **reviewed** (its tests + a cold code review of its *diff*) with a **fix** loop — ending `done`. A `done` node's already-sketched children are then detailed.
- The human confirms at a glance: the **sketch tree** (after init), the **spec** (after verify), and the **result** (after review).
- **No id bookkeeping**: run any step skill *without a target* and it picks the node `grovespec check` reports ready for that step (status → next: `sketch`→grow · `draft`→verify · `approved`→implement · `implemented`→review · `reviewed`→fix). You advance by "do the next thing" — the human gates still pause you.

---

## 2. The eight skills

Eight units — one per step of a node's life, plus the planning pass between rounds.

### init — set up the project (and reconfigure)
- **When**: at the start; **re-invoke anytime to *reconfigure*** (re-asks the setup interview, updates config, doesn't recreate the project).
- **What**: the **fixed setup interview** (`references/setup.md`: language · review strength · reviewer models → config; the test command is not asked — brownfield auto-detects it, greenfield derives it at the first review). Greenfield: create the empty scaffolding and hand to plan #0 — init asks nothing about the product. Brownfield: **survey the code** (`references/code-to-tree.md`) into the whole existing tree as `done` (`origin: mapped`, honest even if ugly), park what's wrong in `findings.md`/`restructuring.md`, write the code-derived brief, and end at the **survey fidelity gate** (verify-tree F1–F4 — the map is an agent's claim, so it's cold-checked against the code before anything trusts it).
- **Output**: `.grovespec/config.yaml`; brownfield: tree.md + tasks/ (all `done`), brief.md (from the survey), conventions.md, backlogs.

### plan — decide what to build next (the pass between rounds)
- **When**: the tree is empty (greenfield, right after init = **plan #0**), or every node is `done` and parked work exists (= **plan #N**; also brownfield's first move after the fidelity gate). `grovespec next` names it.
- **What**: **#0** — draw out the intent (`references/explore.md`), write the frozen intent record (ref/) + brief, lay the whole all-`sketch` tree (`references/spec-to-tree.md`). **#N** — collect the parked work (`grovespec followups` + backlogs + `fresh` + new wants), **cluster by family** (three nodes parking the same hole = one design decision), propose a disposition per cluster (reopen · structural change · consciously drop with the verdict recorded in the origin record's adjudications), **human confirms the table**, then write a *new dated* intent record (deltas naming what they supersede; the index points at current truth) and translate: reopens (`grovespec reopen`) + new sketch nodes. Both modes **end at the tree gate**.
- **Output**: ref/ intent record + index update, brief (new or amended), tree.md + sketch Tasks, reopens applied — the doors `next` drives through.

### grow — detail a sketch into a draft (or add a new node)
- **When**: the next `sketch` node whose parent is `done` (`grovespec check` lists it) — the initial-build detailing step; or a brand-new node beyond the spec (expansion).
- **What**: write the node's full Contract·AC from the reference spec (sketch → `draft`), no code (→ §4). It does **not** (re)define its children (greenfield they're already sketched) and does **not** review (verify does).
- **Output**: tasks/TASK-N.md (`draft`).

### verify — cold-check the draft (or the whole tree), approve it
- **When**: a node is `draft` (`target_type: spec`); **or** on the whole tree (`target_type: tree`) — at plan #0/after a structural change (the *decomposition* gate) or right after a brownfield init (the *survey fidelity* gate).
- **What**: several *cold* fresh-eyes reviewers sweep in waves (find) until the strategy ledger is exhausted; ONE triage grades everything (judge); fixes are confirmed against their own diff (fix); then the human approves. **spec** → roles check the node's contract (C1–C6) → `draft` → `approved`. **tree, decomposition** → roles check the decomposition (D1–D5: scope coverage · system completeness · actor closure · boundaries · depth) → fix → human approves the vetted tree → the per-node build begins. **tree, fidelity** → roles check the mapped tree *against the code* (F1–F4: coverage · contract↔behavior · no beautification · backlog honesty) → human approves the vetted survey → plan #1. (→ §3)
- **Output**: `.grovespec/review/<id>.verify.yaml` (node) or `tree.verify.yaml` (decomposition); the node at `approved`, or the tree cleared for building.

### implement — build that node
- **When**: a node is `approved`.
- **What**: pre-check (risks·conventions·grep existing code) → tests first (per `tdd`) → code → **confirm the decomposition: reconcile the node's already-sketched children against the build (keep / drop / add), recorded in the Change Log** (`role` is confirmed here). `approved` → `implemented`. No review here.
- **Output**: src/, tests/, the Task at `implemented` (+ a decomposition if it's a skeleton).

### review — run the tests, cold-review the diff
- **When**: a node is `implemented` (and re-run after each `fix`).
- **What**: run the tests + analyse them against the AC (the deterministic spine), then a cold code review of **this node's diff only** with *code* roles — bounded so cost never scales with the codebase. `implemented` → `reviewed`; on a clean terminal pass + human confirm → `done`. (→ §3)
- **Output**: `.grovespec/review/<id>.review.yaml`; the node at `reviewed` / `done`.

### fix — apply the review's issues
- **When**: review left open issues.
- **What**: apply them to *this node's* code only → `fixed` → re-run review. The `reviewed ⇄ fixed` loop until clean.

### revise — change an already-done node
- **When**: deliberately changing a `done` node later, changing tree structure, or promoting a leaf to a skeleton.
- **What**: reopen to the earliest status the change touches; **if the contract changed**, propagate to the consumer set (grep + tree + `grovespec impact`) by reopening and re-verifying·re-reviewing them. Default to *keeping the outer contract* — that's what keeps the partial tree small.

> **Where does fixing live?** For the *spec*, `verify` fixes the draft inline (a small doc — no token cost). For *code*, `fix` is a **separate, explicit** step — the expensive, risky part, kept controllable and in a fresh context.

---

## 3. The cold-review engine: three scales (tree · spec · code)

The multi-persona scrutiny runs at **three scales**, one shared engine (the installed `grovespec-review/references/reviewers.md`), differing only in lens set + read-scope:
- **tree** (verify-tree) — two questions, one target. *Decomposition* (a sketch tree, at plan #0/after a structural change — D1–D5: scope coverage · system completeness · actor closure · boundaries · depth): catches what the producing agent + a human glance miss — a missing infra feature, a flat sketch hiding a subtree, an unowned actor; affordable because sketches are one-liners. *Fidelity* (a pristine mapped brownfield tree — F1–F4, criteria = the code): is the survey an accurate photograph? — the map is an agent's claim too.
- **spec** (verify) — each node's **contract** (C1–C6), where a flaw is cheapest to fix.
- **code** (review) — each node's **diff** + tests.

The detail below is the per-node spec/code pair; the tree review uses the same shared rules with the D1–D5 lens set.

Shared rules:
- **Fresh eyes**: a reviewer doesn't see how it was built — only the target + criteria, going in with "find flaws; default to 'there's a problem'." Reviewers are **subagents with empty context**, run in parallel.
- **Different roles**: many identical reviewers see only the same weakness — mix different eyes.
- **Strength** (how far to block: Critical / +Should-Fix / +Nice-to-Have), **repeat** (minimum find waves — the recall floor), and **scale** (reviewer count·rounds by reach/risk: `skip`·`light`·`standard`·`full`) all come from `config.yaml` (`verify:` / `review:`) — *not restated here, so they can't drift*.
- **Over-strictness check** (on `full`): a separate reviewer drops nitpicks. **Stop safety**: a max round count escalates to the human.

**verify — is the *spec* good?** (cold spec lenses: consumer-impersonator · gap-finder · coherence · non-expert · breaker)
- **Consumer impersonation**: "I'm a node that will use this" — anywhere you'd have to guess is a contract hole.
- **Gap finding**: does it answer empty / not-found / fails?
- **Coherence**: does this node fill what its parent promised; and — the top-down check — if it's a skeleton, does its contract decompose cleanly into children that *cover it* (no gaps/overlaps)? You check that from the contract **while the children are still only sketches** (their contracts unwritten) — that's the top-down discipline; implement later records the confirmed map.
- **Non-expert**: fails it on any jargon/fluff a layperson can't confirm (the lever that keeps a spec human-confirmable).

**review — is the *code* good?** (run the tests first, then cold code lenses: correctness · security · the-6-month-maintainer · breaker · test-quality)
- **Tests are the spine**: every AC item should have a passing test; a failing/missing one is an issue. (A `tdd:false` node has no tests → the cold lenses are the only gate.) Running the project's *whole* suite each review doubles as the **regression net** for earlier nodes — including an edit made outside the skills (partial: only where tests cover the broken contract).
- **Diff only**: reviewers read *this node's changed files* + its AC·Contract + the test results — never the wider codebase. This is what keeps review's cost **flat** as the project grows.
- **test-quality** lens stops "tests pass" from being a rubber stamp (catches hollow/tautological tests).
- review never re-asks spec questions — verify settled those, cold, before any code.

---

## 4. Task file format (concept only)

A Task holds *concept* only — **it does not record what the code looks like** (that's read from the code). It's YAML frontmatter + fixed sections (`Overview · Requirements · Contract · AC · Subtasks · Change Log`); the exact format is fixed in `.grovespec/templates/FORMATS.md` (the parser contract), with a fill-in template at `.grovespec/templates/task.md` — not reprinted here.

- Position (who the parent is) is held by tree.md — a Task doesn't record its parent. **tree.md holds every node**, including the not-yet-detailed `sketch` nodes (greenfield, the whole tree is laid out at init).
- A skeleton's **decomposition** (its children + each child's contract clause) is sketched at init and **confirmed against the build at implement** (recorded in the Change Log).
- "Which code changed how" is held by git — **every step and decision turn ends by committing what it wrote** (`FORMATS.md` "Commits"): *implement*/*fix* in **`TASK-N:`-prefixed commits** (the mechanical diff boundary *review* reads), everything else in step-named commits (`grow TASK-3: …` · `plan #N: …` · `init: …` · `approve TASK-3: …`) that stay outside that anchor; "why it changed" by the Change Log.
- Headers and field names are English; the *content* is written in `config.language`.

---

## 5. Sessions and tokens

- **verify** and **review** spawn their cold reviewers as **subagents** (empty context = independence). They run from the main session; **never run a grovespec skill *as* a subagent** (then it can't spawn reviewers, and silently degrades to a non-cold self-check). The host must expose at least the configured reviewer count as concurrent child slots; a smaller cap stops the wave instead of changing its shape.
- Everything else runs **thin** — reading only what's needed at the time from disk, not piling up a long working context.
- **Cost stays flat as the project grows** because the expensive scrutiny is *bounded*: verify reads one small draft; review reads one node's diff (not the codebase). That bound — not "fewer reviewers" — is what fixes the token blow-up. Splitting each step into its own skill keeps any single session from carrying the whole build.
- **One step, one session (recommended).** When a step finishes, start the next in a **fresh session** — each skill recommends this on completion. Two reasons: it keeps each session *bounded* (the cost-flatness above — a session that carried init + grow + verify + implement grows heavy and slow), and it gives the next step **clean context** — an agent that just *wrote* a draft is not the one that should orchestrate its cold *review* (the subagent reviewers stay cold either way, but a fresh orchestrator won't bias the aggregation/triage toward what it built). The user may continue in-session for a quick step; the *default* is fresh.

---

## 6. How the skills are divided

1. **One skill per step of a node's life** (grow·verify·implement·review·fix) — each invocation is *one bounded action*, so no single session balloons with the whole build.
2. **Spawn cold subagents where independence is needed** (verify, review). Never nest a grovespec skill inside a subagent.
3. **Keep the skill body thin**, with the shared review mechanics in `reviewers.md`, loaded only when a round runs.

4. **A driver may pick the step; a gate it takes must say so.** `grovespec-next` (over the eight, adding no rules of its own) runs the one step `grovespec next` reports due and stops — the repetition belongs to its caller, so each step still gets a fresh session. By default the human's gates are skipped, never performed. Its **auto mode** may take a gate that came out *clean and sealed* — the runtime re-verifies the seal (digest · commit · bound tests) against the current bytes before flipping anything — and then the record says `approved_by: machine` and every later `status`/`validate` names it until a human ratifies. An escalation, an open issue or a binding mismatch is never approved past, and the tree gate stays the human's in both modes. What auto mode trades away is stated plainly: the cold review still runs; the intent check doesn't.

> The split is by *step*, not by role. Each step ends and hands to the next explicitly.

---

## 7. Not yet settled

Settled: contract verification (§3) · structure change (§2 revise) · **brownfield code→tree** (init `code-to-tree`, sample-validated) · **cost = bounded scrutiny** (verify reads the draft, review reads the diff — §3·§5) · **the verify/review split** (spec cold personas + tests/diff code review) · **out-of-band edits** (`fresh` reports src/tests changes that skipped the skills; `validate` requires each advanced status to show its passed gate records and flags a pinned spec that changed after its gate; `revise` is the reconcile path) · **gate binding** (a pass is sealed to its bytes/commit/tests at the moment it passes; `approve` verifies the seal and records who decided — `pending`/`human`/`machine`; `reopen` starts a fresh cycle so a past pass never doubles as new evidence). Remaining:

- **Terminal-convergence demo** — a full node through to a closed cycle (ledger exhausted · issue list emptied · confirmation clean).
- The **full cycle** grow→verify→implement→review→fix end-to-end, and init on a large codebase.
- When two far-apart nodes share a contract — their common parent is the top, so the partial tree grows large.
- When several agents work *different branches at the same time* (spec conflicts — the failure other spec tools hit when parallel changes touch the same requirement).
