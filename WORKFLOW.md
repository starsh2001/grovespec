# GroveSpec workflow and skills

> This document defines how GroveSpec actually runs — which steps, in what order, what comes out, and how the skills are divided.
> The *why* lives in [METHODOLOGY.md](METHODOLOGY.md).

---

## 1. The big picture

GroveSpec's goal is to **minimize the drift between spec and code**. To do that, whatever you change, you keep the changed area to a **partial tree**: the node you change plus the few nodes its contract touches (its children and its consumers), never the whole tree.

```
init (once)
  → [ grow → implement → done ] repeat     (grow the tree one node at a time)
  → revise (when changing an already-done node later)
```

- The spec stays **one node ahead** of the code. Top-down, one layer at a time.
- grow and implement each contain a **review loop** (review → fix → review again).
- The human looks and confirms at a glance, *before building (the spec)* and *after building (the result)*.

---

## 2. The five skills

There are five units you invoke.

### init — set up the project once
- **When**: once, at the start.
- **What it does**: figures out what you have (just an idea / rough spec / detailed spec / code / code+docs) → for a bare idea/rough spec, **explores it into a lean brief** (a thinking-partner stance, no code — `references/explore.md`); keeps reference docs as originals + a location map; if there's code, reads it to extract the tree → creates the brief·config·tree.md·root+first-level tasks.
- **Output**: brief.md, tree.md (rough whole, ids only), tasks/ (root+first level), conventions.md (empty for greenfield; filled for brownfield), `.grovespec/config.yaml`, ref/ (if present).
- **Session**: once, thin.

### grow — write the next node's spec
- **When**: unfolding the tree by one node. Start from an unblocked node (its parent is done).
- **What it does**: writes that node *as concept only* (→ §4). If it's a skeleton, also fixes the roles and contracts of its direct children and adds their ids to tree.md. → review (the spec) → fix → human check.
- **Output**: tasks/TASK-N.md, (if a skeleton) an updated tree.md.
- **Session**: thin (reads only the parent's contract).

### implement — build that node
- **When**: implementing a node whose spec is confirmed.
- **What it does**: pre-check (risks·conventions·grep existing code) → tests first (skip for nodes hard to test up front, with the reason recorded) → code → review (the result) → fix → human check → done.
- **Output**: src/, tests/, an updated Task (status done, Change Log).
- **Session**: thin (the node's spec + relevant code only).

### review — review
- **When**: called internally by grow·implement·revise. Can also be called on its own.
- **What it does**: takes the result (spec or code) + the criteria, has several *fresh-eyes* reviewers find flaws, triages, and returns a **confirmed issue list**.
- **Session**: **this is the only one that splits off.** It spawns several reviewers that start from an empty context in new sessions and runs them in parallel (with different roles), aggregates → over-strictness check → runs as many rounds as strength·repeat call for. Each round is a new session, and state is handed over via a file on disk. (→ §3)

### revise — change an already-done node
- **When**: deliberately changing a done node later, or changing the tree structure.
- **What it does**:
  - *Behavior change*: reopen the node (done→in-progress) and change it → **if the contract changed**, find the nodes that use that contract (grep+tree) and re-review them (propagation) → fix → record why it changed.
  - *Structure change (split·merge·move)*: change **tree.md only** — the sole source of parent-child structure (a Task records no parent or children). Here too, **if the contract changes**, re-review the nodes that use it (propagation). Default to *keeping the outer contract* — that's what keeps the partial tree small.
- **Session**: thin.

> **Fixing (apply) is not a separate skill.** When review returns the confirmed issue list, the *caller* fixes it right there. The caller already has the working context, and fixing needs no independence (review already guaranteed that, cold).

---

## 3. Review rules

- **Fresh eyes**: a reviewer *doesn't see how it was built.* They look only at the result + the criteria, and go in with "my job is to find flaws; the default is 'there's a problem'."
- **Different roles**: many identical reviewers see only the same weakness. Mix *different* eyes — like security / the future maintainer / a non-expert / a breaker.
- **Non-expert reviewer**: one of them becomes "a non-expert" and fails it on any jargon or fluff they can't follow. (The lever that forces a spec to be *confirmable by a human at a glance*.)
- **Strength (how far to block)**: Critical / Should Fix / Nice to Have — how severe a finding must be to block a pass. **Repeat**: how many consecutive clean passes before stopping (stops "passed once, then found more on a re-read"). **Scale**: reviewer count·rounds scale to how far the change reaches — `skip` (unchanged contract, trivial) · `light` · `standard` · `full` (contract changed / 3+ consumers / a skeleton). *The exact pass-conditions and counts live in the `grovespec-review` skill + `config.yaml` — not restated here, so they can't drift.*
- **Over-strictness check** (on `full`; optional on `standard`): at the end, a separate look at whether the raised issues are *real blockers or nitpicks*. Nitpicks are dropped. (Stops it looping forever.)
- **Stop safety**: a max round count; if it can't finish within that, the remaining issues go to the human.

**When reviewing a spec (= is the contract good?):**
- **Consumer impersonation**: one reviewer pretends *"I'm a node that will use this"* and tries to build theirs from the contract alone. Wherever they have to *guess* is a hole in the contract. (This impersonation also sets the precision — only as much as a consumer needs.)
- **Gap finding**: does the contract answer "when empty / when not found / when it fails"?
- **Coherence**: does a child's contract fill *what the parent promised on its behalf*? For a skeleton, *do the children's contracts sum to the parent's* (nothing missing, nothing overlapping)?

---

## 4. Task file format (concept only)

A Task holds *concept* only — **it does not record what the code looks like** (that's read from the code). It's YAML frontmatter + fixed sections (`Overview · Requirements · Contract · AC · Subtasks · Change Log`); the exact format is fixed in `.grovespec/templates/FORMATS.md` (the parser contract), with a fill-in template at `.grovespec/templates/task.md` — not reprinted here.

- Position (who the parent is) is held by tree.md — a Task doesn't record its parent.
- "Which code changed how" is held by git; "why it changed" by the Change Log.
- Headers and field names are English; the *content* is written in `config.language`.

---

## 5. Sessions and tokens

- The *only* one that must split off into a new session is **review** (it needs independence).
- Everything else runs **thin** — reading only what's needed at the time from disk, not piling up a long working context. The truth is on disk, so it's safe to stop, and not dragging dead context saves tokens too.

---

## 6. How the skills are divided

1. **Group by the same kind of step** — so a user immediately knows "this kind of thing goes here."
2. **Split the session when independence is needed** (review). Otherwise you may continue, or cut thin for tokens.
3. **Keep the skill body thin**, with per-case notes in separate files loaded *only when needed*.

> Reducing the number of skills isn't the goal. The split is by *core vs. fluff*.

---

## 7. Not yet settled

Settled: contract verification (§3) · structure change (§2 revise) · brownfield code→tree (init `code-to-tree`) · review cost = change-size scaling (§3) · the real cold-spawn of a full-level review (validated in a main session; the 5th `spec` role added). Remaining:

- **Terminal-convergence demo** — through to a clean pass + repeat=2 consecutive passes.
- grow·implement **full cycle**, init on a large codebase.
- When two far-apart nodes share a contract — their common parent is the top, so the partial tree grows large.
- When several agents work *different branches at the same time* (spec conflicts).