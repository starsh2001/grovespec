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

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `node .grovespec/bin/grovespec.mjs lang`) and write **every** reply in that language (the reviewers' findings too). These files are English; your output is not.

## What it takes in
- **the node** — *if none is named*, take an `implemented` or `fixed` node `grovespec check` reports ready (next step = review).
- **what you review** — its **diff** + its **AC·Contract** (the criteria) + the **test results**.
  - *The diff, mechanically*: **`node .grovespec/bin/grovespec.mjs diff TASK-N`** computes it — the cycle's `TASK-N:` commits, their file set, and the base→working-tree diff (cycle definition: `FORMATS.md`). **Never assemble the diff by hand** — a hand-assembled diff misses files, and the cold reviewers then review the wrong subject without anyone knowing. It holds the cycle's own gate records out (counted, not named); if a round asks what a held record said, that question is the cold premise breaking — answer it from the Task file, not the record.
- `test` command + `strength`·`max_rounds`·`scale` from `.grovespec/config.yaml` `review:` (overridable per node).

> **Where it runs (the invocation contract).** Run grovespec-review in your **main agent session** — it spawns the cold reviewers as **subagents**. **Never run a grovespec skill *as* a subagent** — then it can't spawn reviewers and silently degrades to a non-cold self-check.

## State
Result reviews now have two finding lanes:
- `open_issues` holds only the defects in the current diff/target that keep this code gate open.
- `followups` holds real later revise/verify work (`kind: contract-gap`) or non-blocking notes (`kind: concern`).
- Every open finding needs `kind` + `family` as well as the gate fields. The same `family` may appear only once across `open_issues` + `followups`.
- If the flaw is in this cycle's diff or in the text this cycle is reviewing, classify it as `kind: defect` even if the eventual repair also needs a later spec/contract revise. Do not move a current-target defect to `followups` just because a spec edit would also help.

`.grovespec/review/<id>.review.yaml` (template `review-state.yaml`, `target_type: result`). Separate from verify's `<id>.verify.yaml` — they never collide.

## 1. Run the tests (the spine)
Run **`node .grovespec/bin/grovespec.mjs test TASK-N`** — it executes `config.review.test` and records the exit code + log into the node's review state (`last_test` + `<id>.test.log`), so *"the tests passed" is a machine-written fact, not your reading of scrollback*. Your job here is the interpretation (the AC mapping below), not the bookkeeping.
- **Empty?** (greenfield leaves it empty at init — there was no stack yet) → **derive it from the stack/project** (`pytest` for Python, `npm test`/`node --test` for Node, `cargo test`, a `Makefile` target, …), **write it back to `config.review.test`**, then run `grovespec test TASK-N` again. **Ask the human only if you genuinely can't tell** (no clear runner, or several equally-plausible ones) — and then as a *"이게 맞아?"* confirm with your best guess, never a blank "what's your command?".
- **Map the results to the AC.** Collect pass/fail per test; every AC item should have a passing test (items marked `(gap)` are excluded — deliberately undefined behavior, `FORMATS.md`).
- **Measurable NFR targets** in the AC (e.g. `p95 < 200ms`) are checked here too. A target with **no runnable check** (no bench/load tooling behind the test command) is marked **unverified** and surfaced at the human confirm — never silently counted as met.
- A **failed test** is a `critical` issue (the implementation doesn't meet its AC) → straight to the verdict (fix), no cold round needed yet. **The find phase is still owed**: this shortcut defers it, never replaces it — once the fix turns the suite green, the cycle enters (or resumes) **find** on the full diff; only fixes of already-*judged* findings re-enter at the scoped confirmation instead.
- **`tdd: false`** node (no tests): note it; this review leans entirely on the cold diff review below — the *only* gate available — and the unmet AC items stay unchecked.

Tests green → go to the cold review.

## 2. Cold code review — the diff only
Scale the reviewer count·repeat by the diff's size·risk (`config.yaml` `review.scale` — the SSoT; never restate a number here). When ambiguous, round **up**.

| level | when | review |
|---|---|---|
| `skip` | trivial diff (format·comment·≤2 lines) | tests only, no reviewers |
| `light` | small diff, no new behavior | cold reviewers (count·repeat from `review.scale`) |
| `standard` | a normal node's implementation | cold reviewers, + over-strictness check |
| `full` | security-touching / large / contract-bearing diff | cold reviewers, + over-strictness check |

`skip` collapses the cycle, it doesn't skip the record: the caller self-checks the AC mapping, writes the state file itself (one `rounds[]` self entry; `found`/`strategies` may stay empty), and pin/validate/approve run as usual.

> Spawn mechanics, the reviewer prompt bodies, findings format, **§The cycle + §The strategy ledger**, and triage are in `references/reviewers.md`. Use the **code lens set** in its fixed order: correctness · security · the-6-month-maintainer · breaker · test-quality (take the first *N*). Each reviewer reads **only this node's diff + the AC·Contract + the test results** — never the wider codebase or other nodes.

Run the cycle — **find → judge → fix** (`reviewers.md` §The cycle):
- **find** — cold waves over the diff, *frozen*: nothing is fixed and nothing is graded between waves, so every wave reads the same bytes. Each wave gets the lens set + its **strategy ledger** assignments + the **found list** (*don't re-report; find what's not on it*). Finds accumulate unjudged. Close when **the ledger is exhausted and at least `repeat` waves have run**.
- **judge — once.** Over-strictness triage on the whole found list in one pass → lanes + gate fields on every keep → judge by `strength` (1: no `critical` · 2: +`should-fix` · 3: +`nice-to-have`).
  - **Each finding carries its gate answers as fields** (`proposed` · `gate1` · `gate2` · `gate3`, plus `clause`·`workaround`·`harm` where an answer demands one). **`grovespec validate` recomputes the severity from them and fails the record if the grade exceeds what they allow** — so run `validate` before you hand off, and never hand-tune a level to make a gate open or close. A finding whose gates you can't answer isn't gradeable; it doesn't go in.
  - **A "the tests don't measure X" finding must name the Contract/AC clause that names X** (`reviewers.md` — review's Stop rule); a coverage demand with no named clause is dropped, and tests beyond the contract are themselves a cut.
  - Blocking issues → write them to `open_issues`, `status: reviewed`, hand to **`grovespec-fix`**. **Empty → the cycle passes now** (no extra lap — the recall duty was paid by `repeat` differently-armed waves).
- **fix loop** — `grovespec-fix` applies the list; then ONE cold **confirmation round scoped to the fix diff + the items it claims closed + the in-node use-sites of what it changed** (not the whole diff again): item closed? new hole in what the fix touched? A serendipitous real defect still enters through the gates and joins the list. **The list empty + the last confirmation clean → terminal pass.**
- **Non-blocking floor** — surviving findings all `nice-to-have` or out-of-scope **pass**, even at `strength: 2`. Only if §1's AC mapping is affirmatively complete (every non-`(gap)` item *shown* to have a passing test); an unmapped item blocks like a `should-fix`, so you can't pass by not looking.
- **A node whose own test scaffolding grew this cycle is a smell** — helpers·fixtures added to defend the node's *tests* rather than its behavior are to **cut**, not to review deeper.
- `round` (find waves + judge + confirmations) exceeds `max_rounds` → `status: escalated`, issues to the human, **not** done.
- **Raising `max_rounds` requires naming what the next round would *learn*.** Can't name it → escalate or close; not one more round.

## 3. Verdict
Lane outcomes in this step:
- Blocking `kind: defect` items stay in `open_issues` and send the node to `grovespec-fix`.
- `kind: contract-gap` and `kind: concern` belong in `followups`; they do not keep a result gate open.
- A clean pass may still carry `followups`; surface them to the human and keep them visible for later revise/verify, but do not hold `done` on them.

- **Issues remain** → `status: reviewed` with `open_issues`; next is **`grovespec-fix`** (it applies them → `fixed` → re-run `grovespec-review`). review does **not** fix — the diff stays the cold reviewers' subject, and fixing needs no independence (cold already gave that). **This is the whole verdict for confirmed defects, in auto mode too** — never `escalated`, which says only that `max_rounds` ran out (`validate` refuses that word inside the budget). A judge that keeps five findings has produced a normal fix queue, not a question for the human.
- **Clean terminal pass** (tests green + the cycle closed: ledger exhausted at find, confirmed list empty or closed, last confirmation clean) → **seal it**: `grovespec pin TASK-N` (reviewed commit + spec digest, verdict pending); then run **`grovespec validate`** (must pass — a format/evidence violation blocks `done`) and **`grovespec fresh`**; show the human the result + test summary + any fresh signals; on **confirm** run **`grovespec approve TASK-N --human`** — it re-verifies the seal against the current bytes and flips `status: done` itself; **never hand-edit the status**. The surviving `adjudications` stay in `<id>.review.yaml` — `reopen` preserves them across cycles, so a later cycle's cold rounds read them there instead of re-litigating. **Don't copy them into the Change Log**: the reviewers' criteria come from the Task file, and a Change Log carrying verdicts breaks the blankness it feeds.

**Commit the gate as `review TASK-N: <summary>`** — the Task file's status flip *and* the evidence: `<id>.review.yaml`, this cycle's round files, `<id>.test.log`. An **escalate** stop commits the same way (`review TASK-N: escalated — …`): an escalated record is exactly the evidence a human ruling will read, and `validate`'s untracked notice only watches *passed* records — nothing else would name it. Step name first, so the gate commit stays out of the code cycle's `^TASK-N: ` anchor (`FORMATS.md` "Commits"). This is the exact spot where a result record was left untracked for a whole run — `validate` names it until it is in.

## When it's done
On `done`: the node's tests pass, its diff is cold-reviewed clean, the human confirmed. A `done` skeleton's children can now be grown (`grovespec-grow`); a `done` leaf ends its branch.

> **Open and close in the step-report shape** (`FORMATS.md` "The step report" — fixed `starting` opening; `Result · Open · Your turn · Next` closing, warm full sentences). Here, *Open / Your turn* typically carry: open issues · an escalation · fresh signals · unverified NFR targets.

> **Recommend a new session for the next node** (`grovespec-grow` the next sketch). Each node starts fresh — clean, bounded context is what keeps GroveSpec's cost flat as the tree grows (WORKFLOW §5). *(Driving with `grovespec next` in a loop? `@new` already starts that session — this recommendation is for a person going step by step, and it is never a reason to end the loop.)*
