---
name: grovespec-grow
description: Details ONE node's spec from a sketch into a full draft (sketch → draft) — writes its Contract·AC from the ref intent records; no code. The per-node detailing step of the initial build (plan #0 lays the whole tree out as sketches; grow details each one just before it's verified), AND the tool for LATER expansion (add a brand-new node beyond the spec). Use when the user wants to "detail the next node / write the next spec / flesh out this sketch / add a new node / expand the tree / grovespec grow". For verifying the draft use grovespec-verify; for code use grovespec-implement; to change a done node use grovespec-revise.
---

# grovespec-grow

Turning **one node's `sketch` into a full `draft`** — writing its Contract·AC from the reference spec, no code. (Verifying the draft is `grovespec-verify`; building it is `grovespec-implement`.)

> **Two uses, same action (sketch → draft):**
> - **Initial build (the common case).** `grovespec-plan` laid the whole tree out as `sketch` nodes (structure only), and `verify`-tree cold-vetted that decomposition — so the structure you detail into is already approved. grow details the next sketch — its full contract — just before it's verified. The sketch + the detailed spec in `ref/` ground it, so this is *not* invention from a vacuum.
> - **Later expansion.** A node the original spec didn't cover (a new requirement, something `implement` revealed). Under a **`done`** parent, grow *creates* it as a `draft` directly. If it belongs under a parent **not built yet** (still `sketch`/`draft`), add it as a **`sketch`** there instead and let that parent's own `implement` reconcile it — don't draft a node under an unbuilt parent (`grovespec check` blocks it anyway).

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `node .grovespec/bin/grovespec.mjs lang`) and write **every** reply in that language. These files are English; your output is not.

> **Decisions: recommend + leave a way out.** When you ask the user to decide (an approach, a contract choice…): **mark your recommended option `(추천)`** with a one-line why, and **always allow a free-form answer** (the AskUserQuestion tool's *Other*, or an explicit free-form choice in an inline list). Don't force a closed pick.

## One principle: one node, under a done parent
Detail exactly **one** node, and only when its parent is **`done`** (so you write its contract against a real, built parent, not a guess). **Don't (re)define this node's *own* children here** — greenfield they're already sketched in the tree (from init); their contracts get detailed later, each after *this* node is `done`. (For an expansion node with no sketched children, whether it needs any is confirmed at *its* implement, as a brownfield-style decomposition.)

## Flow

### 1. Pick what to detail
- **Initial build**: the next `sketch` node whose parent is `done` — `grovespec check` lists it (`sketch → grow (detail → draft)`). Confirm the parent is `done` mechanically; **never detail under a non-`done` parent** (bottom-up drift).
- **Expansion**: the user points at a new capability not in the tree. Create a new Task under a `done` parent and add its id to `tree.md` — **the id comes from `node .grovespec/bin/grovespec.mjs id`, never counted by eye**: it skips every number that left a trace (tree · files · records, plus commit subjects and task-file paths across every reachable ref), so a merged-away node's commits can't leak into the new node's diff. Give the Task the exact current source headings in `refs`, or explicit `refs: []` when the capability intentionally has no ref source. (Belongs under a not-yet-`done` parent? Add it as a `sketch`, not a draft — see the callout above.)

### 2. Read only what you need (thin)
- **The node's sketch** (its one-line responsibility + rough I/O) and **exactly the headings its frontmatter `refs` assigns** — the intent source the full contract is written from. Check those coordinates against `ref/index.md`, which points at each topic's current record; never rediscover a broader/narrower scope from prose. `refs: []` means this node is intentionally no-ref, so ground it in the parent/brief instead. A field-absent Task is legacy: use only its explicit `ref/<file> §N` citations; do not guess when there are none.
- The parent's **Contract** + this node's place in it (which clause it fills).
- The risks in `brief.md` this node touches; the terms·rules in `conventions.md`.

Don't pile up a long context. The truth is on disk; re-read when you need it.

### 3. Write the draft (concept only) — sketch → draft
Fill the Task out fully: keep the `id`, **preserve `refs` exactly**, and set `status: draft`. Format is fixed by `FORMATS.md` (Overview·Requirements·**Contract**·AC). Write the *content* in `config.language`, from those assigned ref headings + the sketch. If the intended source ownership itself is wrong, do not silently fix it here: return to `plan`/the tree gate so D1 and the tree's source-scope seal see the change.
- **The Contract matters most**: precise enough that another node can rely on it alone, without seeing the internals (what it takes·gives·empty cases) — and it must fill the clause the parent's contract assigned this node. Replace the sketch's rough I/O with the real contract.
- **Stay true to the ref spec.** This is where the spec's intent becomes a contract. If you must diverge from the spec, note it (it's recorded in the Change Log at implement, per `ref-docs.md`). **Narrowing is divergence too** — dropping or shrinking a behavior the ref states for this node is not a simplification; carry it, defer it with a marker, or note the divergence. A *silent* narrowing is what verify's C1 narrowing map fails.
- **`role` is a hypothesis** (skeleton if it'll hold children — greenfield, those children are already sketched under it; feature if a leaf). Confirmed at implement.
- **If it's a skeleton, it still builds *its own* structural glue** — capture (in AC/Subtasks) what *this* node assembles: the container/dispatch its children slot into. A draft whose AC/Subtasks are *only* "the children" means implement builds nothing → verify will FAIL it. (The **root**: when you detail its sketch, its deliverable is the base env + an empty runnable shell — write its AC as a smoke test + a base-env Subtask; the stack is chosen at the root's implement. → METHODOLOGY "Skeleton role".)
- **Mark the spec's gaps** as unchecked AC prefixed `(gap)` (`FORMATS.md`) — don't invent behavior the spec doesn't state. A non-empty `refs` heading made entirely of `(gap)` content is still sourced scope; preserve it instead of changing the Task to `refs: []`. verify probes each in-scope gap: it gets resolved with the user, or survives as an adjudicated `accepted-gap`.
- **`tdd`**: default `true`. Set `false` only for nodes that resist up-front tests (exploratory prototype · UI · hardware-dependent), and then `tdd_skip_reason` is required.
- **`blocked_by`** = the shared/cross-tree nodes this one consumes (often `[]`); *not* the parent (that's in tree.md). (Already set on the sketch — confirm it.)
- **Measurable NFR targets** (latency·throughput·error-rate) go in the AC as checkable items.

### 4. Done → verify next
The node is now a full `draft`. **Next is `grovespec-verify <this node>`** — the cold multi-persona check of the draft + human approval (`draft` → `approved`). grow does **no** review and sets **no** approval; that is verify's job, kept separate so the reviewers stay cold.

## When it's done
**Commit as `grow TASK-N: <summary>`** — the Task file you just detailed, plus anything else this step wrote (expansion also writes `tree.md`). The step name goes first on purpose: `^TASK-N: ` is the *code* cycle's diff anchor, and a spec commit wearing it drags this draft into the diff a later cold round reads (`FORMATS.md` "Commits"). A draft left uncommitted is also a draft the next session finds as an unexplained dirty tree.

One node's `sketch` is now a full `draft` (or, for expansion, a new `draft` exists in `tree.md`). The expensive steps follow, one at a time: `grovespec-verify` → (approve → `approved`) → `grovespec-implement` → `grovespec-review` → (confirm → `done`). Only once *this* node is `done` are *its* (already-sketched) children detailed.

> **Open and close in the step-report shape** (`FORMATS.md` "The step report" — fixed `starting` opening; `Result · Open · Your turn · Next` closing, warm full sentences). Here, *Open / Your turn* typically carry: open questions · gaps needing a ruling.

> **Recommend a new session for the next step** (`grovespec-verify` this draft). The agent that just wrote the draft shouldn't also orchestrate its cold review — start it fresh, clean bounded context (WORKFLOW §5). *(Driving with `grovespec next` in a loop? `@new` already starts that session — this recommendation is for a person going step by step, and it is never a reason to end the loop.)*
