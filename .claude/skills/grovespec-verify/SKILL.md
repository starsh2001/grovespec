---
name: grovespec-verify
description: GroveSpec spec verification — a cold multi-persona check of a node's *draft spec* (its contract·decomposition), before any code. Several fresh-eyes reviewers who never saw how it was written inspect the draft in parallel with different roles, the issues are fixed, and on a clean pass + human approval the node goes draft → approved. Use when the user wants to "verify this spec / check the draft / review the spec / approve this node / grovespec verify", or right after grow·init produced a draft. For reviewing *code* use grovespec-review.
---

# grovespec-verify

Cold verification of a node's **draft spec** — the step that turns `draft` → `approved`. (Reviewing *code* is `grovespec-review`.)

The leverage: spend the multi-persona scrutiny *here*, on the spec, before any code exists. A contract or decomposition error caught now costs nothing; caught after building, it costs the build. **This is the one place the cold persona review lives for a spec** — code review (`grovespec-review`) does *not* re-ask spec questions.

> **THE BAR — *sufficient*, not exhaustive** (modeled on BMAD's PO *validate-story*). Verify for a **competent implementer/child** who researches, decides, follows conventions, and asks only when *truly* stuck. A flaw is real only if such a node would be **blocked or build the wrong thing** — *name who, and on what decision* — not merely that an edge is unspecified. A skeleton states its children's *roles · boundaries · invariants* and **defers** mechanism (atomicity, schemas, concurrency, API shapes…) and child-owned edges to children; **demanding that detail is over-reach.** This bar is what stops verify from churning for rounds — its absence is why a real run took 14. **But it cuts both ways:** a check PASSes only when a reviewer *shows* it holds (pastes the decomposition map, sketches the consumer build) — "found nothing" is **not** a pass. *Lenient on imagined edges; strict on shown sufficiency* — so it can't tip into rubber-stamping an under-specified spec.

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `bash .grovespec/bin/grovespec lang`) and write **every** reply in that language (the cold reviewers' findings too). These files are English; your output is not.

## Why cold · several · different
An open-ended "just review it" gets rubber-stamped, and exhaustive flaw-hunting never converges. So we stack: ① cold reviewers (didn't see how it was written), ② *different* roles, ③ *several* in parallel, ④ each **filling a bounded checklist at THE BAR** (not open hunting), ⑤ a triage that drops over-reach, ⑥ repeat until a clean round — then a human approves.

## What it takes in
- **the node** — its draft Task (`target_type: spec`). *If none is named*, run `grovespec check` and take an unblocked `draft` node (its next step is verify); if several are ready, ask which (or take the lowest id).
- criteria: the parent's **Contract** + the decomposition clause this node must fill + `conventions.md`.
- `strength`·`max_rounds`·`scale` from `.grovespec/config.yaml` `verify:` (overridable per node).

> **Where it runs (the invocation contract).** Run grovespec-verify in your **main Claude Code session** — it spawns the cold reviewers as **subagents**. **Never run a grovespec skill *as* a subagent** — then it can't spawn reviewers and silently degrades to a non-cold self-check, defeating the point.

## State
`.grovespec/review/<id>.verify.yaml` (template `review-state.yaml`, `target_type: spec`). Round 1 creates it; later rounds update it in place; re-running verify on the same node reuses it so rounds accumulate. (Code review keeps a **separate** `<id>.review.yaml` — they never collide.)

## Depth scales with reach
verify picks the level from checkable inputs — ① did the contract change ② consumer count ③ is it a skeleton. The reviewer **counts·repeat** live in `config.yaml` `verify.scale` (the SSoT — never restate a number here). When ambiguous, round **up** (a too-light verify lets drift through; a too-heavy one costs a little).

| level | when | review |
|---|---|---|
| `skip` | trivial spec edit (format·comment) | self-check only, no reviewers |
| `light` | small, contract unchanged | cold reviewers (count from `verify.scale`), repeat 1 |
| `standard` | a normal new node | cold reviewers, repeat 1 |
| `full` | contract changed / 3+ consumers / a skeleton | cold reviewers, repeat 2, + over-strictness check |

## One round
> Spawn mechanics, the reviewer prompts, **THE BAR + the SCOPE rule**, the findings format, the **verify checklist (C1–C6)**, and the triage all live in `.claude/skills/grovespec-review/references/reviewers.md` — load it and use the **spec lens set**.

1. **Spawn cold reviewers in parallel** (subagents, empty context), as many as the level sets — spec lenses in fixed order (consumer-impersonator · gap-finder · coherence · non-expert · breaker, first *N*). Give each: the draft + criteria, **THE BAR** (sufficient for a competent implementer; name who's blocked + the decision; deferred/child/mechanism detail is *not* a flaw), the **checklist to fill (C1–C6)**, and the **do-not-raise list** (settled categories condensed from this node's `adjudications`). Not how it was built, not a prior round's discussion.
2. **Aggregate** into the C# verdict table. **A check is PASS only if a reviewer *showed* it** (C1's scope→child map pasted, C2's consumer built, C5's measurable AC pointed at) — "found nothing" is **not** PASS; an *unshown* check is PARTIAL. On a severity clash take the higher.
3. **Over-strictness triage** (`full`; optional `standard`) — drop anything that's mechanism/child-detail (out of scope), fails the *name-the-victim* test, a competent implementer would decide, or is in the do-not-raise categories.
4. **Resolve — prefer DEFER/CUT over ADD.** For an unspecified detail, add a **deferral marker `[→ child/deferred: …]` or cut** — not a new clause. Add a clause *only* for a genuine in-scope structural gap (C1–C3). **A skeleton Contract that grew this round is a smell**: the root should get *leaner*, not more detailed (over-specification is itself a C4/C6 FAIL). Fixing in this main session is fine — next round re-spawns fresh cold reviewers.
5. **Pass judgment** by `strength` (1: no `critical` · 2: +`should-fix` · 3: +`nice-to-have`; default 2 — should-fix *does* block, keep it). **Non-blocking floor:** a round whose only surviving findings are deferred / out-of-scope / nice is a **PASS** — *but only if the C-table is affirmatively all-PASS* (every check **shown**, none left PARTIAL/FAIL). An unshown/PARTIAL check blocks like a should-fix (so you can't pass by *not looking*). Pass → `consecutive_passes`+1; fail → 0. Re-spawn a fresh cold round until it passes `repeat` times running.
6. **Stop safety**: if `round` exceeds `max_rounds`, set `status: escalated`, take the open issues to the human, do **not** approve.
7. Append the triage's drops to `adjudications`, and **condense them into the do-not-raise categories** handed to the next round (so fresh reviewers don't re-find them).

## Human approval → approved
On a clean terminal pass, show the draft to the human and get **"is this what you want?"** confirmed.
- **Yes** → set the Task `status: approved`, and copy the surviving `adjudications` into the node's **Change Log** (so a future *revision*'s cold review won't re-litigate them).
- **Escalated, or human rejects** → it stays `draft`; loop back (fix the draft, or re-grow it).

## When it's done
The node is `approved` — spec cold-verified and human-approved. **Next: `grovespec-implement`** (build it).
