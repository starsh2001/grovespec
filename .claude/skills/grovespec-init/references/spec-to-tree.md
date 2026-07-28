# spec-to-tree — mapping a detailed spec into an all-sketch tree (greenfield)

> grovespec-init reads this after a **detailed spec** exists (drawn out by `explore.md`, or brought by the user). The greenfield parallel to `code-to-tree.md`: that one maps *code* (reality) into an all-`done` tree; this one maps a *spec* (intent) into an all-`sketch` tree — the structure, not yet the full contracts.

## What a sketch is (and isn't)
A **sketch** is a node placed in the tree with just enough to see the shape: its **name**, a **one-line responsibility**, and its **rough I/O** (what it roughly takes / gives) — `status: sketch`. It is **not** a full contract; that gets written later, one node at a time, by `grovespec-grow` (sketch → draft), reading the detailed spec. The point: lay out the **whole structure cheaply** (50 one-liners fit one session; 50 full contracts don't), then detail each node just before building it.

> Why sketch, not draft: a `draft` is a full contract that `verify` cold-checks. Writing 50 full contracts at init is the "too much in one head" blow-up GroveSpec exists to avoid. The sketch holds the *structure* (the expensive-to-reverse decision, gated by the human at init); the *contract detail* stays bounded — one node per grow.

## Big principles
- **The spec is intent, not truth.** Unlike brownfield (code = reality, mapped `done`), the spec is a *hypothesis* — mapped all `sketch`, refined through the gates. The build will change things; that's expected.
- **Map the whole structure, not just the top.** The detailed spec covers the full scope, so the sketch tree covers it — every node the spec implies, all levels, as one-liners. (For a very large spec, sketch the layers the spec makes clear and let deeper regions get sketched when their parent is built — the tree grows sketches as you go; that's not a contradiction, the tree is always extendable.)
- **Sketch what the spec says, don't invent.** If the spec is vague on a region, the sketch is vague (a coarse node + a noted gap) — don't fabricate detail. grow and verify will sharpen it later.
- **The spec persists as ref.** After mapping, the spec stays in ref/ unchanged — the record of intent. When implementation diverges, the spec stays; the divergence goes in the node's Change Log.

## Steps

### 1. Find the entry points → top of the tree
Read from the spec (same rule as `code-to-tree.md`, but from intent not code):
- web/app → the screens·routes the spec describes
- CLI → the commands
- library → the public interface
- pipeline → the stages

Root = the whole app (skeleton), with the entry points under it. (A *trivial single-capability* tool — one command, one job, no sub-features — can instead have a **`feature` root** that builds itself; not every project needs a skeleton root.)

### 2. Decompose into skeletons and features (the whole tree)
Walk the spec top-down. Each distinct capability with its own eventual contract becomes a node.
- **Stop-splitting rule** (same as `code-to-tree.md`): a node has a *single nameable responsibility* **and** its own contract-to-be. No contract of its own (a button, an inline step) → not a node.
- **Skeleton vs feature** (a hypothesis from the sketch): holds sub-nodes → skeleton; terminal behavior → feature. Confirmed later at implement.
- **Shared modules**: something 2+ features lean on (auth · storage · a data model) → a shared node; record it in the dependents' `blocked_by`. (Same trigger as `code-to-tree.md` step 3, from the spec's described dependencies.)

### 3. Write each node as a sketch (not a full contract)
For each node, fill the Task **thinly**, `status: sketch`:
- **name** + a **one-line responsibility** (Overview).
- **Rough I/O** in the Contract section — a sentence on what it roughly takes / gives. **Not** the full takes·gives·guarantees; that's grow's job. A `[→ detail at grow]` marker is fine.
- **Note the spec's gaps** — where the spec is silent, say so (it becomes an unchecked `(gap)` AC when grow details it — `FORMATS.md`). Don't invent.
- Leave AC/Subtasks mostly empty (grow writes them from the spec when it details the node).
- **Actors & entities** the spec names (employee · hire-date · team) — note which node will *own* each, so the closure isn't lost (verify's C1 + grow check it later).

### 4. Fill the meta
- `status: sketch`.
- `role`: skeleton or feature (a hypothesis — confirmed at implement).
- `blocked_by`: the shared/cross-tree nodes this one depends on (from step 2).
- `tdd: true` (greenfield default; grow can change it when detailing).

### 5. Write the tree · Tasks · conventions
- **tree.md**: the full structure by id, all `sketch`. Indent = depth.
- **tasks/**: one thinly-filled sketch Task per node (template/FORMATS format — all sections present, content thin), in `config.language`.
- **conventions.md**: if the spec states cross-cutting rules (all amounts whole-won · every request authenticated · key terms), seed them now.

## When done
Return to `grovespec-init`'s flow — the sketch tree now goes through the **decomposition gate**:
- `grovespec-verify` on the tree (`target_type: tree`) cold-checks the whole decomposition (D1–D5: scope coverage · system completeness · actor closure · boundaries · depth) → fix → human approves the vetted tree.
- *Then* the per-node build runs top-down: `grovespec-grow` details the next sketch → `verify` (spec) → `implement` → `review` → `done`.
