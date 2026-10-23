---
name: grovespec-fix
description: Applies the issues grovespec-review found — works THIS node's confirmed must-fix list ONE ITEM AT A TIME (plan → cold plan review → apply → cold confirm), sets status fixed when the list is closed, and re-runs grovespec-review to seal. Use when the user wants to "fix the review issues / apply the fixes / address the findings / grovespec fix" after a review found problems. For the review itself use grovespec-review; to change a done node use grovespec-revise.
---

# grovespec-fix

Closing the issues `grovespec-review` confirmed — the `reviewed` → `fixed` half of the loop. (Finding the issues is `grovespec-review`; fixing needs no independence, so it runs in the implementer's context — but each item's **plan review** and **confirmation** are cold.)

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `node .grovespec/bin/grovespec.mjs lang`) and write **every** reply in that language. These files are English; your output is not.

## Flow — one item at a time, never a batch
Applying every fix and then reviewing the pile is how a wrong fix hides behind a right one — and how "fix all, re-sweep all, find more, fix all" never ends. Here each item is planned, cold-reviewed, applied, and cold-confirmed **before the next item starts** (`reviewers.md` §The cycle). The record's `current_item` · `item_phase` · `plan_clear_streak` say exactly where this loop stands — **a new session resumes there; it never restarts the list or re-opens find.**

> **Quoted record values stay one strict-YAML line** — in `"…"` write `\` as `\\` and `"` as `\"`; in `'…'` double the `'` (`''`). `validate` notices breakage (`FORMATS.md` "review-cycle state").

### 1. Pick the node + the item
*If no node is named*, take the `reviewed` node whose `<id>.review.yaml` carries `open_issues` — the one `grovespec-review` just handed back. If that list is empty there's nothing to fix; go back to `grovespec-review` (it's what gates `done`). **Claim it:** `node .grovespec/bin/grovespec.mjs claim TASK-N fix` — non-zero = **stop** and report what it printed. Read the node's Task (AC·Contract) as the yardstick. Ignore `followups`: that is the **record list** (improvements · harmless bugs · routed contract-gaps) — never this step's queue.
**Not your turn if find never closed.** A record still in `phase: find` with `no_new_streak` below `find_streak` — the shape a migrated pre-0.13 cycle resumes in (README migration) — belongs to `grovespec-review`, which re-enters find; the one item that legitimately lands here pre-find is the suite-cannot-run `crash`. Meeting that shape with the Task at `reviewed` means the migration missed its last step: set the Task back to `implemented` in the same migration edit and hand to review — fixing here would close the list without ever earning the streak, and the close conditions would refuse the endpoint.
Then pick **one** item — `current_item` if the record already names one; otherwise `crash` items first, then by blast radius — and write it to the record.

### 2. Plan the fix — before touching code
Write the item's fix plan into this round's `<id>.review.round<n>.plan.md` (a few sentences is enough for a small fix; `item_phase: plan`):
- the problem's **occurrence condition and cause** (not the symptom — what makes it happen);
- **what will change**, and why that change removes the cause;
- the existing behavior the change **directly touches**;
- **how closure will be measured** — the check that shows the problem gone and no direct regression.

**The complete fix is bounded**: it removes the *current* problem's cause — nothing more. It is not "no conceivable issue ever again": a one-line change that blocks today's cause **is** a root fix, and a giant matrix that guards every future variation is out of scope. Prefer subtracting (removing what made the issue possible) over new mechanism — new code is the next review's input.

### 3. Cold-review the plan — M consecutive clean passes
Spawn ONE cold reviewer (subagent, empty context) on the plan + the item + the relevant Contract/AC lines. It answers **four questions and no more**:
- Applied as written, does this remove the current problem?
- Does it mask only the shown repro and leave the same cause reachable?
- Does it create a new must-fix problem in an existing requirement or the ordinary use flow?
- Does it add machinery — defenses, abstractions, exhaustive sweeps — the current problem doesn't need?

A blocking answer must walk **a concrete path**: the current repro conditions or an existing requirement with the plan substituted in. "It could matter someday" / a different implementation taste is **not** a rejection. Blocking answer → revise the plan, reset `plan_clear_streak` to 0. Clean pass → `plan_clear_streak + 1`. Apply only at **`plan_streak` (M, config) consecutive clean passes** — and a plan edit *always* restarts the count, whatever session made it.

### 4. Apply — this item, this node's code only
- **Write-scope (blast radius):** edit only *this node's* `src/`·`tests/` and *this node's* Task (+ `tree.md` if you extract/split, and `conventions.md` when the issue is a cross-cutting rule). **Don't edit another existing node's code or Task** to clear an issue — *reading* one is fine, *writing* it is that node's own turn. If a *shared* node must change, that's `grovespec-revise` on it. If the issue's owner is a node that **isn't built yet**, it stays in *this* node's record (Change Log · review record · `conventions.md` when it's a global rule) — **never written into that node's Requirements·Contract·AC.**
- If the issue says a **test was hollow or wrong**, fix the test (and the behavior it should have caught) — not just the code.
- **If the issue means the *spec* is wrong** (the contract, not the code) — stop and ask the person (`FORMATS.md` "A defect only a contract change closes"), never a silent code patch. *Now*: end this step at its commit; `grovespec-revise` reopens this node to `draft`, abandoning this cycle. *Next milestone*: move the item to `followups` as a `contract-gap`; the list closes on the rest.
- Fix exactly what the plan says — no drive-by refactors, no second item folded in. Put the net line delta (`+N/−N`) in the commit body.
- **Your own runs** — the suite, a repro, a timing, a screen check — are bounded, owned and cleaned up: a mutation only in a temp copy of your own, a time and a memory limit with a means, stop or delete only by the PID or id you started (never by a name or a label); the person's machine only with their OK, every time (`FORMATS.md` "The person's machine").
- **Commit the item as `TASK-N: fix <item-id> — <summary>`** (the `TASK-N:` prefix keeps the diff boundary mechanical — `FORMATS.md`). Include the record + this item's round files in the commit — a gate's evidence outside git is one clean-up away from gone.

### 5. Confirm the item — one cold round, this item's scope only
`item_phase: confirm`. Spawn one cold confirmation on **this item's own diff + the item + the in-node use-sites of what it changed** (`reviewers.md` §The cycle — assemble the diff by hand and hold the gate records out of it):
- Is the original problem gone? (re-run the finding's own measurement)
- Does the same cause still reach a current wrong result by another path?
- Did the fix directly regress what it touched?

**Pass** → the item closes: remove it from `open_issues` (note the closer + measurement), clear `current_item` **and reset `plan_clear_streak` to 0** — the next item's plan starts from zero, in this session or the next (a counter never crosses items, just as it never survives a plan edit). Go to §1 for the next item.
**Fail** → do NOT stack a patch. First name which failure it is — **a mis-diagnosed cause, a symptom-only patch, or an implementation slip** — then return to §2 with that diagnosis (the plan changes, so its counter resets). **The second failure in a row escalates this item alone**: set `status: escalated` with `current_item` naming it, and put it to the person — what it is, the two attempts and why each failed — with the options: a different approach (they name it; the cycle resumes at a new plan), accept it as it stands (an `excluded-by-user` adjudication with their reason; the item leaves `open_issues`), or change the requirement (`grovespec-revise`). The rest of the list waits behind it. If this round's failure shows the *previous* fix itself was wrong, revert it — **a revert reopens every item that fix had closed** (back into `open_issues`; their confirmations re-run).
A confirmation find **outside** this item's scope is classified like any find (`reviewers.md` §Classification): a new must-fix becomes its **own** open item, worked after this one — it never widens this item and never re-opens the find phase. The same recurring `family` on a third fix still ends the case-work: close the class structurally or escalate with the family named.

### 6. The list is closed → hand back to review
Every item closed → set the Task `status: fixed`, commit any remaining record updates, and **re-run `grovespec-review`** on the node. It does **not** re-sweep: find already closed on its streak and every item carries its own cold confirmation — review's remaining job is the tests + the seal (pin · validate · human confirm). Only if find never ran or closed on this diff (a `crash` item — the suite could not execute — was fixed before any sweep) does review run **find** now.

Running the node's existing regression tests along the way is fine — it is not a new exploration pass, and a needed test's failure is analyzed as part of the item that caused it. **Test runtime is never this step's problem**: making the suite faster is `improvement` material for the record list, not work this loop may adopt.

## When it's done
The `open_issues` list is empty, every closure carries its measurement, `status: fixed`, and `grovespec-review` is running again. fix never marks `done` itself — only review's seal + the gate decision does.

> **Open and close in the step-report shape** (`FORMATS.md` "The step report" — a `## … starting` heading to open; `### Result · Open · Your turn · Next` headings to close, warm full sentences). Here, *Open / Your turn* typically carry: an item you could *not* fix (spec-level · shared-node · needs a human ruling) · the record list's notable additions.

> **Recommend a new session to re-run `grovespec-review`** (or continue in-session if the loop was short). A clean orchestrator keeps context bounded across the `reviewed ⇄ fixed` loop (WORKFLOW §5) — and the record's `current_item`/`item_phase` mean an interrupted loop resumes mid-item, not from the top.
