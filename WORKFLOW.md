# GroveSpec workflow and skills

> This document defines how GroveSpec actually runs — which steps, in what order, what comes out, and how the skills are divided.
> The *why* lives in [METHODOLOGY.md](METHODOLOGY.md).

---

## 1. The big picture

GroveSpec's goal is to **minimize the drift between spec and code**. To do that, whatever you change, you keep the changed area to a **partial tree**: the node you change plus the few nodes its contract touches (its children and its consumers), never the whole tree.

```
init (once: detailed spec → whole tree as sketches)
  → verify (tree):  cold review the whole decomposition (D1–D5) → fix → human approve
  → per node:  grow (detail sketch → draft) → verify → implement → review ⇄ fix → done
  → revise (when changing an already-done node later)
```

- The whole tree is **sketched at init**; each node is then *detailed* and gated top-down, **one node at a time**.
- Each node is detailed by `grow` (sketch → `draft`), cold-**verified** into `approved`, then **implemented**, then **reviewed** (its tests + a cold code review of its *diff*) with a **fix** loop — ending `done`. A `done` node's already-sketched children are then detailed.
- The human confirms at a glance: the **sketch tree** (after init), the **spec** (after verify), and the **result** (after review).
- **No id bookkeeping**: run any step skill *without a target* and it picks the node `grovespec check` reports ready for that step (status → next: `sketch`→grow · `draft`→verify · `approved`→implement · `implemented`→review · `reviewed`→fix). You advance by "do the next thing" — the human gates still pause you.

---

## 2. The seven skills

Seven units, one per step of a node's life.

### init — set up the project (and reconfigure)
- **When**: at the start; **re-invoke anytime to *reconfigure*** (re-asks the setup interview, updates config, doesn't recreate the project).
- **What**: first a **fixed setup interview** (`references/setup.md`: language · review strength · reviewer models · test command → config). Then figure out what you have (idea / rough spec / detailed spec / code / code+docs); for an idea or rough spec, explore it into a **detailed spec + brief** (`references/explore.md`) and map it to an all-`sketch` tree (`references/spec-to-tree.md`); if there's code, extract the existing tree (all `done`). Create brief·config·tree: **greenfield → the whole tree as `sketch`**; **brownfield → the whole existing tree as `done`**.
- **Output**: brief.md, the detailed spec (ref/), tree.md, tasks/ (greenfield: every node as `sketch` · brownfield: every node `done`), conventions.md, `.grovespec/config.yaml`.

### grow — detail a sketch into a draft (or add a new node)
- **When**: the next `sketch` node whose parent is `done` (`grovespec check` lists it) — the initial-build detailing step; or a brand-new node beyond the spec (expansion).
- **What**: write the node's full Contract·AC from the reference spec (sketch → `draft`), no code (→ §4). It does **not** (re)define its children (greenfield they're already sketched) and does **not** review (verify does).
- **Output**: tasks/TASK-N.md (`draft`).

### verify — cold-check the draft (or the whole tree), approve it
- **When**: a node is `draft` (`target_type: spec`); **or** once at init on the whole sketch tree (`target_type: tree` — the decomposition gate).
- **What**: several *cold* fresh-eyes reviewers inspect in parallel; issues are fixed; repeat until clean; then the human approves. **spec** → roles check the node's contract (C1–C6) → `draft` → `approved`. **tree** → roles check the whole decomposition (D1–D5: scope coverage · system completeness · actor closure · boundaries · depth) → fix → human approves the vetted tree → the per-node build begins. (→ §3)
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

The multi-persona scrutiny runs at **three scales**, one shared engine (`.claude/skills/grovespec-review/references/reviewers.md`), differing only in lens set + read-scope:
- **tree** (verify-tree, once at init) — the whole **decomposition** (D1–D5: scope coverage · system completeness · actor closure · boundaries · depth). Catches what the producing agent + a human glance miss: a missing infra feature, a flat sketch hiding a subtree, an unowned actor. Affordable because the sketch tree is one-liners.
- **spec** (verify) — each node's **contract** (C1–C6), where a flaw is cheapest to fix.
- **code** (review) — each node's **diff** + tests.

The detail below is the per-node spec/code pair; the tree review uses the same shared rules with the D1–D5 lens set.

Shared rules:
- **Fresh eyes**: a reviewer doesn't see how it was built — only the target + criteria, going in with "find flaws; default to 'there's a problem'." Reviewers are **subagents with empty context**, run in parallel.
- **Different roles**: many identical reviewers see only the same weakness — mix different eyes.
- **Strength** (how far to block: Critical / +Should-Fix / +Nice-to-Have), **repeat** (consecutive clean rounds before stopping), and **scale** (reviewer count·rounds by reach/risk: `skip`·`light`·`standard`·`full`) all come from `config.yaml` (`verify:` / `review:`) — *not restated here, so they can't drift*.
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
- "Which code changed how" is held by git — *implement* and *fix* end in **`TASK-N:`-prefixed commits**, the mechanical diff boundary *review* reads (`FORMATS.md`); "why it changed" by the Change Log.
- Headers and field names are English; the *content* is written in `config.language`.

---

## 5. Sessions and tokens

- **verify** and **review** spawn their cold reviewers as **subagents** (empty context = independence). They run from the main session; **never run a grovespec skill *as* a subagent** (then it can't spawn reviewers, and silently degrades to a non-cold self-check).
- Everything else runs **thin** — reading only what's needed at the time from disk, not piling up a long working context.
- **Cost stays flat as the project grows** because the expensive scrutiny is *bounded*: verify reads one small draft; review reads one node's diff (not the codebase). That bound — not "fewer reviewers" — is what fixes the token blow-up. Splitting each step into its own skill keeps any single session from carrying the whole build.
- **One step, one session (recommended).** When a step finishes, start the next in a **fresh session** — each skill recommends this on completion. Two reasons: it keeps each session *bounded* (the cost-flatness above — a session that carried init + grow + verify + implement grows heavy and slow), and it gives the next step **clean context** — an agent that just *wrote* a draft is not the one that should orchestrate its cold *review* (the subagent reviewers stay cold either way, but a fresh orchestrator won't bias the aggregation/triage toward what it built). The user may continue in-session for a quick step; the *default* is fresh.

---

## 6. How the skills are divided

1. **One skill per step of a node's life** (grow·verify·implement·review·fix) — each invocation is *one bounded action*, so no single session balloons with the whole build.
2. **Spawn cold subagents where independence is needed** (verify, review). Never nest a grovespec skill inside a subagent.
3. **Keep the skill body thin**, with the shared review mechanics in `reviewers.md`, loaded only when a round runs.

> The split is by *step*, not by role. Each step ends and hands to the next explicitly.

---

## 7. Not yet settled

Settled: contract verification (§3) · structure change (§2 revise) · **brownfield code→tree** (init `code-to-tree`, sample-validated) · **cost = bounded scrutiny** (verify reads the draft, review reads the diff — §3·§5) · **the verify/review split** (spec cold personas + tests/diff code review). Remaining:

- **Terminal-convergence demo** — a full node through to a clean pass + repeat consecutive passes.
- The **full cycle** grow→verify→implement→review→fix end-to-end, and init on a large codebase.
- When two far-apart nodes share a contract — their common parent is the top, so the partial tree grows large.
- When several agents work *different branches at the same time* (spec conflicts — the failure other spec tools hit when parallel changes touch the same requirement).
- **Out-of-band edits** — a human hot-fixing a `done` node's code outside the skills. Nothing detects it today; the whole-suite test run at each later review is a partial net (only where tests cover the broken contract). Candidates: a freshness check in `validate`, or an explicit "all changes go through revise" CI contract.
