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
- `strength`·`max_rounds`: from `config.yaml` (overridable per node).
- `scope` (optional): *did the contract change · how many consumers · node importance*. If the caller passes it, that picks the scale level; if not, review works it out itself (did the Contract section change? grep for the consumer count?).

State lives in `.grovespec/review/<id>.yaml` (template: `.grovespec/templates/review-state.yaml`). **Each round is a new session** that reads only this file and continues — it must not carry over the prior round's discussion, or "fresh eyes" is lost.

## Review depth scales with blast radius (cost)
If `strength` is *how far you block*, this is a separate dial: it **scales the reviewer count·repeat to the change's blast radius.** A full review (5 reviewers × repeat 2) on an 8-line change is overkill.

The level is set by three things — ① did the contract change ② how many consumers ③ node importance (config):

| level | when | review |
|---|---|---|
| `skip` | contract unchanged + trivial (format·comment·1–2 lines) | 0 reviewers, self-check only |
| `light` | contract unchanged + small change | 1–2 reviewers, repeat 1, no over-strictness check |
| `standard` | normal (e.g. a new feature node) | 3 reviewers, repeat 1 |
| `full` | *contract changed* or many consumers or important node | 5 reviewers, repeat 2, includes over-strictness check |

Reviewer-count·repeat defaults live in `config.yaml`'s `review.scale`. If the caller passes ①② (revise already computes them during propagation), use that to pick the level.

> **Where it runs (the invocation contract).** GroveSpec skills run in your **main Claude Code session** — the main agent, which *can* spawn subagents. review spawns its cold reviewers as **subagents (Claude Code's Task tool)** from there. The one thing that breaks it: running a grovespec skill *as a subagent itself* — then it can't spawn the reviewers and review silently degrades to a non-cold self-check (defeating the whole point). So **invoke grovespec skills from the main session; never nest one inside a subagent.**

## One round

> The exact spawn mechanics, the reviewer prompt bodies, the findings format, and the triage prompt are in `references/reviewers.md` — load it to run a round, so every node's review comes out the same shape.

1. **Spawn cold reviewers in parallel, *as many as the level sets*** (subagents, each with an empty context). If `skip`, spawn none and just self-check.
   - Each gets *only the target + criteria*. Not how it was built, not the prior round's discussion.
   - Send them in with *"Your job is to find flaws. Default to 'there is a problem'."*
   - Give them *different* roles (below).
   - Have them return findings with a *severity*: `critical` | `should-fix` | `nice-to-have`.
2. **Aggregate** — merge and dedupe. When severities disagree, take the *higher* one.
3. **Over-strictness check** — a separate reviewer judges *"are these real blockers, or nitpicks?"* and drops the nitpicks. (Stops infinite loops.)
4. **Pass judgment** (by `strength`):
   - `1`: pass if no `critical`
   - `2`: pass if no `critical`·`should-fix`
   - `3`: pass only if none of the three
5. **Repeat**: on a pass, `consecutive_passes` +1. Stop when it passes `repeat` times *in a row*. Otherwise hand the remaining issues back to the caller (who fixes them), and run the next round as a *new session*.
6. **Stop safety**: if `round` exceeds `max_rounds`, take the remaining issues *to the human*.

## Reviewer roles (the diversity is what works)
Many identical reviewers all see the same weakness. Mix *different* eyes.
- **Spec review (`spec`)**: consumer-impersonator (can I build mine from this contract alone?) · gap-finder (calmly walks the normal edge cases — empty·not-found·failure — and flags each one the contract leaves unanswered) · coherence (does it fill the parent's contract; for a skeleton, do the children's contracts sum to the parent's?) · non-expert (fails it on any jargon·fluff a layperson can't follow) · breaker (deliberately tries weird or broken inputs and unusual situations to make the contract fall apart). `full` uses all five; lighter levels take them from the front.
- **Result review (`result`)**: correctness · security · the person who maintains this in 6 months · breaker (edge·failure) · non-expert.

The prompt body for each role — plus the findings format and the triage prompt — is in `references/reviewers.md`.

## What it returns
A **confirmed issue list** (by severity) written into `open_issues` and handed to the caller. **The caller fixes it, not review** — the caller already has the working context, and fixing needs no independence (review already guaranteed that, cold).

Because reviewers are cold (no memory across rounds or revisions), the caller also records the outcome and any *dropped-as-nitpick · accepted-gap* adjudications — with the reason — in the node's Change Log, so a later cold review doesn't re-litigate what was already decided.
