---
name: grovespec-implement
description: Implements a GroveSpec node — turns an *approved* spec into real code. Pre-check (risks·conventions·search existing code) → tests first → write code → confirm whether this node needs children (record its decomposition) → status implemented. No review here; that's grovespec-review next. Use when the user wants to "implement this node / write the code / build it / grovespec implement" once a node is approved. For verifying the spec use grovespec-verify; for reviewing the code use grovespec-review; to change a done node use grovespec-revise.
---

# grovespec-implement

Turning an **`approved`** spec into *code*. (Verifying the spec is `grovespec-verify`; reviewing the code is `grovespec-review`.) Implement builds the node's own behavior — a **feature**'s leaf logic, or a **skeleton**'s structural code (container·interface·dispatch). For the **root skeleton** that structural code is the **base environment + an empty runnable shell** (the app boots / a blank page loads), with the **stack chosen here** and *no feature logic*. It ends at `implemented`; it does **not** review or mark `done`.

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `bash .grovespec/bin/grovespec lang`) and write **every** reply in that language. These files are English; your output is not.

> **Decisions: recommend + leave a way out.** When you ask the user to decide (tech stack, library, approach…): **mark your recommended option `(추천)`** with a one-line why, and **always allow a free-form answer** (the AskUserQuestion tool's *Other*, or an explicit free-form choice in an inline list). Don't force a closed pick.

## Session
Thin — read only this node's Task and the *relevant* code. Don't pile up a long working context.

## Flow

### 0. Confirm it's this node's turn (the gate)
The node must be **`approved`** (cold-verified + human-approved) and unblocked. Run `grovespec check <node>`.
- ✗ (blocked) or not yet `approved` → **STOP**: `grovespec-verify` it first, or implement the node `grovespec check` reports ready. **Never implement a node whose parent isn't `done`** (bottom-up drift), or whose spec isn't `approved`.
- **Start from a clean working tree** — uncommitted unrelated changes would blur this node's diff (the boundary `grovespec-review` reads — `FORMATS.md`); have the user commit/stash them first.

### 1. Pre-check (before writing)
- **Look up risks**: any risk in `brief.md` this node touches? Go in knowing it.
- **Check conventions**: the relevant terms·rules in `conventions.md`.
- **Search existing code (grep) — most important**:
  1. Pull the *key words* from what this node does.
  2. Search the code + `tasks/` for those words.
  3. Put what you find in front of you and answer **"reuse, or write new?"** before moving on.

  An isolated agent that writes the second copy, with the first not in front of it, won't know it duplicated — so "always search first here" is the rule.

### 2. Tests first
From the AC, write *failing* tests — the target the implementation must hit. (Skip AC items marked `(gap)` — deliberately undefined behavior, nothing to pin — `FORMATS.md`.) Obey the Task's `tdd` field (set at grow): `tdd: true` → failing tests first; `tdd: false` → skip (its `tdd_skip_reason` says why). If the field looks wrong for this node, that's a spec fix — go back to `grovespec-revise`; don't override it silently here.

### 3. Implement
Write code until the tests pass. **Reversibility gate — before committing a deferred *how*:** if it's hard to reverse (stack · architecture · data model) or the cold review can't verify it (design direction · look-and-feel), **ask the human first** (recommend + options + free-form, per line 12) — late is fine, silent is not. Cheap and reversible hows (widget choice · naming · local structure) → decide and go; review + the human confirm are the net.
- **A skeleton builds structural code — not nothing.** It assembles the glue/container its children slot into.
  - **The root** stands up the **base environment + an empty runnable shell**: the stack is chosen here **with the human** (recommend + rationale — the least reversible decision in the project), the project is wired to build/run, and it *runs while doing nothing* (app boots / blank page loads / CLI prints help) — smoke-tested, with **zero feature logic** (features arrive as children, already sketched, detailed later).
  - A root whose implement produces **no runnable base is wrong**: that setup work belongs to no single child, so it can't be deferred to one.
- **Write-scope (blast radius):** write only *this node's* code (`src/`), its tests (`tests/`), and *this node's* Task — plus `tree.md` if you extract/split (next bullet), and **`conventions.md` when you establish a new cross-cutting rule/term** (the "Record conventions" bullet below). **Don't edit another existing node's code or Task** to make yours pass; if a *shared* node you depend on must change, stop and `grovespec-revise` it.
- If you find a chunk 2+ nodes will use, extract it as a shared node (or split this one): add its id to `tree.md` so structure stays in sync with the code.
- **If the code must diverge from the spec:**
  - *A detail* → default to **conform the code to the spec** (the cheap, reversible direction).
  - *The draft's structure* (its decomposition or contract shape) turns out wrong → **the draft is the hypothesis that loses**; once code exists it becomes the truth (METHODOLOGY Principle 1). State the new contract clause replacing the old and do it via `grovespec-revise`, **never a silent edit** — structural is hard to reverse, so the reversibility gate above applies (surface it to the human).
  - *With existing code present* (brownfield, or earlier nodes) → judge from the code, not from a plausible-but-stale draft.
- **Record cross-cutting conventions you established.** If building this node set a **global rule, term, or stack choice that other nodes must follow**, append it to `conventions.md` (in `config.language`) — terms → *Glossary*, rules/stack/patterns → *Common Rules*.
  - **Cross-cutting facts only** — never this node's local implementation detail (that lives in the code; over-recording bloats a doc every node reads).
  - **The root / stack-choosing implement seeds it** — the stack + the foundational patterns children must follow (e.g. *web framework & router style · DB + ORM · the shared-client location/pattern · where tests live & the runner · where API routes go*), so children read them here instead of re-deriving from code.
  - **Append and update only — never prune here.** Stale entries are cut at the next `full` `grovespec-verify` (its Resolve step); the writer is not its own editor.

### 4. Confirm the decomposition against reality
Greenfield, this node's children were already **sketched** at init. Building the node is what **confirms** them — and its `role`:
- **Leaf** (no children sketched, build needs none) → `role: feature`.
- **Skeleton** (has sketched children) → reconcile each sketch against what the build revealed this node actually needs:
  - **still right** → keep it (grow details it later, after this node is `done`);
  - **now wrong** (build shows it's unneeded or misframed) → **drop it *and any sketched descendants*** (remove them from `tree.md`, delete their sketch Tasks — sketches are pre-commitment, free to delete; leaving a grandchild behind fails `validate`'s orphan check) or fix the sketch;
  - **missing** (the build reveals a child the sketch didn't) → add it as a new `sketch`.
  Record the confirmed decomposition (children + which Contract clause each owns — 0 gaps, 0 overlaps) in the **Change Log**. **Don't write the children's full contracts here** — grow details each later.
- **A `feature` that turned out to need children** (none sketched, but the build reveals sub-behaviors) → set `role: skeleton` and add the children as `sketch` nodes (a brownfield-style decomposition — this wasn't in the spec).

**This can fire mid-build — don't push through a node that outgrew its contract.**
- **Signals**: you're building two-plus separable behaviors; Subtasks keep multiplying; the tests won't converge on one bounded target. (A review that later needs many rounds is the same signal, seen late.)
- **Then stop building the extra behavior**: finish only this node's *own* part (a feature's core behavior, or the structural glue), park the rest as new `sketch` children (ids into `tree.md`), move the AC items they own down to them (or mark `[→ child/deferred: …]`), set `role: skeleton` if it was a feature, and record the decomposition in the Change Log — the same reconciliation, invoked early.

### 5. Hand off → implemented
**Commit as `TASK-N: implement — <summary>`** (commits made while working this node carry the same `TASK-N:` prefix; this boundary is the diff `grovespec-review` reads — `FORMATS.md`). Set the Task `status: implemented`. **Next: `grovespec-review`** — it runs the tests and a cold code review of *this node's diff*, then `grovespec-fix` if needed, then `done`. implement does not review its own work; cold eyes do.

## When it's done
Code·tests are in `src/`·`tests/`, the Task is `implemented` (plus a Change-Log decomposition if it became a skeleton). Next is `grovespec-review`.

> **Recommend a new session for `grovespec-review`.** The agent that just wrote the code shouldn't also orchestrate its cold review — start it fresh, clean bounded context (WORKFLOW §5).
