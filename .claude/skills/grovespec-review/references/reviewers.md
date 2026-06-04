# reviewers — the cold-review engine (shared by verify + review)

> `grovespec-verify` (spec) and `grovespec-review` (code) both load this when they run a round. The SKILLs hold the *rules* (levels, when to pass, what to fix); this holds the *exact mechanics* — how to spawn, the prompts, the findings format, the triage, the round hand-off — so every node's review comes out the same shape. The two callers differ only in the **lens set** and the **read-scope** (below).
> Reviewers write their findings in the project's language (`config.language`); the role lenses here are the fixed structure.

## Which lens set · which scale · which read-scope
- **verify** (`target_type: spec`) — the **spec lenses**; count from `config.yaml` `verify.scale`. Reviewers may read the spec context: the draft Task, the parent/sibling Tasks, `tree.md`, `brief.md`, `conventions.md`.
- **review** (`target_type: result`) — the **code lenses**; count from `config.yaml` `review.scale`. Reviewers read **ONLY the files this node changed (its `src/`·`tests/` diff) + its AC·Contract + the test results** — *never* other nodes' code or the wider codebase. **This bound is what keeps review's cost flat as the project grows.**

## Spawning
- Spawn the reviewers as **parallel subagents** (Claude Code's Task tool), one per lens — the **count comes from `config.yaml`** (`verify.scale[level].reviewers` or `review.scale[level].reviewers`; the SSoT — don't hardcode a number or range here). Each subagent starts from an **empty context** — that independence is what makes them "cold". Send them in one batch so they run concurrently. (Works only from the main session — see each skill's invocation contract.)
- For `skip`: spawn none; the caller self-checks against the criteria.
- Each reviewer's prompt = **common preamble** + its **role lens** + the **findings format**. Never give them how the target was built, or the previous round's discussion.

## Findings format (every reviewer returns exactly this)
One finding per line, nothing else:
```
- [critical|should-fix|nice-to-have] <where: §section / file:line> — <what is wrong, and why>
```
Severity:
- `critical` — (spec) unbuildable / breaks another node / wrong behavior; (code) a failing or missing AC, a security hole, or wrong behavior.
- `should-fix` — buildable/works, but a consumer must guess, or a gap (or a hollow test) will bite later.
- `nice-to-have` — better if fixed, not blocking.

If a lens finds nothing, it says `none` with a one-line note on what it checked. The reviewer's final message **is** the result — no greeting, just the findings.

Examples (the exact shape):
- ✅ `- [should-fix] §Contract "Returns" — return shape unspecified: a consumer can't tell a list from a single record.`
- ✅ `- [critical] src/add.py:42 — amount not validated; a negative amount passes straight to storage.`
- ❌ `the contract seems a little unclear in places` (no severity, no location, not actionable).

## Common preamble (prepend to every role)
```
You are a *cold* reviewer in a GroveSpec project. You did NOT see how this was built —
you see only the target and the criteria, and your job is to find flaws.
**Default to "there is a problem":** to conclude there's no flaw, you must have actively
tried to disprove it first.

Target: {target}  (spec = the draft Task | result = this node's code diff)
Criteria: {spec → the parent's Contract + the clause this node must fill ·
           code → this node's AC + Contract + the test results}
You may read:
  - (verify / spec)  the draft Task, parent/sibling Tasks, tree.md, brief.md, conventions.md.
  - (review / code)  ONLY the files this node changed + its AC·Contract + the test results.
                     NOT other nodes' code, NOT the wider codebase.
Write your findings in {config.language}.

<then the findings format, then the role lens below>
```

## Role lenses — verify (spec)
Fixed order (a level always uses the same lenses — never an ad-hoc pick): consumer-impersonator · gap-finder · coherence · non-expert · breaker. A level takes the first *N* = `verify.scale[level].reviewers` (`full` = all five).

- **consumer-impersonator** — You are *a node that will use this contract*. Try to write your code against this contract alone. Wherever you'd have to *guess* — a return shape, who outputs what, where a value comes from — that's a hole. List every spot you could not build.
- **gap-finder** — Calmly walk the standard edge cases and flag each one the contract doesn't answer: empty input · not-found · failure · none-set · file missing/corrupt · the basis of "current X" (time zone? source?) · re-setting an existing value. If the contract is silent, it's a gap.
- **coherence** — Check this contract against the *global rules and the sibling/parent contracts*. Read `conventions.md` + the related Tasks: units, data-access path, file count, naming. Does a child's contract fill what the parent promised; for a skeleton, do the children sum to the parent? If this changes another done node's behavior, is that node's contract updated too? Cite both sides of any mismatch.
- **non-expert** — You don't know the jargon. The spec must be confirmable at a glance. Fail it on undefined terms, fluff, anything you can't restate in plain language, the same concept under different names. Quote the offending line.
- **breaker** — You came to break the *contract*. Find inputs/flows that make it fall apart on paper: weird/broken values (empty · text where a number goes · negative · zero · huge · wrong unit); weird identifiers (blank · whitespace · case-only difference); abnormal flows (call order · concurrent writes · a corrupted data file · a failure mid-operation). State each as "this input → the contract does X (or leaves it undefined)".

## Role lenses — review (code)
Fixed order, take the first *N* = `review.scale[level].reviewers` (`full` = all five). Each reviewer reads **only this node's changed files + the AC·Contract + the test results**.

- **correctness** — does the diff actually meet the AC and the Contract? Logic errors, off-by-one, wrong branch, mishandled return, a contract invariant broken.
- **security** — injection, auth/authz gaps, secrets in code or logs, unsafe defaults, data trusted blindly, unsafe deserialization/path handling — *in this diff*.
- **the-6-month-maintainer** — could someone who didn't write this change it safely? Hidden coupling, surprising side effects, and **duplication of code that already exists** (Principle 3 — did this reimplement something the pre-check should have reused?).
- **breaker** — you came to break the *running code*: edge·failure inputs the diff mishandles (empty · huge · negative · wrong type · concurrent writes · a failure mid-operation). State each as "this input → the code does X".
- **test-quality** — are the tests *real*? Does each test actually exercise the code path, or is it hollow / tautological / over-mocked so it would pass even if the code were wrong? Is every AC item backed by a passing test? A green suite that proves nothing is a `should-fix` (or `critical` if it masks a failing AC). *(This is the lens that stops "tests pass" from being a rubber stamp.)*

## Aggregate
Merge all findings; dedupe by (where + what). On a severity disagreement, take the **higher**.

## Over-strictness check (triage) — `full` (and optionally `standard`)
Spawn one more cold reviewer, given the aggregated list + the target. It plays *defender*: for each finding, rule **KEEP (severity) / DOWNGRADE (to what) / DROP (nitpick)** with a one-line reason. Guidance:
- *(spec target)* This is a *concept* spec — don't demand implementation detail; but a real interface hole (unbuildable, self-contradiction, wrong grounding) is real even here.
- *(code target)* Judge against the AC + Contract, not future-proofing or style — a missing test for an AC item, a hollow test, or a real security hole is real; a stylistic nit is not.
- A project-accepted gap (an already-known limitation) doesn't need a full fix — "note the same gap" is enough; demanding a full fix is over-reach.
- Merge findings that share a root; a reviewer can misread — re-check before keeping.

It returns the **confirmed list** + a **do-not-re-raise** list (dropped / accepted, each with a reason).

## Round hand-off
Write to `.grovespec/review/<id>.verify.yaml` (verify) or `.grovespec/review/<id>.review.yaml` (review) — template `review-state.yaml`: the round's outcome, the confirmed `open_issues`, and append the triage's do-not-re-raise items to `adjudications`. The next round is a **new session** that reads only this file — so the adjudications are how a later cold review avoids re-litigating what was already decided. (On approve/done, the *caller* copies the surviving adjudications into the node's Change Log — so future *revisions* don't re-litigate them either.)
