---
name: grovespec-review
description: GroveSpec review — has several *fresh-eyes* reviewers independently inspect a result (a spec or code), then returns a triaged, confirmed issue list. To stop checklists from being rubber-stamped, it runs cold reviewers (who never saw how it was built) in parallel, each with a different role. Called internally by grovespec-grow·implement·revise, and invokable directly when the user asks to review or sanity-check a spec or code, or says "grovespec review" (in any language). Fixing is done by the *caller*, not by this skill.
---

# grovespec-review

Review. **This skill runs on its own (cold)** — if the builders review their own work, they miss the same blind spots. Fresh eyes look instead.

## Why go this far
A checklist just gets checked off (it claims "passed" once, then the same problems resurface on a re-read). So we stack five things: ① reviewers who did *not* see how it was built, ② with *different* roles, ③ *several* in parallel, ④ filtering out nitpicks too, ⑤ repeating until a full clean round.

## What it takes in
- `target`: the thing to review (a spec file or code).
- `target_type`: `spec` | `result`.
- criteria: what to judge it against (parent contract / requirements / AC).
- `strength`·`max_rounds`: from `.grovespec/config.yaml` (overridable per node).
- `scope` (optional): *did the contract change · how many consumers*. If the caller passes it, that picks the level; if not, review computes it (did the Contract section change? consumer count from the caller's propagation or the `blocked_by` reverse-lookup). **When the computed level is ambiguous, round *up* one level** — a too-light review silently lets drift through; a too-heavy one just costs a little.

State lives at `config.paths.review` (default `.grovespec/review/`) as `<id>.yaml` — **`<id>` = the node id under review** (e.g. `TASK-3`). Re-invoking review for the same node **reuses this file so rounds accumulate** (propagation reviews each consumer in its own `<id>.yaml`). Format/template: `.grovespec/templates/review-state.yaml`; **round 1 creates it** from that template (`round: 1`, `consecutive_passes: 0`, with the chosen `level·strength·repeat·max_rounds`), later rounds update it in place. **review writes *only* this state file** — it never edits the target or any node doc (that's the caller's job; editing the target would destroy the next round's coldness). **Each round is a new session** that reads only this file and continues — it must not carry over the prior round's discussion, or "fresh eyes" is lost.

## Review depth scales with the change's reach (cost)
If `strength` is *how far you block*, this is a separate dial: it **scales the reviewer count·repeat to how far the change reaches** (how many nodes its contract touches). A full review (5 reviewers × repeat 2) on an 8-line change is overkill.

The level is set by checkable inputs — ① did the contract change (diff the Contract section) ② consumer count ③ is it a skeleton (defines children):

| level | when | review |
|---|---|---|
| `skip` | contract unchanged + trivial (format·comment·≤2 lines) | self-check only, no reviewers |
| `light` | contract unchanged + small change (≤ ~20 lines, no new behavior) | cold reviewers, repeat 1, no over-strictness check |
| `standard` | a normal new feature node | cold reviewers, repeat 1 |
| `full` | *contract changed*, or 3+ consumers, or a skeleton (defines children) | cold reviewers, repeat 2, + over-strictness check |

Exact reviewer **counts** per level live in `config.yaml` `review.scale` (the SSoT — never restate a number here; that's how a doc and its config drift apart). If the caller passes ①②③ (grow/revise compute them), use that to pick the level; otherwise compute as above.

> **Where it runs (the invocation contract).** GroveSpec skills run in your **main Claude Code session** — the main agent, which *can* spawn subagents. review spawns its cold reviewers as **subagents (Claude Code's Task tool)** from there. The one thing that breaks it: running a grovespec skill *as a subagent itself* — then it can't spawn the reviewers and review silently degrades to a non-cold self-check (defeating the whole point). So **invoke grovespec skills from the main session; never nest one inside a subagent.**

## One round

> The exact spawn mechanics, the reviewer prompt bodies, the findings format, and the triage prompt are in `references/reviewers.md` — load it to run a round, so every node's review comes out the same shape.

1. **Spawn cold reviewers in parallel, *as many as the level sets*** (subagents, each with an empty context). If `skip`, spawn none and just self-check.
   - Each gets *only the target + criteria*. Not how it was built, not the prior round's discussion.
   - Send them in with *"Your job is to find flaws. Default to 'there is a problem'."*
   - Give them *different* roles (below).
   - Have them return findings with a *severity*: `critical` | `should-fix` | `nice-to-have`.
2. **Aggregate** — merge and dedupe. When severities disagree, take the *higher* one.
3. **Over-strictness check** (`full`; optional on `standard`; not on `light`/`skip`) — a separate reviewer judges *"are these real blockers, or nitpicks?"* and drops the nitpicks. (Stops infinite loops.)
4. **Pass judgment** (by `strength`):
   - `1`: pass if no `critical`
   - `2`: pass if no `critical`·`should-fix`
   - `3`: pass only if none of the three
5. **Repeat**: on a pass, `consecutive_passes` +1; **a fail resets it to 0**. Stop when it passes `repeat` times *in a row* (`skip`/`repeat: 0` → no reviewer round; done immediately). Otherwise hand the remaining issues back to the caller (who fixes them); the caller then **re-invokes review on the *same* `<id>.yaml`** and the next round runs as a *new session* continuing that file.
6. **Stop safety**: if `round` exceeds `max_rounds`, set `status: escalated` and take the remaining issues *to the human* — on an escalated return the caller does **not** mark the node `done`.

## Reviewer roles (the diversity is what works)
Many identical reviewers all see the same weakness. Mix *different* eyes.
- **Spec review (`spec`)**: consumer-impersonator (can I build mine from this contract alone?) · gap-finder (calmly walks the normal edge cases — empty·not-found·failure — and flags each one the contract leaves unanswered) · coherence (does it fill the parent's contract; for a skeleton, do the children's contracts sum to the parent's?) · non-expert (fails it on any jargon·fluff a layperson can't follow) · breaker (deliberately tries weird or broken inputs and unusual situations to make the contract fall apart). `full` uses all five; lighter levels take them from the front.
- **Result review (`result`)**: correctness · security · the person who maintains this in 6 months · breaker (edge·failure) · non-expert.

The prompt body for each role — plus the findings format and the triage prompt — is in `references/reviewers.md`.

## What it returns
A **confirmed issue list** (by severity) written into `open_issues` and handed to the caller. **The caller fixes it, not review** — the caller already has the working context, and fixing needs no independence (review already guaranteed that, cold).

Because reviewers are cold (no memory across rounds or revisions), adjudications get written down twice, on purpose: **review** appends the *dropped-as-nitpick · accepted-gap* items (with reasons) to the state file's `adjudications` — that stops the *next round* re-litigating them; then the **caller**, on done, copies the surviving ones into the node's **Change Log** — that stops a *future revision*'s cold review re-litigating them.
