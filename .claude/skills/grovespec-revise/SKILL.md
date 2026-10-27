---
name: grovespec-revise
description: Changes a node that already passed a gate in GroveSpec (done, or an approved spec) — change its behavior under a new requirement (reopen), change the tree structure (split·merge·move), or promote a leaf to a skeleton (it grew to need children). The machine decides the lane (grovespec amend): documentation-only edits re-seal in place, an AC change runs the node's own gates, and only a Contract change reaches further — its dependents become recheck candidates judged in one step, never mass reopens. Use when the user wants to "change·fix this (already-done) thing / the requirement changed / scale this up / split·merge·move this node / grovespec revise". For not-yet-built nodes use grovespec-grow·verify·implement.
---

# grovespec-revise

Changing a node that already **passed a gate** — a `done` node, or an `approved` one whose spec passed its gate byte for byte. (A `sketch`/`draft` is pre-commitment: edit it in place. Fixing mid-cycle is `grovespec-verify` for the spec, and `grovespec-review` → `grovespec-fix` for the code — except a must-fix only a change to this node's own Contract closes, which the person chose to fix *now*: then the node reopens to `draft` from mid-cycle, abandoning its open cycle — `FORMATS.md` "A defect only a contract change closes".)

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `node .grovespec/bin/grovespec.mjs lang`) and write **every** reply in that language. These files are English; your output is not.

> **Decisions: recommend + leave a way out.** When you ask the user to decide (split·merge·move, how to change…): **mark your recommended option `(추천)`** with a one-line why, and **always allow a free-form answer** (ask through the host's question tool — its *Other* is that answer; `FORMATS.md` "A decision, not a stage"). Don't force a closed pick.

**Claim the node first:** `node .grovespec/bin/grovespec.mjs claim TASK-N revise` — non-zero = **stop** and report what it printed.

## The lane decides everything — and the machine decides the lane
For a spec edit, **run `node .grovespec/bin/grovespec.mjs amend TASK-N` first** — it compares Contract and AC **byte-for-byte** against HEAD and either finishes or names the lane (why the split exists and its measured cost: METHODOLOGY §6):
> - **Documentation only** (Contract·AC byte-identical) → **amend finishes it**: re-sealed in place, `done` stays, dependents untouched. Record why in the Change Log, commit `amend TASK-N: <summary>` with every file it re-sealed. No cycle runs.
> - **AC bytes changed** → the node's **own gates only** (reopen `draft` → verify → implement → review). Dependents stay out — consumers read the Contract, and it didn't move.
> - **Contract bytes changed** → this section's full path: reopen, and the dependents become **recheck candidates** (below) — never mass reopens. Even a pure re-wrap takes a lane: equality the machine can prove is bytes (why nothing looser: METHODOLOGY §6), and a lane's only cost is checking.
> - **Bytes moved, meaning and behavior didn't** — a rename, a reworded clause, dead code removed → **the simple tier**. The machine guards it for free (AC bytes must hold; moved code must pass the project's tests), then ONE cold reviewer gets the change — old and new wording, or the code diff — and one question: *did the meaning or the behavior change? Show it.* **No** → `grovespec amend TASK-N --simple "<its verdict>"`: re-sealed in place, `done` stays, no dependent becomes a candidate; record the verdict in the Change Log and commit as the command says. **Yes**, or the guard refuses → one tier up: the contract lane for wording, reopen `approved` for code.

A code-only change (spec untouched): reopen `approved` when the node's behavior changed, the simple tier above when it didn't, and `fresh` absorption only for a hand-fix nobody routed. When a code change makes the *Contract text* wrong, that is the contract lane — when unsure between lanes, take the wider one: a false "documentation" is the silent drift GroveSpec exists to stop, a false "contract" costs one recheck step.

Ask one adjacent question separately: **did this node's source ownership change?** Diff frontmatter `refs`. A changed coordinate — including to/from `[]` — is a tree mapping change even when the Contract text happens to stay the same. **When only `refs` changed** (Contract·AC byte-identical), the node does not reopen: run `grovespec amend TASK-N` — its spec seal re-seals in place, and a source packet that described the old refs retires. When the Contract or AC moved too, reopen it to `draft` (below). Either way, run **`node .grovespec/bin/grovespec.mjs reopen tree decomposition`** and explicit `grovespec-verify tree` — the tree gate carries the new assignment; the command preserves settled `adjudications` and persists the mode before round 1, then `pin tree` binds the new `source_scope_digest`. Never let a new `ref/index.md` record silently supersede a Task's old coordinate.

**And make the consumer set mechanical too.** When the contract changed:
- **consumers = (a) ∪ (b)** — (a) every Task whose `blocked_by` lists this node's id; (b) code/specs that grep-hit this node's **exported symbol names** across `src/` + `tasks/`. The set is complete only when *both* lists are enumerated. *Under-counting here is exactly the silent drift the whole tool exists to stop.*
- **Read the symbols from the node's *code***, not its Contract — the public names consumers actually call (functions·classes·commands·routes); the Contract is concept-only and may name none. **`node .grovespec/bin/grovespec.mjs files TASK-N`** lists that code (derived from the node's `TASK-N:` commits — a `mapped` brownfield node has none, so grep instead). **Grep the *symbol*, never the node name** (names get renamed — `FORMATS.md`).
- **Consumers become CANDIDATES, never reopens** — declare the whole set: `grovespec recheck declare TASK-N <consumer…> <why the change could reach them>`. They keep `done` and their seals; when this node lands back at `done`, `next` names **one recheck step** (grovespec-recheck) that judges reach for them all, and only judged-touched nodes reopen. The command itself skips non-`done` consumers — a `sketch`/`draft` one is pre-commitment and reads the *new* contract when grown; an open one's own cycle does the same.

Don't make clones — one node = one Task. Old code lives in git; why it changed lives in the Change Log.

> **Quoted record values stay one strict-YAML line** — in `"…"` write `\` as `\\` and `"` as `\"`; in `'…'` double the `'` (`''`). `validate` notices breakage (`FORMATS.md` "review-cycle state").

## Two kinds of change

### A. Behavior change (reopen)
1. **Reopen** to the earliest status the change touches, with **`node .grovespec/bin/grovespec.mjs reopen TASK-N draft|approved`** — `draft` if the spec/contract changes (needs re-`verify`; a `refs`-only change amends instead — above), `approved` if only the code changes (spec still valid → re-`implement` → re-`review`). The command resets the gate cycles so a past cycle's `passed` can never double as the new cycle's evidence (it keeps `reviewed_commit` as the next diff's base); **never reopen by hand-editing the status**. A node mid-cycle (`implemented` · `reviewed` · `fixed`) reopens to `draft` only, and the command names the open issues its abandoned cycle held — write each into the Change Log line that says why. When intent moved to a new frozen ref record, update `refs` to its exact current headings through `ref/index.md`; use `[]` only for intentional no-ref, not as a placeholder. An **`approved` node reopens to `draft` only** — the spec gate is the one behind it, and a code-only change on a node with no code yet is `grovespec-implement`, not a revise.
2. Change it (spec and/or code), then run it forward through the normal gates from there: `draft` → `grovespec-verify` → `grovespec-implement` → `grovespec-review` → `done`; or `approved` → `grovespec-implement` → `grovespec-review` (→ `fix`) → `done`.
3. **If the contract changed** → compute the consumer set (above) and **declare it**: `grovespec recheck declare TASK-N <consumer…> <need>` in the same reopening commit. Nothing else happens to the consumers now — they keep `done`; the recheck step judges reach when this node lands back at `done`, and its touched verdict reopens a consumer itself (`recheck open`, the lane named there) — that consumer's own cycle runs like any revise, **its** dependents becoming candidates the same way (the lane repeats one layer at a time). (`grovespec impact <id>` lists the blocked_by half of the blast radius.)
4. Record *why it changed* in the Change Log of each touched node; each returns to `done` through its own gate. On an `escalated` verify/review, stop — don't re-close that node.

> `node .grovespec/bin/grovespec.mjs fresh` lists changes to the project that never went through the skills — hand-fixes waiting to be reconciled. Each is a revise candidate: reopen the owning node and absorb the change through its gates.

### B. Structure or source-assignment change (split·merge·move·reassign refs)
Change the shape in **`tree.md` only** — it's the single source of truth for parent-child structure; Task files don't record parent or children (`FORMATS.md`). Change source ownership in each Task's **`refs` only** — the exact current headings, not a prose summary. Here too, if the contract changes, declare the consumer set as recheck candidates (as above).

**A node never moves or drops alone — its whole subtree goes with it** (re-indent or remove the descendants too; a left-behind child fails `validate`'s orphan check).

- **Move**: re-indent the node under its new parent in `tree.md`. The node's own Task·code stays (if the contract didn't change). ✅ exactly one parent in tree.md after the move. ❌ left under the old parent *and* the new → two parents, structure corrupted. Usually "it's used in several places → move it up."
- **Split**: add the children's ids under this node in `tree.md` (each new id from `node .grovespec/bin/grovespec.mjs id` — never counted by eye) + divide the node's content and exact source headings into the new children's Tasks. Give every new Task canonical `refs` (including an explicit `[]` only if it is intentionally no-ref). *Keep the outer contract and split only the inside* → users aren't touched (the default). Split the outer contract too → that *is* a contract change: its consumers become recheck candidates; compute the consumer set (above) first, so you see the blast radius before committing.
- **Merge**: two ids into one in `tree.md`, merge the Task content into the surviving Task. Any node whose `blocked_by` listed either one now points at the merged node (update those). **The retired id is burned, never reassigned** — its `TASK-N:` commits and its task file's path stay in history, and a new node wearing that number would inherit them as its diff (`grovespec id` skips it automatically, across every reachable ref).

**Then re-run the decomposition gate.** After a structure **or `refs` assignment** change (and any propagation), run **`node .grovespec/bin/grovespec.mjs reopen tree decomposition`**, then `grovespec-verify` with the **explicit target `tree`**. The command preserves settled `adjudications`, removes the prior seal, and writes the mode before round 1; never hand-reset the YAML or rely on inference from a built tree. D1 reviews the new source→node map, and `pin tree` writes a fresh `source_scope_digest`; the prior passed record cannot authorize a different assignment.
- **Scale to the change**: a single move with the contract unchanged → `light`; a split·merge or several nodes → `standard`.
- On a built tree the reviewers read each node's **id·name·Overview + `refs` only** (`reviewers.md`), and `tree.verify.yaml`'s `adjudications` carry over as do-not-raise — settled calls aren't re-litigated.

> Prefer *keeping the outer contract* — that's what keeps the partial tree small and contained.

### C. Leaf grew to need children (feature → skeleton)
A `done` `feature` turns out to need sub-nodes ("scale this up / more behavior attaches here"). Reopen it, set `role: skeleton`, and **record its decomposition in the Change Log** (the children + which Contract clause each owns — exactly as `implement` would). Then:
- **Outer Contract unchanged** (it just gains internal structure) → consumers untouched; re-`implement` its own structural code if needed → `review` → `done`, then `grovespec-grow` each child one at a time.
- **Outer Contract changed** → declare the consumers as candidates, as in A.3.
The role promotion *is* the change; the children themselves are grown afterward, normally.

## Where the batches come from — grovespec-plan
The parked work (review-file `followups` · the brownfield backlogs `findings.md`/`restructuring.md` · `fresh` hand-edits) is **structured into milestones by `grovespec-plan`**, which clusters it, gets the human's disposition, and translates each kept item into exactly the changes above — a behavior change (A) arrives here as a reopen, a structural one as (B). A **single small item needs no plan**: come straight here. Check a backlog item off (or delete it) once its node is `done` again.

## Session
Thin — read only the Task·relevant code of the node you're changing, and (when declaring candidates) just enough of each consumer to enumerate it.

## When it's done
The changed node is `done` again, with the reason in the Change Log. If the contract changed, the consumers have been re-reviewed and are coherent again.

> **Open and close in the step-report shape** (`FORMATS.md` "The step report" — `## … starting` to open; `### Result · Open · Your turn · Next` to close; warm full sentences, laid out in lists and tables). Here, *Open / Your turn* typically carry: candidates declared and awaiting their recheck · an escalated gate.

**Commit the reopening as `revise TASK-N: <summary>`** before the re-run steps begin — the changed Task file(s), every `refs` update, the tree edit if the structure moved, the fresh tree-cycle record when source ownership changed, the candidate declarations (`.grovespec/candidates.yaml`), and the `reopen` result. The step name goes first (`FORMATS.md` "Commits"); the cycle that follows writes its own `TASK-N: ` commits.

> **Recommend a new session for each step of a revise** (the re-verify / re-implement / re-review of the node, and the recheck when it arms). Reopening a node runs it through the normal gates — same rule: one step, one fresh session (WORKFLOW §5). *(Driving with `grovespec next` in a loop? `@new` already starts that session — this recommendation is for a person going step by step, and it is never a reason to end the loop.)*
