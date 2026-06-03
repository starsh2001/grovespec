# code-to-tree — extracting a tree from existing code (brownfield)

> grovespec-init reads this when the project *has code*. This holds the **method** only.
> The artifact format (frontmatter fields·sections·tree shape) is owned by `.grovespec/templates/FORMATS.md` and the templates — don't copy it here, follow that.

## Big principles
- **Code is the truth.** Even with docs present, look at the code first (docs can be stale — doc handling is in `ref-docs.md`).
- **Be honest to the real structure.** Don't invent an intermediate layer the code doesn't have.
- **Uncertain → mark it as a gap.** Where the code doesn't pin down behavior, don't fill it with a guess — mark it (leave the AC unchecked).
- **Greenfield's "top layer + hypothesis" doesn't apply here.** That rule is about not pre-baking what's *not built yet*. Code is already-built, verified structure, so map it *as-is* (all `done`). If the code is huge, map from the top and dig deeper into a region when you work on it — the reason is *cost·need*, not lack of verification.

## Steps

### 1. Find the entry points → top of the tree
Where execution/use *starts*:
- CLI → each command
- web/app → screens·routes·handlers
- library → the public API (exported functions·classes)
- pipeline/batch → main, the pipeline stages

Where to find them: entry files (main, etc.), routers·dispatchers, public exports, the CLI arg parser.
Root = the whole app (skeleton), with the entry points under it.

### 2. Features under each entry point
Make a feature node for what each entry point *actually does*. If complex, features within a feature (Principle 1). Individual components (a button·a one-line helper) aren't nodes — only down to a *self-contained unit*.

### 3. Find shared modules
A module imported/called from 2+ places → a shared node (confirm the import·call relations with grep).
The test: "without this, can the other nodes not be built *around* it?" → if so, a shared node. If it's a use-once util, keep it inside that feature.

### 4. Extract each node's contract from the code (most important)
So that another node can use this one *without seeing the internals*:
- **What it takes·gives**: from the signature.
- **Invariants**: from the behavior — units, order (does it sort?), empty cases (empty value? exception?), side effects.
- **Make the implicit explicit too**: things obvious from the code but written nowhere (e.g. "amount is a whole-won integer", "load returns an empty list when the file is missing").
- **Responsibility split**: who does validation·locking (this node? the caller?).
- **Mark the gaps**: edges the code doesn't pin down (broken input, etc.) — write them as *undefined in the contract* and leave them unchecked in the AC. Don't fill them with guesses.
- **Watch for bugs**: pin the code's *current* behavior as the contract, but if it's an *obvious bug*, don't freeze it into the contract — flag it in the risks (brief)·Change Log. (Code-first, but don't enshrine a bug as a contract.)

### 5. Fill the meta
- `status: done` — it's already-working code.
- `role`: skeleton if it holds children, feature if it's actual behavior.
- `blocked_by`: the number of a shared node it uses.
- `tdd`: existing code is usually `false` + `tdd_skip_reason` ("existing code, documenting the contract after the fact; tests to follow"). Validation·test gaps go unchecked in the AC·Subtasks.

### 6. Write the tree·Tasks
- `tree.md`: the real structure as-is, by id (don't invent intermediate layers).
- Each node's Task: follow the template/FORMATS for format; here, fill only the *content* (concept·contract), in `config.language`.

### 7. Risks·conventions (code facts only)
- *Global invariants* confirmed from the code (e.g. amount units, time zone) → `conventions.md`. For brownfield, don't leave it empty — facts *the code guarantees* may be written (they're facts, not hypotheses).
- "Where it might break" → `brief.md` risks. Not guesses, only what's visible in the code.

## When done
Return to `grovespec-init`'s last step (human check) — show the brief·tree·contracts to the human and get "right?" confirmed.
