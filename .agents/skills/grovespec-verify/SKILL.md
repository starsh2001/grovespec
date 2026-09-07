---
name: grovespec-verify
description: GroveSpec spec verification — a cold multi-persona check, before any code. Two scales, same engine: a node's *draft spec* (contract·decomposition → draft becomes approved), and the *whole tree* — which asks one of two questions by the tree's state: a sketch tree gets the decomposition gate (plan #0 / after a structural change: anything missing, mis-bounded, hiding a subtree?), a pristine mapped brownfield tree gets the survey fidelity gate (is the map an accurate photograph of the code?). Fresh-eyes reviewers inspect in parallel with different roles; issues are fixed; a clean pass + human approval clears it. Use when the user wants to "verify this spec / check the draft / verify the tree / check the decomposition / check the survey / approve this node / grovespec verify", or right after grow detailed a sketch, or right after plan laid out the tree, or right after a brownfield init mapped it. For reviewing *code* use grovespec-review.
---

# grovespec-verify

Cold verification of a node's **draft spec** — the step that turns `draft` → `approved`. (Reviewing *code* is `grovespec-review`.)

The leverage: spend the multi-persona scrutiny *here*, on the spec, before any code exists. A contract or decomposition error caught now costs nothing; caught after building, it costs the build. **This is the one place the cold persona review lives for a spec** — code review (`grovespec-review`) does *not* re-ask spec questions.

## Two scales: the node, and the whole tree
verify is the cold gate at **two scales**, same engine (`reviewers.md`), different target:
- **`spec` — one node's draft** (the common case): `grow` detailed a sketch into a draft contract; verify cold-checks it (**C1–C6**) → `draft` → `approved`. Everything below is written for this.
- **`tree` — the whole tree** (at plan #0, after a structural `plan`/`revise`, and once per brownfield adoption): **two questions share the target**, picked by the tree's state (`grovespec next` names which). A **sketch tree** gets the *decomposition* question (**D1–D5**) — *is anything missing · mis-bounded · hiding a subtree?* — before any node is built. A **pristine mapped (brownfield) tree** gets the *fidelity* question (**F1–F4**) — *is the survey an accurate photograph of the code?* — criteria = the code itself, before any node work.
  - It catches what the producing agent and a human glance miss: system scaffolding the domain doc never mentions (settings·admin·audit·org-mgmt), a naively-flat feature, an actor nobody owns.
  - Affordable **because sketches are one-liners** — the reviewer holds the whole tree in one context.
  - Clean pass + human approval → the tree is cleared and the per-node build begins.

The mechanics below (cold subagents, THE BAR, fix loop, triage, strength) are **identical** for both scales; only the **lens set + checklist** differ (spec → C1–C6 spec lenses; tree → D1–D5 decomposition lenses), both in `reviewers.md`.

> **THE BAR — *sufficient*, not exhaustive.** A flaw is real only if a **competent implementer/child** would be **blocked or build the wrong thing** — *name who, and on what decision*. **It cuts both ways:** a check PASSes only when a reviewer *shows* it holds — "found nothing" is **not** a pass. *Lenient on imagined edges; strict on shown sufficiency.* Both directions are needed here — both live in step 2 (judge). **The SSoT for both is `reviewers.md` — §THE BAR (full text) and §SCOPE (what a spec may and may not contain, incl. what a skeleton defers). Load them; don't restate them here.**

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `node .grovespec/bin/grovespec.mjs lang`) and write **every** reply in that language (the cold reviewers' findings too). These files are English; your output is not.

## Why cold · several · different
An open-ended "just review it" gets rubber-stamped, and exhaustive flaw-hunting never converges. So we stack: ① cold reviewers (didn't see how it was written), ② *different* roles **and different search strategies** (the ledger), ③ *several* in parallel, ④ each **filling a bounded checklist at THE BAR** (not open hunting), ⑤ ONE triage over everything found, ⑥ fixes confirmed against their own diff — then a human approves. What ends each phase is a **list** (the ledger emptied · the issues closed), never a verdict streak.

## What it takes in — auto-routing
When invoked *without an explicit target*, **decide tree-vs-spec automatically**:
1. Check: is a **tree gate armed** — `sketch` nodes with no passed `tree.verify.yaml` (→ the *decomposition* question), or a pristine mapped tree straight from a brownfield init (→ the *fidelity* question)? `grovespec next` names which. → **`tree` mode**, with the matching checklist (D1–D5 / F1–F4).
2. Otherwise → **`spec` mode**: run `grovespec check` and take an unblocked `draft` node (lowest id if several).
3. An explicit target overrides: `verify TASK-N` → spec; `verify tree` → tree.

- **`spec` — the node** (`target_type: spec`). Criteria: the parent's **Contract** + the decomposition clause this node must fill + **the ref intent clauses this node covers** (`ref/index.md`) + `conventions.md`.
- **`tree` — the whole sketch tree** (`target_type: tree`). Criteria: the **brief** + the **ref detailed spec** (the scope·intent the tree must cover).
- `strength`·`max_rounds`·`scale` from `.grovespec/config.yaml` `verify:` (the tree review reuses these — for a big tree, round the level **up**).

> **Where it runs (the invocation contract).** Run grovespec-verify in your **main agent session** — it spawns the cold reviewers as **subagents**. **Never run a grovespec skill *as* a subagent** — then it can't spawn reviewers and silently degrades to a non-cold self-check, defeating the point.

## State
Spec/tree verify files also use the lane fields now:
- `open_issues` may hold `kind: defect` or `kind: contract-gap`; `kind: concern` belongs in `followups`.
- Every open finding needs `kind` + `family` as well as the gate fields, and the same `family` may appear only once across `open_issues` + `followups`.
- If the flaw is in the text under review right now, keep it as `kind: defect` even when the eventual repair also needs later revise/verify work elsewhere.

`.grovespec/review/<id>.verify.yaml` for a node (`target_type: spec`), or `.grovespec/review/tree.verify.yaml` for the decomposition (`target_type: tree`). Template `review-state.yaml`. Round 1 creates it; later rounds update it in place; re-running reuses it so rounds accumulate. (Code review keeps a **separate** `<id>.review.yaml`; they never collide.)

## Depth scales with reach
verify picks the level from checkable inputs — ① did the contract change ② consumer count ③ is it a skeleton. The reviewer **counts·repeat** live in `config.yaml` `verify.scale` (the SSoT — never restate a number here). When ambiguous, round **up** (a too-light verify lets drift through; a too-heavy one costs a little).

| level | when | review |
|---|---|---|
| `skip` | trivial spec edit (format·comment) | self-check only, no reviewers |
| `light` | small, contract unchanged | cold reviewers (count·repeat from `verify.scale`) |
| `standard` | a normal new node | cold reviewers, + over-strictness check |
| `full` | contract changed / 3+ consumers / a skeleton | cold reviewers, + over-strictness check |

`skip` collapses the cycle, it doesn't skip the record: the caller self-checks against the checklist, writes the state file itself (one `rounds[]` self entry; `found`/`strategies` may stay empty), and pin/validate/approve run as usual.

## The cycle — find → judge → fix
> Spawn mechanics, the reviewer prompts, **THE BAR + the SCOPE rule**, the findings format, the **checklist (C1–C6 for a node · D1–D5 for the tree)**, **§The cycle + §The strategy ledger**, and the triage all live in the sibling `../grovespec-review/references/reviewers.md` — load it and use the **spec lens set** (`spec`) or the **decomposition lens set** (`tree`).

1. **find — cold waves over the frozen draft.** Nothing is fixed between waves, so every wave reads the same bytes. Spawn a wave of cold reviewers in parallel (subagents, empty context), as many as the level sets — for `spec`, the spec lenses; for **`tree`**, the decomposition lenses filling **D1–D5**. Which lenses spawn comes from `reviewers.md`'s **check-assignment table**, whose invariant is that every check still has exactly one cold owner.
   - **Give each**: the target + criteria, **THE BAR**, the **checklist to fill**, the **do-not-raise list** (settled categories from `adjudications`), the **found list**, and the **strategy ledger**.
   - **Never give**: how it was built, any author reasoning, or a clean-claim ("this part is verified").
   - **Aggregate** each wave into the C#/D# table and the found list — no verdicts, no fixes yet. **Evidence accumulates**: a check shown in an earlier wave stays shown (the bytes didn't move); later waves work what's still PARTIAL and the ledger strategies not yet run.
   - **Close find** when the checklist is fully *worked* (every evidence-capable check shown or FAILed into a finding — for `spec`/`tree` the checklist **is** the ledger) **and at least `repeat` waves have run**.
2. **judge — once, over everything.** Run the **over-strictness triage** on the whole found list in one pass — drop the out-of-scope/no-victim/settled, set lanes + gate fields on every keep, and let **`grovespec validate`** recompute the severities (run it before judging). `(gap)` rulings with the human happen here. Judgment by `strength` (1: no `critical` · 2: +`should-fix` · 3: +`nice-to-have`; default 2).
   - **Non-blocking floor**: surviving findings all deferred / out-of-scope / nice → **PASS**, *provided every evidence-capable check (C1–C5 · D · F) is affirmatively shown*. **C6 blocks only on FAIL** (`reviewers.md` §checklist — PARTIAL counts as PASS there); an unshown evidence-capable check still blocks like a should-fix, so you can't pass by *not looking*.
   - **Empty `open_issues` AND every evidence-capable check still affirmatively shown → the cycle passes now**: seal it (step 5) — no extra confirmation lap. If a check's only *worked* status was a FAIL the judge then dropped, that check reverts to PARTIAL — **reopen find for it** instead of passing: an empty list earned by dropping the evidence is not a pass.
3. **fix — the cut-first step, then confirm.** Apply the confirmed findings; this step's default is *subtract*.
   - **Prefer DEFER/CUT over ADD.** For an unspecified detail, add a **deferral marker `[→ child/deferred: …]` or cut** — not a new clause. Add a clause *only* for a genuine in-scope structural gap (C1–C3).
   - **A skeleton Contract that grew this round is a smell** — the root should get *leaner*, not more detailed (over-specification is itself a C4/C6 FAIL).
   - **Never let a spec grow a rule about how its own AC must be written.** A coverage rule ("measure every branch · at every spot") is a *generator*: it multiplies out and every later round finds new empty cells. If this round's fix is *widening* such a rule, that is the smell — bound it instead (`reviewers.md` C5 **Stop rule**), and leave killing wrong implementations to implement/review, which read real code.
   - **`(gap)` AC items** (spec-silent spots grow marked — `FORMATS.md`): an in-scope gap on a leaf is a real finding — resolve it with the user into behavior, or the triage rules it `accepted-gap`: the item then *stays* `(gap)` (consumers should see what's undefined), the adjudication reaches the Change Log at approve, and later rounds don't re-raise it.
   - **`spec` mode at `full` only — prune `conventions.md`.** Every node reads it and only `implement` ever appends, so it is the one project doc that grows unbounded. Cut entries this node's contract makes **redundant · contradicted · obsolete**, plus any node-local implementation detail that leaked in. **Cut only, never add** — recording a *new* cross-cutting rule is `implement`'s job. (Not in `tree` mode: there is no "this node", and at init `conventions.md` is empty or freshly seeded.)

   Fixing in this main session is fine — the confirmation round is cold either way.
   - **The grade isn't yours to set.** Each confirmed finding records its gate answers as fields (`proposed` · `gate1` · `gate2` · `gate3`, plus `clause`·`workaround`·`harm` where an answer demands one), and **`grovespec validate` recomputes the severity from them** and fails the record if the grade exceeds what they allow.
4. **Confirm the fix — one cold round, scoped to the fix's own diff.** After the fixes land, spawn one cold confirmation round on **the edits + the items they claim closed + the clauses that use what they changed** — not the whole draft again: did each edit close its item (re-run the finding's own measurement)? did it open a new hole *in what it touched*? do the checklist rows the edits touch still hold? A confirmation reviewer who stumbles onto an unrelated real defect still reports it — it enters through the gates (mini-triage) and joins the list; its *assignment* never widens beyond the edits. Blocking finds → fix again → confirm again. **The list empty + the last confirmation clean ends the cycle.**
5. **On the terminal pass, seal it**: `node .grovespec/bin/grovespec.mjs pin TASK-N` (spec) or `pin tree` — it binds the verdict to the bytes the reviewers saw (digest) and marks it `approved_by: pending`. The approval step below can then *verify* the seal instead of trusting the session's memory.
6. **Stop safety**: `round` counts every spawned pass (find waves + judge + confirmations); if it exceeds `max_rounds`, set `status: escalated`, take the open issues to the human, do **not** approve.
7. At judge — and at each confirmation's mini-triage — append the drops to `adjudications`, **condensed into the do-not-raise categories** handed to every later wave (so fresh reviewers don't re-find them), under the **two-strike shape rule** (`reviewers.md` §triage).

## Human approval
On a clean terminal pass, show the human the result and get confirmation.
- **`spec`** → show the draft, **"is this what you want?"** → Yes: run **`node .grovespec/bin/grovespec.mjs approve TASK-N --human`** — it verifies the seal still covers these bytes and flips `status: approved` itself; **never hand-edit the status** (a refusal means the spec moved after the pass — re-verify, don't override). Surviving `adjudications` stay in `<id>.verify.yaml` — `reopen` preserves them, same as the tree gate's rule below; don't copy them into the Change Log.
- **`tree`** → show the **whole tree** (+ the D-table — or, fidelity, the F-table with the code↔tree evidence), and ask the matching question: **"is this the right decomposition?"** / **"is this an accurate survey?"** → Yes: run **`grovespec approve tree --human`** — it verifies the sealed structure digest and opens the gate; this gate is **never machine-taken**, in any mode. Surviving `adjudications` stay in `tree.verify.yaml` (a later structural re-verify reads them from there — no need to copy elsewhere; brief.md has no Change Log section). The human is now confirming an *already cold-vetted* tree — not doing the vetting themselves.
- **Escalated, or human rejects** → fix the draft / the sketch tree and loop back; nothing advances.

## When it's done
- **`spec`**: the node is `approved` → **next: `grovespec-implement`**.
- **`tree`** (decomposition): cold-verified + human-approved → **the per-node build begins**: `grovespec-grow` the root (detail its sketch → draft), then `verify` (spec) → `implement` → `review`, top-down.
- **`tree`** (fidelity): the survey is confirmed accurate → **`grovespec-plan`** (plan #1) structures the parked backlog into the first round; `revise`/`grow` execute it.

> **Open and close in the step-report shape** (`FORMATS.md` "The step report" — fixed `starting` opening; `Result · Open · Your turn · Next` closing, warm full sentences). Here, *Open / Your turn* typically carry: open issues · an escalation · gap rulings waiting on the human.

**Commit as `verify TASK-N: <summary>`** (tree gate: `verify tree: …`) — and an **escalate** stop commits the same way (`verify TASK-N: escalated — …`): the whole cycle's evidence is uncommitted at that point (a verify cycle has no fix commits), it is what the human ruling reads, and `validate`'s untracked notice only watches *passed* records. On a pass — everything this gate wrote: the Task file (tree gate: `tree.md` and any sketch Tasks its fix rounds edited), the gate's evidence — `<id>.verify.yaml` / `tree.verify.yaml` plus **every round file of this cycle** (a verify cycle has no fix commits; this commit is the only ride they get) — and, at `full`, the `conventions.md` pruning. The step name goes first so the commit stays out of the code cycle's `^TASK-N: ` anchor (`FORMATS.md` "Commits"). A passed gate whose record never entered git is a verdict whose subject is one `git clean` away from gone — `validate` names each one until it is in.

> **Recommend a new session for the next step** (implement, or the first `grow`). Clean, bounded context per step keeps GroveSpec's cost flat and its next reviewers cold (WORKFLOW §5). *(Driving with `grovespec next` in a loop? `@new` already starts that session — this recommendation is for a person going step by step, and it is never a reason to end the loop.)*
