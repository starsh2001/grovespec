# reviewers — the operational detail for grovespec-review

> grovespec-review loads this when it actually runs a round. SKILL.md holds the *rules* (levels, strength, when to pass); this holds the *exact mechanics* — how to spawn, the prompts, the findings format, the triage, the round hand-off. Keep these the same so every node's review has the same shape.
> Reviewers write their findings in the project's language (`config.language`); the role lenses below are the fixed structure.

## Spawning
- Spawn the reviewers as **parallel subagents** (Claude Code's Task tool), one per role, as many as the level sets (`skip`=0, `light`=1–2, `standard`=3, `full`=5). Each subagent starts from an **empty context** — that independence is what makes them "cold". Send them in one batch so they run concurrently. (This only works from the main session — see the review skill's invocation contract.)
- For `skip`: spawn none; the caller self-checks against the criteria.
- Each reviewer's prompt = **common preamble** + its **role lens** + the **findings format**. Never give them how the target was built, or the previous round's discussion.

## Findings format (every reviewer returns exactly this)
One finding per line, nothing else:
```
- [critical|should-fix|nice-to-have] <where: section / line> — <what is wrong, and why>
```
Severity:
- `critical` — as-is the node can't be built, or it breaks another node, or it's wrong behavior.
- `should-fix` — buildable, but a consumer has to guess, or a gap will bite later.
- `nice-to-have` — better if fixed, but not blocking.

If a lens finds nothing, it says `none` with a one-line note on what it checked. The reviewer's final message **is** the result — no greeting, just the findings.

## Common preamble (prepend to every role)
```
You are a *cold* reviewer in a GroveSpec project. You did NOT see how this was built —
you see only the result and the criteria, and your job is to find flaws.
**Default to "there is a problem":** to conclude there's no flaw, you must have actively
tried to disprove it first.

Target: {target path}  ({spec | result})
Criteria (what to judge against): {parent contract / requirements / AC}
You may read: {tree.md, brief.md, conventions.md, the sibling/parent Tasks, the actual code — list what's relevant}
Write your findings in {config.language}.

<then the findings format, then the role lens below>
```

## Role lenses — spec review
consumer-impersonator · gap-finder · coherence · non-expert · breaker. `full` uses all five; lighter levels take them from the front.

- **consumer-impersonator** — You are *a node that will use this contract*. Try to actually write your code against this contract alone. Wherever you'd have to *guess* — a return shape, who outputs what, where a value comes from — that's a hole. List every spot you could not build.
- **gap-finder** — Calmly walk the standard edge cases and flag each one the contract doesn't answer: empty input · not-found · failure · none-set · file missing/corrupt · the basis of "current X" (time zone? source?) · re-setting an existing value. If the contract doesn't say, it's a gap.
- **coherence** — Check this contract against the *global rules and the sibling/parent contracts*. Read conventions.md + the related Tasks and cross-check: units, data-access path, file count, naming. Does a child's contract fill what the parent promised; for a skeleton, do the children sum to the parent? If this changes another (done) node's behavior, is that node's contract updated too? Cite both sides of any mismatch.
- **non-expert** — You don't know the jargon. The spec must be confirmable at a glance. Fail it on: undefined terms, words you can't follow, fluff, anything you can't restate in plain language, the same concept under different names. Quote the offending line.
- **breaker** — You came to break it. Find inputs/flows that make the contract fall apart: weird or broken values (empty · text where a number goes · negative · zero · huge · wrong unit); weird identifiers (blank · whitespace · case-only difference); abnormal flows (call order · concurrent writes · a corrupted data file · a failure mid-operation). State each as "this input → the contract does X (or leaves it undefined)".

## Role lenses — result review
correctness · security · the-6-month-maintainer · breaker · non-expert.

- **correctness** — does it actually meet the AC and the Contract; any logic error?
- **security** — injection, auth, secrets, unsafe defaults, the data it trusts blindly.
- **the-6-month-maintainer** — could someone who didn't write this change it safely? Hidden coupling, surprises, missing tests.
- **breaker** — same as the spec breaker, but against the running code (edge·failure inputs).
- **non-expert** — is the result understandable and confirmable; any unexplained complexity?

## Aggregate
Merge all findings; dedupe by (where + what). On a severity disagreement, take the **higher**.

## Over-strictness check (triage) — `full` (and optionally `standard`)
Spawn one more cold reviewer, given the aggregated list + the target. It plays *defender*: for each finding, rule **KEEP (severity) / DOWNGRADE (to what) / DROP (nitpick)** with a one-line reason. Guidance to it:
- This is a *concept* spec — don't demand implementation detail; but a real interface hole (unbuildable, self-contradiction, wrong grounding) is a real flaw even here.
- A project-accepted gap (an already-known limitation) doesn't need a full fix — "note the same gap" is enough; demanding a full fix is over-reach.
- Merge findings that share a root; a reviewer can misread — re-check before keeping.

It returns the **confirmed list** + a **do-not-re-raise** list (dropped / accepted, each with a reason).

## Round hand-off
Write to `.grovespec/review/<id>.yaml` (template: `review-state.yaml`): the round's outcome, the confirmed `open_issues`, and append the triage's do-not-re-raise items to `adjudications`. The next round is a **new session** that reads only this file — so the adjudications are how a later cold review avoids re-litigating what was already decided.
