# GroveSpec workflow and skills

> This document defines how GroveSpec actually runs — which steps, in what order, what comes out, and how the skills are divided.
> The *why* lives in [METHODOLOGY.md](METHODOLOGY.md).

---

## 1. The big picture

GroveSpec's goal is to **minimize the drift between spec and code**. To do that, whatever you change, you keep the changed area to a **partial tree**: the node you change plus the few nodes its contract touches (its children and its consumers), never the whole tree.

```
init (once)
  → per node:  grow → verify → implement → review ⇄ fix → done   (then grow its children)
  → revise (when changing an already-done node later)
```

- The spec stays **one node ahead** of the code. Top-down, **one node at a time**.
- Each node is a draft (`grow`) that's cold-**verified** into `approved`, then **implemented**, then **reviewed** (its tests + a cold code review of its *diff*) with a **fix** loop — ending `done`. **Only a `done` node's children get grown.**
- The human confirms at a glance twice: **approve the spec** (after verify) and **confirm the result** (after review).
- **No id bookkeeping**: run any step skill *without a target* and it picks the node `grovespec check` reports ready for that step (status → next: `draft`→verify · `approved`→implement · `implemented`→review · `reviewed`→fix · done skeleton→grow). You advance by "do the next thing" — the two human gates still pause you.

---

## 2. The seven skills

Seven units, one per step of a node's life.

### init — set up the project (and reconfigure)
- **When**: at the start; **re-invoke anytime to *reconfigure*** (re-asks the setup interview, updates config, doesn't recreate the project).
- **What**: first a **fixed setup interview** (`references/setup.md`: language · review strength · reviewer models · test command → config). Then figure out what you have (idea / rough spec / detailed spec / code / code+docs); for a bare idea, explore it into a lean brief (`references/explore.md`); if there's code, read it to extract the existing tree. Create brief·config, and the tasks: **greenfield → just the root Task (`draft`)**; **brownfield → the whole existing tree (all `done`)**.
- **Output**: brief.md, tree.md, tasks/ (greenfield: root only · brownfield: every node), conventions.md, `.grovespec/config.yaml`, ref/ (if present).

### grow — write the next node's draft
- **When**: a parent is `done` and still has ungrown children (`grovespec check` flags them).
- **What**: write ONE child *as concept only* (→ §4), `status: draft`, and add its id to tree.md. It does **not** define its own children (that happens at *its* implement) and does **not** review (verify does).
- **Output**: tasks/TASK-N.md (`draft`), updated tree.md.

### verify — cold-check the draft, approve it
- **When**: a node is `draft`.
- **What**: several *cold* fresh-eyes reviewers inspect the draft spec with different *spec* roles; issues are fixed; repeat until clean; then the human approves. `draft` → `approved`. (→ §3)
- **Output**: the node at `approved`; `.grovespec/review/<id>.verify.yaml`.

### implement — build that node
- **When**: a node is `approved`.
- **What**: pre-check (risks·conventions·grep existing code) → tests first (per `tdd`) → code → **confirm whether the node needs children, recording its decomposition in the Change Log** (`role` is confirmed here). `approved` → `implemented`. No review here.
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

## 3. Two cold-review steps: verify (spec) and review (code)

The multi-persona scrutiny is spent on the **spec** (verify), where a flaw is cheapest to fix. The **code** is gated by **tests** plus a cold review of just its **diff**. Both share one cold engine (`.claude/skills/grovespec-review/references/reviewers.md`); they differ only in lens set and read-scope.

Shared rules:
- **Fresh eyes**: a reviewer doesn't see how it was built — only the target + criteria, going in with "find flaws; default to 'there's a problem'." Reviewers are **subagents with empty context**, run in parallel.
- **Different roles**: many identical reviewers see only the same weakness — mix different eyes.
- **Strength** (how far to block: Critical / +Should-Fix / +Nice-to-Have), **repeat** (consecutive clean rounds before stopping), and **scale** (reviewer count·rounds by reach/risk: `skip`·`light`·`standard`·`full`) all come from `config.yaml` (`verify:` / `review:`) — *not restated here, so they can't drift*.
- **Over-strictness check** (on `full`): a separate reviewer drops nitpicks. **Stop safety**: a max round count escalates to the human.

**verify — is the *spec* good?** (cold spec lenses: consumer-impersonator · gap-finder · coherence · non-expert · breaker)
- **Consumer impersonation**: "I'm a node that will use this" — anywhere you'd have to guess is a contract hole.
- **Gap finding**: does it answer empty / not-found / fails?
- **Coherence**: does this node fill what its parent promised; and — the top-down check — if it's a skeleton, does its contract decompose cleanly into children that *cover it* (no gaps/overlaps)? You check that from the spec **even though the children don't exist yet** — that's the top-down discipline; implement later records the confirmed map.
- **Non-expert**: fails it on any jargon/fluff a layperson can't confirm (the lever that keeps a spec human-confirmable).

**review — is the *code* good?** (run the tests first, then cold code lenses: correctness · security · the-6-month-maintainer · breaker · test-quality)
- **Tests are the spine**: every AC item should have a passing test; a failing/missing one is an issue. (A `tdd:false` node has no tests → the cold lenses are the only gate.)
- **Diff only**: reviewers read *this node's changed files* + its AC·Contract + the test results — never the wider codebase. This is what keeps review's cost **flat** as the project grows.
- **test-quality** lens stops "tests pass" from being a rubber stamp (catches hollow/tautological tests).
- review never re-asks spec questions — verify settled those, cold, before any code.

---

## 4. Task file format (concept only)

A Task holds *concept* only — **it does not record what the code looks like** (that's read from the code). It's YAML frontmatter + fixed sections (`Overview · Requirements · Contract · AC · Subtasks · Change Log`); the exact format is fixed in `.grovespec/templates/FORMATS.md` (the parser contract), with a fill-in template at `.grovespec/templates/task.md` — not reprinted here.

- Position (who the parent is) is held by tree.md — a Task doesn't record its parent. **tree.md holds only nodes that currently exist** (have a Task); an ungrown child is not in it yet.
- A skeleton's **decomposition** (which children it needs + each child's contract clause) is recorded in its **Change Log** at implement — that's what a later `grow` reads to create each child.
- "Which code changed how" is held by git; "why it changed" by the Change Log.
- Headers and field names are English; the *content* is written in `config.language`.

---

## 5. Sessions and tokens

- **verify** and **review** spawn their cold reviewers as **subagents** (empty context = independence). They run from the main session; **never run a grovespec skill *as* a subagent** (then it can't spawn reviewers, and silently degrades to a non-cold self-check).
- Everything else runs **thin** — reading only what's needed at the time from disk, not piling up a long working context.
- **Cost stays flat as the project grows** because the expensive scrutiny is *bounded*: verify reads one small draft; review reads one node's diff (not the codebase). That bound — not "fewer reviewers" — is what fixes the token blow-up. Splitting each step into its own skill keeps any single session from carrying the whole build.

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
- When several agents work *different branches at the same time* (spec conflicts).
