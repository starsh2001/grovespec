---
name: grovespec-review
description: GroveSpec code review — the implemented→reviewed step. NOT a persona reading the whole codebase: it (1) runs the node's tests and analyses the results against the AC, and (2) has a few cold fresh-eyes reviewers inspect ONLY this node's diff with code roles (correctness·security·maintainer·breaker). Returns a confirmed issue list; grovespec-fix applies it; on a clean pass + human confirm the node goes to done. Use when the user wants to "review the code / run the tests / code review / grovespec review" after implement. For verifying a spec use grovespec-verify; to apply the fixes use grovespec-fix.
---

# grovespec-review

Code review — the step that turns `implemented` → `reviewed` (→ `done` on a clean pass + human confirm). (Verifying the *spec* is `grovespec-verify`.)

Two things, both bounded to **this one node**, so cost never scales with the codebase:
1. **Run the tests + analyse the results** — the deterministic spine. Did every AC-derived test pass? Any AC item with no test? Any measurable NFR target (in the AC) unmet?
2. **Cold code review of THIS NODE'S DIFF only** — a few fresh-eyes reviewers inspect just the diff, with code roles. **Not the whole codebase, not other nodes' code.** This catches what tests can't see (security, hidden coupling, a hollow test).

> review never re-asks *spec* questions ("is the contract complete?") — `grovespec-verify` settled those cold, before any code. Here the spec (AC·Contract) is the *yardstick*, not the subject.

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `bash .grovespec/bin/grovespec lang`) and write **every** reply in that language (the reviewers' findings too). These files are English; your output is not.

## What it takes in
- the node's **diff** (its `src/`·`tests/` changes) + its **AC·Contract** as criteria + the **test results**.
- `test` command + `strength`·`max_rounds`·`scale` from `.grovespec/config.yaml` `review:` (overridable per node).

> **Where it runs (the invocation contract).** Run grovespec-review in your **main Claude Code session** — it spawns the cold reviewers as **subagents**. **Never run a grovespec skill *as* a subagent** — then it can't spawn reviewers and silently degrades to a non-cold self-check.

## State
`.grovespec/review/<id>.review.yaml` (template `review-state.yaml`, `target_type: result`). Separate from verify's `<id>.verify.yaml` — they never collide.

## 1. Run the tests (the spine)
Run `config.review.test` (if empty, infer it from the project — `pytest`, `npm test`, … — or ask). Collect pass/fail per test and **map them to the AC**: every AC item should have a passing test. Measurable NFR targets in the AC (e.g. `p95 < 200ms`) are checked here too.
- A **failed test** is a `critical` issue (the implementation doesn't meet its AC) → straight to the verdict (fix), no cold round needed yet.
- **`tdd: false`** node (no tests): note it; this review leans entirely on the cold diff review below — the *only* gate available — and the unmet AC items stay unchecked.

Tests green → go to the cold review.

## 2. Cold code review — the diff only
Scale the reviewer count·repeat by the diff's size·risk (`config.yaml` `review.scale` — the SSoT; never restate a number here). When ambiguous, round **up**.

| level | when | review |
|---|---|---|
| `skip` | trivial diff (format·comment·≤2 lines) | tests only, no reviewers |
| `light` | small diff, no new behavior | cold reviewers, repeat 1 |
| `standard` | a normal node's implementation | cold reviewers, repeat 1 |
| `full` | security-touching / large / contract-bearing diff | cold reviewers, repeat 2, + over-strictness check |

> Spawn mechanics, the reviewer prompt bodies, findings format, and triage are in `references/reviewers.md`. Use the **code lens set** in its fixed order: correctness · security · the-6-month-maintainer · breaker · test-quality (take the first *N*). Each reviewer reads **only this node's diff + the AC·Contract + the test results** — never the wider codebase or other nodes.

Run cold rounds — each: spawn the reviewers in parallel (subagents, empty context, *"find flaws; default to 'there is a problem'"*) → aggregate (dedupe; higher severity wins) → over-strictness triage (`full`; optional `standard`) → judge by `strength` (1: no `critical` · 2: +`should-fix` · 3: +`nice-to-have`).
- A round **finds blocking issues** → stop: write them to `open_issues`, `status: reviewed`, `consecutive_passes`→0, hand to `grovespec-fix`.
- A round is **clean** → `consecutive_passes`+1; run another fresh cold round until clean `repeat` times in a row.
- `round` exceeds `max_rounds` → `status: escalated`, issues to the human, **not** done.

## 3. Verdict
- **Issues remain** → `status: reviewed` with `open_issues`; next is **`grovespec-fix`** (it applies them → `fixed` → re-run `grovespec-review`). review does **not** fix — the diff stays the cold reviewers' subject, and fixing needs no independence (cold already gave that).
- **Clean terminal pass** (tests green + cold review passed `repeat` times running) → show the human the result + test summary; on **confirm** set `status: done` and copy the surviving `adjudications` into the node's **Change Log** (so a future revision's cold review won't re-litigate them).

## When it's done
On `done`: the node's tests pass, its diff is cold-reviewed clean, the human confirmed. A `done` skeleton's children can now be grown (`grovespec-grow`); a `done` leaf ends its branch.
