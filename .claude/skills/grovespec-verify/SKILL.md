---
name: grovespec-verify
description: GroveSpec spec verification — a cold multi-persona check, before any code. Two scales, same engine: a node's *draft spec* (contract·decomposition → draft becomes approved), and — once at init — the *whole sketch tree* (the decomposition gate: is anything missing, mis-bounded, or hiding a subtree, before the per-node build). Fresh-eyes reviewers inspect in parallel with different roles; issues are fixed; a clean pass + human approval clears it. Use when the user wants to "verify this spec / check the draft / verify the tree / check the decomposition / approve this node / grovespec verify", or right after grow detailed a sketch, or right after init laid out the tree. For reviewing *code* use grovespec-review.
---

# grovespec-verify

Cold verification of a node's **draft spec** — the step that turns `draft` → `approved`. (Reviewing *code* is `grovespec-review`.)

The leverage: spend the multi-persona scrutiny *here*, on the spec, before any code exists. A contract or decomposition error caught now costs nothing; caught after building, it costs the build. **This is the one place the cold persona review lives for a spec** — code review (`grovespec-review`) does *not* re-ask spec questions.

## Two scales: the node, and the whole tree
verify is the cold gate at **two scales**, same engine (`reviewers.md`), different target:
- **`spec` — one node's draft** (the common case): `grow` detailed a sketch into a draft contract; verify cold-checks it (**C1–C6**) → `draft` → `approved`. Everything below is written for this.
- **`tree` — the whole decomposition** (once at init, and after a structural `revise`): right after `init`/`spec-to-tree` lays out the **sketch tree**, verify cold-checks the *decomposition itself* (**D1–D5**) before any node is built — *is anything missing · mis-bounded · hiding a subtree?* This is the gate that catches what the producing agent and a human glance miss: system scaffolding the domain doc never mentions (settings·admin·audit·org-mgmt), a naively-flat feature, an actor nobody owns. It's affordable **because sketches are one-liners** — the reviewer holds the whole tree in one context. Clean pass + human approval → the tree is cleared and the per-node build begins. (It is the tree's `verify`, exactly as node-`verify` is a node's: produce → cold-verify → approved, one scale up.)

The mechanics below (cold subagents, THE BAR, fix loop, triage, strength) are **identical** for both scales; only the **lens set + checklist** differ (spec → C1–C6 spec lenses; tree → D1–D5 decomposition lenses), both in `reviewers.md`.

> **THE BAR — *sufficient*, not exhaustive** (modeled on BMAD's PO *validate-story*). Verify for a **competent implementer/child** who researches, decides, follows conventions, and asks only when *truly* stuck. A flaw is real only if such a node would be **blocked or build the wrong thing** — *name who, and on what decision* — not merely that an edge is unspecified. A skeleton states its children's *roles · boundaries · invariants* and **defers** mechanism (atomicity, schemas, concurrency, API shapes…) and child-owned edges to children; **demanding that detail is over-reach.** This bar is what stops verify from churning for rounds — its absence is why a real run took 14. **But it cuts both ways:** a check PASSes only when a reviewer *shows* it holds (pastes the decomposition map, sketches the consumer build) — "found nothing" is **not** a pass. *Lenient on imagined edges; strict on shown sufficiency* — so it can't tip into rubber-stamping an under-specified spec.

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `bash .grovespec/bin/grovespec lang`) and write **every** reply in that language (the cold reviewers' findings too). These files are English; your output is not.

## Why cold · several · different
An open-ended "just review it" gets rubber-stamped, and exhaustive flaw-hunting never converges. So we stack: ① cold reviewers (didn't see how it was written), ② *different* roles, ③ *several* in parallel, ④ each **filling a bounded checklist at THE BAR** (not open hunting), ⑤ a triage that drops over-reach, ⑥ repeat until a clean round — then a human approves.

## What it takes in — auto-routing
When invoked *without an explicit target*, **decide tree-vs-spec automatically**:
1. Check: do **`sketch` nodes exist**, AND is there **no passed `tree.verify.yaml`** (the file doesn't exist, or its `status` ≠ `passed`)? → **`tree` mode** (the decomposition hasn't been cold-vetted yet; do it before any node).
2. Otherwise → **`spec` mode**: run `grovespec check` and take an unblocked `draft` node (lowest id if several).
3. An explicit target overrides: `verify TASK-N` → spec; `verify tree` → tree.

- **`spec` — the node** (`target_type: spec`). Criteria: the parent's **Contract** + the decomposition clause this node must fill + `conventions.md`.
- **`tree` — the whole sketch tree** (`target_type: tree`). Criteria: the **brief** + the **ref detailed spec** (the scope·intent the tree must cover).
- `strength`·`max_rounds`·`scale` from `.grovespec/config.yaml` `verify:` (the tree review reuses these — for a big tree, round the level **up**).

> **Where it runs (the invocation contract).** Run grovespec-verify in your **main Claude Code session** — it spawns the cold reviewers as **subagents**. **Never run a grovespec skill *as* a subagent** — then it can't spawn reviewers and silently degrades to a non-cold self-check, defeating the point.

## State
`.grovespec/review/<id>.verify.yaml` for a node (`target_type: spec`), or `.grovespec/review/tree.verify.yaml` for the decomposition (`target_type: tree`). Template `review-state.yaml`. Round 1 creates it; later rounds update it in place; re-running reuses it so rounds accumulate. (Code review keeps a **separate** `<id>.review.yaml`; they never collide.)

## Depth scales with reach
verify picks the level from checkable inputs — ① did the contract change ② consumer count ③ is it a skeleton. The reviewer **counts·repeat** live in `config.yaml` `verify.scale` (the SSoT — never restate a number here). When ambiguous, round **up** (a too-light verify lets drift through; a too-heavy one costs a little).

| level | when | review |
|---|---|---|
| `skip` | trivial spec edit (format·comment) | self-check only, no reviewers |
| `light` | small, contract unchanged | cold reviewers (count from `verify.scale`), repeat 1 |
| `standard` | a normal new node | cold reviewers, repeat 1 |
| `full` | contract changed / 3+ consumers / a skeleton | cold reviewers, repeat 2, + over-strictness check |

## One round
> Spawn mechanics, the reviewer prompts, **THE BAR + the SCOPE rule**, the findings format, the **checklist (C1–C6 for a node · D1–D5 for the tree)**, and the triage all live in `.claude/skills/grovespec-review/references/reviewers.md` — load it and use the **spec lens set** (`spec`) or the **decomposition lens set** (`tree`).

1. **Spawn cold reviewers in parallel** (subagents, empty context), as many as the level sets — for `spec`, the spec lenses; **for `tree`, the decomposition lenses** filling **D1–D5** (each tree reviewer reading the whole sketch tree + brief + ref spec). **Which lenses spawn at this level — and which checks each carries — comes from `reviewers.md`'s check-assignment table**: every check (C1–C6 / D1–D5) has a cold owner at *every* level; fewer reviewers just means each carries more checks. Give each: the target + criteria, **THE BAR**, the **checklist to fill**, and the **do-not-raise list** (settled categories from `adjudications`). Not how it was built, not a prior round's discussion.
2. **Aggregate** into the C#/D# verdict table. **A check is PASS only if a reviewer *showed* it** (C1's scope→child map pasted, C2's consumer built, C5's measurable AC pointed at) — "found nothing" is **not** PASS; an *unshown* check is PARTIAL. On a severity clash take the higher.
3. **Over-strictness triage** (`full`; optional `standard`) — drop anything that's mechanism/child-detail (out of scope), fails the *name-the-victim* test, a competent implementer would decide, or is in the do-not-raise categories.
4. **Resolve — prefer DEFER/CUT over ADD.** For an unspecified detail, add a **deferral marker `[→ child/deferred: …]` or cut** — not a new clause. Add a clause *only* for a genuine in-scope structural gap (C1–C3). **A skeleton Contract that grew this round is a smell**: the root should get *leaner*, not more detailed (over-specification is itself a C4/C6 FAIL). **`(gap)` AC items** (spec-silent spots grow marked — `FORMATS.md`): an in-scope gap on a leaf is a real finding — resolve it with the user into behavior, or the triage rules it `accepted-gap`: the item then *stays* `(gap)` (consumers should see what's undefined), the adjudication reaches the Change Log at approve, and later rounds don't re-raise it. Fixing in this main session is fine — next round re-spawns fresh cold reviewers.
5. **Pass judgment** by `strength` (1: no `critical` · 2: +`should-fix` · 3: +`nice-to-have`; default 2 — should-fix *does* block, keep it). **Non-blocking floor:** a round whose only surviving findings are deferred / out-of-scope / nice is a **PASS** — *but only if the C-table is affirmatively all-PASS* (every check **shown**, none left PARTIAL/FAIL). An unshown/PARTIAL check blocks like a should-fix (so you can't pass by *not looking*). Pass → `consecutive_passes`+1; fail → 0. Re-spawn a fresh cold round until it passes `repeat` times running.
6. **Stop safety**: if `round` exceeds `max_rounds`, set `status: escalated`, take the open issues to the human, do **not** approve.
7. Append the triage's drops to `adjudications`, and **condense them into the do-not-raise categories** handed to the next round (so fresh reviewers don't re-find them).

## Human approval
On a clean terminal pass, show the human the result and get confirmation.
- **`spec`** → show the draft, **"is this what you want?"** → Yes: set the Task `status: approved`, copy surviving `adjudications` into the node's **Change Log**.
- **`tree`** → show the **whole decomposition** (the tree + the D-table of what the cold gate checked/fixed), **"is this the right decomposition?"** → Yes: the tree is cleared for building. Surviving `adjudications` stay in `tree.verify.yaml` (a later structural re-verify reads them from there — no need to copy elsewhere; brief.md has no Change Log section). The human is now confirming an *already cold-vetted* tree — not doing the vetting themselves (the failure this gate fixes).
- **Escalated, or human rejects** → fix the draft / the sketch tree and loop back; nothing advances.

## When it's done
- **`spec`**: the node is `approved` → **next: `grovespec-implement`**.
- **`tree`**: the decomposition is cold-verified + human-approved → **the per-node build begins**: `grovespec-grow` the root (detail its sketch → draft), then `verify` (spec) → `implement` → `review`, top-down.

> **Recommend a new session for the next step** (implement, or the first `grow`). Clean, bounded context per step keeps GroveSpec's cost flat and its next reviewers cold (WORKFLOW §5).
