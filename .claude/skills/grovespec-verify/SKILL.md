---
name: grovespec-verify
description: GroveSpec spec verification — a cold multi-persona check of a node's *draft spec* (its contract·decomposition), before any code. Several fresh-eyes reviewers who never saw how it was written inspect the draft in parallel with different roles, the issues are fixed, and on a clean pass + human approval the node goes draft → approved. Use when the user wants to "verify this spec / check the draft / review the spec / approve this node / grovespec verify", or right after grow·init produced a draft. For reviewing *code* use grovespec-review.
---

# grovespec-verify

Cold verification of a node's **draft spec** — the step that turns `draft` → `approved`. (Reviewing *code* is `grovespec-review`.)

The leverage: spend the multi-persona scrutiny *here*, on the spec, before any code exists. A contract or decomposition error caught now costs nothing; caught after building, it costs the build. **This is the one place the cold persona review lives for a spec** — code review (`grovespec-review`) does *not* re-ask spec questions.

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `bash .grovespec/bin/grovespec lang`) and write **every** reply in that language (the cold reviewers' findings too). These files are English; your output is not.

## Why cold · several · different
A checklist gets rubber-stamped. So we stack: ① reviewers who did *not* see how the draft was written, ② with *different* roles, ③ *several* in parallel, ④ a triage that drops nitpicks, ⑤ repeat until a clean round — then a human approves.

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
> The exact spawn mechanics, reviewer prompt bodies, findings format, and triage prompt are in `.claude/skills/grovespec-review/references/reviewers.md` (shared by verify + review) — load it and use the **spec lens set**, so every node's verify comes out the same shape.

1. **Spawn cold reviewers in parallel** (subagents, empty context), as many as the level sets, using the **spec lenses** in their fixed order: consumer-impersonator · gap-finder · coherence · non-expert · breaker (take the first *N*). Each gets *only the draft + criteria* — not how it was written, not a prior round's discussion — and is told *"find flaws; default to 'there is a problem'."*
2. **Aggregate** — merge·dedupe; on a severity clash take the higher.
3. **Over-strictness check** (`full`; optional on `standard`) — a separate cold reviewer drops nitpicks.
4. **Fix the draft** — apply the confirmed issues to the draft Task right here. (The reviewers were cold subagents; fixing in this main session is fine — each next round re-spawns *fresh* reviewers, so coldness holds.)
5. **Pass judgment** by `strength` (1: no `critical` · 2: +`should-fix` · 3: +`nice-to-have`). A pass: `consecutive_passes`+1; a fail resets it to 0. Re-spawn a new cold round until it passes `repeat` times in a row.
6. **Stop safety**: if `round` exceeds `max_rounds`, set `status: escalated`, take the open issues to the human, and do **not** approve.
7. Append the triage's dropped-as-nitpick · accepted-gap items to the state file's `adjudications` (so a later cold round won't re-litigate them).

## Human approval → approved
On a clean terminal pass, show the draft to the human and get **"is this what you want?"** confirmed.
- **Yes** → set the Task `status: approved`, and copy the surviving `adjudications` into the node's **Change Log** (so a future *revision*'s cold review won't re-litigate them).
- **Escalated, or human rejects** → it stays `draft`; loop back (fix the draft, or re-grow it).

## When it's done
The node is `approved` — spec cold-verified and human-approved. **Next: `grovespec-implement`** (build it).
