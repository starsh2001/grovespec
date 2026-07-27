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
- **verify-tree** (`target_type: tree`) — the **decomposition lenses** + the **D1–D5 checklist** (below); runs **once at init** on the whole **sketch tree** (and again after a structural `revise`), before the per-node build. Count from `config.yaml` `verify.scale`. Read: the whole sketch tree (`tree.md` + every sketch Task — *cheap, one-liners*) + the brief + the ref detailed spec — on a post-`revise` re-verify of a *built* tree, read each Task's **id·name·Overview line only** (not full contracts), keeping the same economy. **This whole-tree review is affordable *because* sketches are one-liners** — a reviewer holds the entire decomposition in one context, which the old root-only / full-draft models couldn't.
- **verify** (`target_type: spec`) — the **spec lenses** + the **verify checklist** (below); count from `config.yaml` `verify.scale`. Read: the draft Task + the parent's Contract + the relevant `conventions.md`. (Not every sibling — only what the contract references.)
- **review** (`target_type: result`) — the **code lenses**; count from `config.yaml` `review.scale`. Read **ONLY this node's changed files (its diff) + its AC·Contract + the test results** — never the wider codebase. (This bound keeps review's cost flat as the project grows.)
- **do-not-raise**: the caller passes the *settled categories* condensed from the state file's `adjudications` (out-of-scope boundaries + accepted gaps — e.g. "concurrency mechanism · entity schemas · auth rules · timezone/month · API error shapes = child/impl scope"). **Do not re-raise anything in those categories** — already decided.
- **Model (optional)**: each reviewer's model = `config[verify|review].models[<lens>]` if set, else `models.default`, else **inherit the session model** (the default — no forced cost). Triage uses `models.triage` (same fallback).

## Spawning
- Spawn the reviewers as **parallel subagents** (Claude Code's Task tool) — **count from `config.yaml`** (`verify.scale[level].reviewers` / `review.scale[level].reviewers`; the SSoT — don't hardcode here). *Which* lenses spawn at that count — and which checks each carries — comes from the **check-assignment table** below (verify/verify-tree) or the fixed order (review/code). Each starts from an **empty context** (that's what makes them cold). One batch, concurrent. (Main session only — see each skill's invocation contract.)
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
- ✅ `- [critical] C1 — the rules use *hire-date* (leave→accrual) and *team·rank* (approval→routing), but no child or foundation owns an employee master that creates them → prerequisite gap the source doc assumed.` *(noun the rules lean on, no owner)*
- ✅ `- [critical] D2 — no node owns *system settings*: core-time hours·rate multipliers·thresholds are regulation values that must be admin-editable, not hardcoded; a rules-driven system needs a settings store the source doc never mentions.` *(infra the domain doc omits)*
- ✅ `- [should-fix] D5 — "approval" is one flat sketch, but routing is org-chart-derived + rank-constrained (the approver must outrank the requester) → it hides a subtree; split it before building, not mid-build.` *(one-liner flattening real complexity)*
- ❌ `- [should-fix] concurrency: what if two users disband at once?` *(mechanism / child-owned → out of scope, do not raise)*
- ❌ `the contract is a bit long` *(no victim/decision)*

## Common preamble (prepend to every role)
```
You are a *cold* reviewer in a GroveSpec project. You did NOT see how this was built —
only the target + criteria. Review for a COMPETENT implementer (researches, decides, follows
conventions, asks only when truly stuck): a flaw is real only if such a person would be
BLOCKED or build the WRONG thing — name who, and on what decision. An unspecified mechanism,
a child-owned edge, or an explicitly deferred detail is NOT a flaw.

Target: {target}  (tree = the whole sketch tree | spec = the draft Task | result = this node's code diff)
Criteria: {tree → the brief + the ref detailed spec (the scope·intent the tree must cover) ; spec → parent Contract + the clause this node fills ; code → this node's AC + Contract + test results}
You may read: {tree → the whole sketch tree + brief + ref spec ; spec → the draft + parent Task + relevant conventions ; code → only this node's changed files + AC·Contract + test results}
Do NOT raise (already settled / out of scope): {the do-not-raise categories}
Write findings in {config.language}.

<then the findings format, then the role lens below>
```

## verify — the checklist the lenses fill (don't hunt open-endedly)
A spec passes when this finite list is **affirmatively satisfied** — NOT when "no reviewer can imagine an edge," and **NOT when a reviewer merely 'found nothing'.** Each lens marks **PASS / PARTIAL / FAIL** *with the evidence that earned it*: a bare "looks fine" is **not** a PASS — that's exactly how a rubber-stamp waves an *under*-specified spec through (the failure GroveSpec exists to stop). **An unshown check is PARTIAL, never PASS.** The round's verdict is the table.

**For a `skeleton`:**
- **C1 Decomposition coverage — mechanical, *paste the map*** — enumerate the brief/parent scope items and map each to **exactly one** child role: **0 unmapped (gap), 0 double-owned (overlap)**. And the *reverse*: every Contract clause must trace back to a brief scope item — **a clause outside the brief's Does/Doesn't is scope-creep → flag it** (cut it, or revise the brief; the brief is the scope SSoT). Assert nothing; show the mapping. *(coherence)*
  - **Actor & prerequisite closure — map the *nouns the rules lean on*, not just the scope items.** List every actor the spec names (employee · manager · admin …) and every entity/attribute its rules depend on (hire-date · team · rank · auth identity …); each MUST be *owned* by some child or the foundation. A noun the rules use but **no node creates/owns** is a gap — the source doc assumed it, the tree forgot it. Show the noun→owner table. *(coherence)*
  - **Own structural deliverable — the skeleton must build *something itself*, not only delegate.** Check the AC/Subtasks (not the Contract): does *this* node build the glue/shell its children slot into? For the **root**, that is the **base environment + an empty runnable shell** (smoke-testable — boots / blank page / CLI runs). A **pure-delegation skeleton** — AC/Subtasks are only "grow child X", so `implement` would build nothing — is a **FAIL**; name it. (This is about the *deliverable*, not the Contract — the Contract still stays lean/deferred per C4; the two don't conflict.) *(coherence)*
- **C2 Buildability — show it** — name a consumer/child and *sketch building its part* from this contract alone; the only hole is a spot you'd be **blocked** (not one you'd reasonably decide). *(consumer-impersonator)*
- **C3 Boundaries & invariants** — are the child boundaries + the cross-cutting invariants all children must respect stated? A *deferred* edge is fine. *(gap-finder, at THE BAR)*
- **C4 Scope discipline** — is mechanism/child-detail deferred (markers), not pinned? **An over-stuffed contract FAILs here** (too detailed for a skeleton → delegate). *(breaker — hunt unbuildable holes AND over-reach)*
- **C5 AC testable** — is each AC measurable/verifiable (NFR as a checkable item)? *(gap-finder)*
- **C6 Confirmable at a glance** — readable in one pass; if a skeleton's Contract is a dense wall, it's over-specified → FAIL. *(non-expert)*

**For a `feature` (leaf)** — same numbers, leaf phrasing (a leaf *pins* behavior; its deferral tolerance is lower than a skeleton's):
- **C1 Own-behavior coverage — paste the map** — map the parent-contract clause this node fills + its Requirements onto its Contract·AC: every behavior this node owns appears once, nothing double-owned with a sibling. Actor/prerequisite closure: every entity the rules lean on is a **declared input/dependency** (owned by a sibling·ancestor·foundation), not silently assumed — a leaned-on noun with no owner is a gap. *(coherence)*
- **C2 Buildability — show it** — sketch building the leaf from the contract alone; a hole is only a spot you'd be *blocked*. *(consumer-impersonator)*
- **C3 Edges pinned** — empty · not-found · failure · none-set are answered *here* unless explicitly deferred to implement with a marker — a leaf is where behavior is pinned, so unmarked silence weighs heavier than in a skeleton. Still at THE BAR. *(gap-finder)*
- **C4 Scope discipline, inverted** — is anything here actually a parent's/sibling's job? (Rare for a leaf.) *(breaker)*
- **C5 AC testable** — as for a skeleton. *(gap-finder)*
- **C6 Confirmable at a glance** — as for a skeleton. *(non-expert)*

## verify-tree — the decomposition checklist (D1–D5)
Runs **once at init**, on the whole **sketch tree**, before any node is built — the cold gate on the *decomposition itself* (the one expensive-to-reverse decision that otherwise gets only a human glance — the rubber-stamp GroveSpec exists to stop, applied to its own structure). Same rule as the spec checklist: each lens marks **PASS / PARTIAL / FAIL** *with shown evidence*; an unshown check is PARTIAL, never PASS. Bounded because sketches are one-liners (a reviewer holds the whole tree at once).

- **D1 Scope coverage — paste the map** — every brief/spec scope item maps to ≥1 node, and every node traces back to a scope item: **0 uncovered, 0 scope-creep**. (C1, at tree scale.) *(coverage-mapper)*
- **D2 System completeness — the scaffolding the domain doc omits** — a real multi-user / rules-driven system almost always needs infrastructure the *source doc never mentions* (the doc describes the *domain*, not the *system*): **settings/configuration · admin & role management · audit log · org & user management · authentication · notification delivery**. For each: is it needed here, and is there a node for it? A needed-but-absent one is a gap — and the source doc *won't* list it, which is exactly why domain-coverage (D1) misses it and this lens exists. *(system-architect)*
- **D3 Prerequisite & actor closure — tree-wide** — every actor the system names + every entity/attribute its rules lean on (hire-date · team · rank · auth identity) is *owned* by some node. (C1's actor-closure, across the whole tree.) Show the noun→owner table. *(coverage-mapper)*
- **D4 Boundaries & shared-state ownership** — node responsibilities split cleanly (no two nodes own the same thing); each piece of *mutable shared state* (a balance ledger · the audit log · the calendar · the settings store) has exactly one owning node. *(boundary-checker)*
- **D5 Depth sanity — a one-liner hiding a subtree** — does any sketch *flatten real complexity* that should be its own decomposition? An approval *routing* that's actually org-chart-derived + rank-constrained; a *calculation engine* with overlapping rate rules. Name the node **and** the complexity it under-models, so grow splits it instead of discovering it mid-build. *(depth-breaker)*

(Readability is the **non-expert** lens: the decomposition must be confirmable by a human at a glance — flag undefined/duplicate node names, a tangle, or two nodes that are really one.)

## Check assignment by level — every check always has a cold owner (verify & verify-tree)
The scale level sets the reviewer *count*; it must never shrink the checklist's *coverage* — an unowned check would sit PARTIAL forever and block every round (or invite passing by not looking). So at lower levels a lens **absorbs** neighbouring checks: fewer reviewers, more checks each. An absorbing reviewer applies the absorbed check's criteria *as written in the checklist* (the tag there names its home lens). `models[<lens>]` keys keep working — only spawned lenses are looked up.

**verify (spec) — C1–C6:**
| level | reviewers → checks |
|---|---|
| light (2) | consumer-impersonator (C2·C3·C5) · coherence (C1·C4·C6) |
| standard (3) | consumer-impersonator (C2·C4) · gap-finder (C3·C5) · coherence (C1·C6) |
| full (5) | consumer-impersonator (C2) · gap-finder (C3·C5) · coherence (C1) · non-expert (C6) · breaker (C4) |

**verify-tree (decomposition) — D1–D5 + readability:**
| level | reviewers → checks |
|---|---|
| light (2) | coverage-mapper (D1·D3·D4) · system-architect (D2·D5·readability) |
| standard (3) | coverage-mapper (D1·D3) · system-architect (D2·D5) · boundary-checker (D4·readability) |
| full (5) | coverage-mapper (D1·D3) · system-architect (D2) · boundary-checker (D4) · depth-breaker (D5) · non-expert (readability) |

(review/code has no checklist table — its lenses spawn in fixed order, first *N*; its pass judgment is findings-based.)

## Role lenses — verify (spec) — spawned per the check-assignment table
- **consumer-impersonator** (C2) — *you are a node that will use this contract.* Try to write your code against it alone. A hole = a spot where you'd be *blocked* (can't pick a return shape / don't know who outputs what), not a spot you'd reasonably decide.
- **gap-finder** (C3) — walk the standard edges (empty · not-found · failure · none-set). Flag one **only if** the contract leaves a competent implementer unable to proceed on an *in-scope* case. A child-owned or deferred edge is not a gap.
- **coherence** (C1) — check against global rules + parent/sibling contracts. **(up)** does this node fill the clause its parent assigned it? **(down)** if a skeleton, do its children's roles cover it cleanly (no gap/overlap), **and does every actor/entity the rules lean on (hire-date · team · auth identity) have an owning node**? — judged from the contract; the children are only sketches (their contracts aren't written yet), so check the decomposition, not their detail.
- **non-expert** (C6) — you don't know the jargon; the spec must be confirmable at a glance. Fail undefined terms, fluff, a dense wall, the same concept under two names. Quote the line.
- **breaker** (C4) — you came to break the contract *and* to catch over-specification. A break counts only if a named consumer is blocked; flag any mechanism/child-detail that's been pinned into the contract (it should be deferred).

## Role lenses — verify-tree (decomposition) — spawned per the check-assignment table
Each reads **the whole sketch tree + brief + ref spec** (cheap — sketches are one-liners).
- **coverage-mapper** (D1, D3) — paste two maps: brief/spec scope → node (0 gap/overlap), and actor/entity-the-rules-lean-on → owning node. A blank cell in either is the finding.
- **system-architect** (D2) — *you are deploying this for real.* What scaffolding does a live multi-user system need that the domain doc never mentions — settings, admin/roles, audit, org/user mgmt, auth, notifications? Name each one that's needed but has no node.
- **boundary-checker** (D4) — two nodes that own the same thing (overlap), or a mutable shared state with no single owner. Name the collision.
- **depth-breaker** (D5) — a one-line sketch that hides a real subtree. Name the node + the complexity it flattens (routing rules, calc overlaps, multi-step workflows), so grow splits it instead of discovering it mid-build.
- **non-expert** — the tree must be confirmable at a glance: undefined/duplicated names, a tangle, the same concept as two nodes. Quote the node.

## Role lenses — review (code) — fixed order, first *N* = `review.scale[level].reviewers`
Each reads **only this node's diff + AC·Contract + test results**.
- **correctness** — does the diff meet the AC·Contract? Logic errors, off-by-one, wrong branch, broken invariant.
- **security** — injection, auth/authz gaps, secrets, unsafe defaults/deserialization/path handling — in this diff.
- **the-6-month-maintainer** — hidden coupling, surprises, and **duplication of code that already exists** (Principle 3 — did this reimplement something?).
- **breaker** — edge·failure inputs the running code mishandles. Same BAR: name the input → wrong behavior.
  > **What the code lenses can't see:** aesthetics · design direction · look-and-feel — the diff carries no rendered output, so these are **human-confirm only** (implement's reversibility gate handles them up front; review does not re-check). And **security sees only this node's diff**: an exploit living in the *interaction* with unchanged code (a misused existing sanitizer, a bypassed existing check) is outside its read-scope — that bound is the deliberate cost trade; contract-level security invariants belong in `conventions.md` and are probed at *verify*.
- **test-quality** — are the tests *real* (exercise the path) or hollow/tautological? Every AC item backed by a passing test? A green-but-empty suite is a `should-fix` (or `critical` if it masks a failing AC).

## Aggregate
Merge findings; dedupe by (where + what). On a severity clash, take the higher.

## Over-strictness triage — `full` (and optionally `standard`)
One more cold reviewer (the *defender*) rules each finding KEEP / DOWNGRADE / DROP. **Drop, before scoring:** anything asking for mechanism or child-owned detail (out of scope by the SCOPE rule); anything failing the *name-the-victim* test; anything a competent implementer would reasonably decide; anything in the do-not-raise categories; duplicates. **Keep** only: a named consumer blocked (critical) or a real in-scope ambiguity two consumers would split on (should-fix). Returns the confirmed list + the do-not-raise additions.

## Round hand-off
Write `.grovespec/review/<id>.verify.yaml` (verify), `<id>.review.yaml` (review), or `tree.verify.yaml` (verify-tree) — template `review-state.yaml`: the round's verdict (the C#/D# table) + confirmed `open_issues` + append the triage's drops to `adjudications` (and **condense them into the do-not-raise categories** passed to the next round). The next round is a new cold session reading only this file. On approve/done the caller copies surviving adjudications into the node's Change Log. (For the tree, adjudications stay in `tree.verify.yaml` — brief.md has no Change Log section; a later structural re-verify reads them from the state file.)
