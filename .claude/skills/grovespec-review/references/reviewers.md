# reviewers — the cold-review engine (shared by verify + review)

> `grovespec-verify` (spec) and `grovespec-review` (code) both load this to run a round. The SKILLs hold the *rules* (levels, pass conditions); this holds the *mechanics + the bar + the lenses*, so every node's review comes out the same shape. The two callers differ in lens set, read-scope, and (verify) the checklist.
> Reviewers write findings in the project's language (`config.language`).

## THE BAR — read first. *Sufficient*, not exhaustive.
You review for a **competent implementer/consumer** who will research, make reasonable decisions, follow the project's conventions, and ask only when *truly* stuck. So:

- A finding is a real flaw **only if that implementer would be blocked or build the wrong thing.** "I can imagine an unhandled edge / an unspecified detail" is **not** a flaw if a competent implementer would reasonably handle or decide it.
- Yes, go in adversarially ("try to break it") — **but a kept finding must name *who is blocked, and on what decision*.** *What is merely unstated* is not enough.
- You are checking for **sufficient** context, not exhaustive detail. Perfect specs don't exist; "enough to build the right thing without a mess" is the target. (This is the single rule that stops a review from churning for rounds.)

## SCOPE — what a spec may and may not contain
- A spec states the **contract** — what it *takes · gives · guarantees* (the behavior other nodes rely on). It does **not** state the **mechanism** — atomicity, transactions, concurrency handling, entity schemas, API/response shapes, algorithms. Those belong to the node's own *implementation* or to a *child*.
- A **skeleton**'s spec states only: its child pieces (by role), the boundaries between them, and the **cross-cutting invariants** all children must respect — and **defers the rest to named children**.
- **An unspecified mechanism, an edge a child owns, or an explicitly deferred detail is NOT a gap — do not raise it.** A spec line like `[→ child/deferred: …]` is *correct delegation*, not a hole. Demanding such detail is over-reach; the triage will drop it, so don't raise it in the first place.

## Which lens set · scale · read-scope · do-not-raise
- **verify** (`target_type: spec`) — the **spec lenses** + the **verify checklist** (below); count from `config.yaml` `verify.scale`. Read: the draft Task + the parent's Contract + the relevant `conventions.md`. (Not every sibling — only what the contract references.)
- **review** (`target_type: result`) — the **code lenses**; count from `config.yaml` `review.scale`. Read **ONLY this node's changed files (its diff) + its AC·Contract + the test results** — never the wider codebase. (This bound keeps review's cost flat as the project grows.)
- **do-not-raise**: the caller passes the *settled categories* condensed from the state file's `adjudications` (out-of-scope boundaries + accepted gaps — e.g. "concurrency mechanism · entity schemas · auth rules · timezone/month · API error shapes = child/impl scope"). **Do not re-raise anything in those categories** — already decided.
- **Model (optional)**: each reviewer's model = `config[verify|review].models[<lens>]` if set, else `models.default`, else **inherit the session model** (the default — no forced cost). Triage uses `models.triage` (same fallback).

## Spawning
- Spawn the reviewers as **parallel subagents** (Claude Code's Task tool), one per lens — **count from `config.yaml`** (`verify.scale[level].reviewers` / `review.scale[level].reviewers`; the SSoT — don't hardcode here). Each starts from an **empty context** (that's what makes them cold). One batch, concurrent. (Main session only — see each skill's invocation contract.)
- For `skip`: spawn none; the caller self-checks against the checklist.
- Each reviewer's prompt = **common preamble** (incl. THE BAR + SCOPE + the do-not-raise list) + its **role lens** + the **findings format**. Never give them how the target was built, or a prior round's discussion.

## Findings format + severity (name the victim)
One finding per line:
```
- [critical|should-fix|nice-to-have] <C# / where: §section · file:line> — <who is blocked + the exact decision they can't make>
```
- `critical` — a **named** consumer/child **cannot build its part** (the contract is missing or self-contradictory on something *this node owns*). **If you can't name the consumer AND the blocked decision, it is not critical.**
- `should-fix` — buildable, but a *normal, in-scope* point is ambiguous enough that **two consumers would integrate it differently**. (Whether should-fix forces another round is the caller's `strength` — default `2` = yes. Severity here is honest; blocking is the skill's call.)
- `nice-to-have` — wording/clarity only.

A finding with no named victim + decision ("this seems unclear", "what about X edge?") is a **non-finding** — drop it before triage. If a lens finds nothing, it returns `none` with a one-line note on what it checked. The reviewer's final message **is** the result — no greeting.

Examples:
- ✅ `- [critical] C2 §Contract — the *stats* child can't tell from this contract whether month totals are per-calendar-month or rolling-30d; it owns that and would guess.` *(named victim + decision)*
- ✅ `- [critical] C1 — "invite" and "group" children both appear to own invite-code validity → overlap; neither can own it cleanly.`
- ❌ `- [should-fix] concurrency: what if two users disband at once?` *(mechanism / child-owned → out of scope, do not raise)*
- ❌ `the contract is a bit long` *(no victim/decision)*

## Common preamble (prepend to every role)
```
You are a *cold* reviewer in a GroveSpec project. You did NOT see how this was built —
only the target + criteria. Review for a COMPETENT implementer (researches, decides, follows
conventions, asks only when truly stuck): a flaw is real only if such a person would be
BLOCKED or build the WRONG thing — name who, and on what decision. An unspecified mechanism,
a child-owned edge, or an explicitly deferred detail is NOT a flaw.

Target: {target}  (spec = the draft Task | result = this node's code diff)
Criteria: {spec → parent Contract + the clause this node fills ; code → this node's AC + Contract + test results}
You may read: {spec → the draft + parent Task + relevant conventions ; code → only this node's changed files + AC·Contract + test results}
Do NOT raise (already settled / out of scope): {the do-not-raise categories}
Write findings in {config.language}.

<then the findings format, then the role lens below>
```

## verify — the checklist the lenses fill (don't hunt open-endedly)
A spec passes when this finite list is satisfied — NOT when "no reviewer can imagine an edge." Each lens fills its checks and marks **PASS / PARTIAL / FAIL**; the round's verdict is the table.

**For a `skeleton`:**
- **C1 Decomposition coverage** — do the named children's roles *sum to* the brief/parent scope: no gap, no overlap? *(coherence)*
- **C2 Buildability** — could each named child/consumer build its part from this contract alone? *(consumer-impersonator)*
- **C3 Boundaries & invariants** — are the child boundaries + the cross-cutting invariants all children must respect stated? A *deferred* edge is fine. *(gap-finder, at THE BAR)*
- **C4 Scope discipline** — is mechanism/child-detail deferred (markers), not pinned? **An over-stuffed contract FAILs here** (too detailed for a skeleton → delegate). *(breaker — hunt unbuildable holes AND over-reach)*
- **C5 AC testable** — is each AC measurable/verifiable (NFR as a checkable item)?
- **C6 Confirmable at a glance** — readable in one pass; if a skeleton's Contract is a dense wall, it's over-specified → FAIL. *(non-expert)*

**For a `feature` (leaf):** C1 becomes **"does the contract + AC cover this node's own behavior?"** and edges matter *more* (a leaf is where behavior is pinned, not deferred) — still at THE BAR. C4 inverts to "is anything here actually a child's job?" (rare for a leaf).

## Role lenses — verify (spec) — fixed order, first *N* = `verify.scale[level].reviewers`
- **consumer-impersonator** (C2) — *you are a node that will use this contract.* Try to write your code against it alone. A hole = a spot where you'd be *blocked* (can't pick a return shape / don't know who outputs what), not a spot you'd reasonably decide.
- **gap-finder** (C3) — walk the standard edges (empty · not-found · failure · none-set). Flag one **only if** the contract leaves a competent implementer unable to proceed on an *in-scope* case. A child-owned or deferred edge is not a gap.
- **coherence** (C1) — check against global rules + parent/sibling contracts. **(up)** does this node fill the clause its parent assigned it? **(down)** if a skeleton, do its children's roles cover it cleanly (no gap/overlap)? — judged from the contract; the children needn't exist yet.
- **non-expert** (C6) — you don't know the jargon; the spec must be confirmable at a glance. Fail undefined terms, fluff, a dense wall, the same concept under two names. Quote the line.
- **breaker** (C4) — you came to break the contract *and* to catch over-specification. A break counts only if a named consumer is blocked; flag any mechanism/child-detail that's been pinned into the contract (it should be deferred).

## Role lenses — review (code) — fixed order, first *N* = `review.scale[level].reviewers`
Each reads **only this node's diff + AC·Contract + test results**.
- **correctness** — does the diff meet the AC·Contract? Logic errors, off-by-one, wrong branch, broken invariant.
- **security** — injection, auth/authz gaps, secrets, unsafe defaults/deserialization/path handling — in this diff.
- **the-6-month-maintainer** — hidden coupling, surprises, and **duplication of code that already exists** (Principle 3 — did this reimplement something?).
- **breaker** — edge·failure inputs the running code mishandles. Same BAR: name the input → wrong behavior.
- **test-quality** — are the tests *real* (exercise the path) or hollow/tautological? Every AC item backed by a passing test? A green-but-empty suite is a `should-fix` (or `critical` if it masks a failing AC).

## Aggregate
Merge findings; dedupe by (where + what). On a severity clash, take the higher.

## Over-strictness triage — `full` (and optionally `standard`)
One more cold reviewer (the *defender*) rules each finding KEEP / DOWNGRADE / DROP. **Drop, before scoring:** anything asking for mechanism or child-owned detail (out of scope by the SCOPE rule); anything failing the *name-the-victim* test; anything a competent implementer would reasonably decide; anything in the do-not-raise categories; duplicates. **Keep** only: a named consumer blocked (critical) or a real in-scope ambiguity two consumers would split on (should-fix). Returns the confirmed list + the do-not-raise additions.

## Round hand-off
Write `.grovespec/review/<id>.verify.yaml` (verify) or `<id>.review.yaml` (review) — template `review-state.yaml`: the round's verdict (the C# table for verify) + confirmed `open_issues` + append the triage's drops to `adjudications` (and **condense them into the do-not-raise categories** passed to the next round). The next round is a new cold session reading only this file. On approve/done the caller copies surviving adjudications into the node's Change Log.
