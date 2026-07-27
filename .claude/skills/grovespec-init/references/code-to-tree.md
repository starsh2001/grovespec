# code-to-tree — extracting a tree from existing code (brownfield)

> grovespec-init reads this when the project *has code*. This holds the **method** only.
> The artifact format (frontmatter fields·sections·tree shape) is owned by `.grovespec/templates/FORMATS.md` and the templates — don't copy it here, follow that.

## Big principles
- **Code is the truth.** Even with docs present, look at the code first (docs can be stale — doc handling is in `ref-docs.md`).
- **Be honest to the real structure — even when it's ugly.** Don't invent an intermediate layer the code doesn't have. If the code *resists* a clean tree (no clear entry point · a god-module doing everything · a circular dependency · dead code), **map it as-is anyway — never fabricate a tidy hierarchy it lacks.** A tree that lies about the code is the drift GroveSpec exists to stop; every later task inherits the lie. Record the structural problem in `restructuring.md` (step 8) instead — the tree stays honest, the fix-direction isn't lost.
- **Uncertain → mark it as a gap.** Where the code doesn't pin down behavior, don't fill it with a guess — mark it (leave the AC unchecked).
- **Map reality, park the defects.** The tree maps what *exists* (all `done`). What's *wrong with* it — bugs · duplications · doc↔code disagreements (node-level), or structural problems (tree-level) — does **not** go in the tree; it's parked as a draft backlog (`findings.md` · `restructuring.md`) and worked off later by `grovespec-revise` (step 8). A backlog gets actioned; a note buried in brief risks gets lost.
- **Greenfield's "top layer + hypothesis" doesn't apply here.** That rule is about not pre-baking what's *not built yet*. Code is already-built, verified structure, so map it *as-is* (all `done`). If the code is huge, map from the top and dig deeper into a region when you work on it — the reason is *cost·need*, not lack of verification.

## Steps

### 1. Find the entry points → top of the tree
Where execution/use *starts*:
- CLI → each command
- web/app → screens·routes·handlers
- library → the public API (exported functions·classes)
- pipeline/batch → main, the pipeline stages

Where to find them: entry files (main, etc.), routers·dispatchers, public exports, the CLI arg parser.
Root = the whole app (skeleton), with the entry points under it. (A *trivial single-capability* tool — one command, no sub-features — can instead be mapped with a **`feature` root**; not every project needs a skeleton root.)
**No clear entry points** (a tangle with no front door)? Map what you *can* (even a flat list) and record the missing structure as a `restructuring.md` item — don't invent an entry-point layer that isn't there.

### 2. Features under each entry point
Make a feature node for what each entry point *actually does*. **Stop-splitting rule:** a thing is a node only if it has a *single nameable responsibility* **and** its own *contract* (inputs/outputs other nodes call). No contract of its own (a button, a one-line helper, an inline step) → implementation detail, not a node. Keep splitting (a feature inside a feature) only while each part still has its own contract.

### 3. Find shared modules
**Trigger: imported/called from 2+ places (grep-confirmed) → a shared node.** (Borderline two-caller utils: the tiebreaker is "without this, can the others not be built *around* it?" — if they can, keep it inline in that feature.)
**Copy-paste duplication** (the same logic *re-implemented* in 2+ places, not a shared module) is different — don't extract it now (init maps, doesn't refactor); park it in `findings.md` (Duplications) for later.

### 4. Extract each node's contract from the code (most important)
So that another node can use this one *without seeing the internals*:
- **What it takes·gives**: from the signature.
- **Invariants**: from the behavior — units, order (does it sort?), empty cases (empty value? exception?), side effects.
- **Make the implicit explicit too**: things obvious from the code but written nowhere (e.g. "amount is a whole-won integer", "load returns an empty list when the file is missing").
- **Responsibility split**: who does validation·locking (this node? the caller?).
- **Mark the gaps**: edges the code doesn't pin down (broken input, etc.) — write them as *undefined in the contract* and leave them unchecked in the AC, prefixed `(gap)` (`FORMATS.md`). Don't fill them with guesses.
- **Watch for bugs**: pin the code's *current* behavior as the contract, but if it's an *obvious bug*, don't freeze it into the contract — leave its AC item unchecked and park it in `findings.md` (Bugs) for a later `revise`. (Code-first, but don't enshrine a bug as a contract.)

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
- **Risks vs findings — don't blur them.** A brief *risk* is *where it might break* (standing danger that shapes future work). A concrete *defect you can already point at* (a bug · a duplication · a doc↔code clash · a structural tangle) is **not** a risk — it goes in the backlog (step 8) with a fix-path.

### 8. Park the findings (brownfield backlog)
Everything the mapping turned up that's *wrong with* the code — gathered from steps 1·3·4 and `ref-docs.md`'s doc↔code check — lands in two draft backlog files (paths in `config.yaml`; **create each only if it has entries** — never an empty file):
- **`findings.md`** — node-level, by section: **Bugs** (→ `grovespec-revise` the node) · **Duplications** (→ `grovespec-grow` a shared node, repoint callers) · **Doc↔code mismatches** (→ a bug, or a "build it" node). Template `.grovespec/templates/findings.md`.
- **`restructuring.md`** — tree-level structural debt (→ `grovespec-revise` split·merge·move). Template `.grovespec/templates/restructuring.md`.
The tree stays all-`done` (reality); these hold the work to make it *right*, and `grovespec-revise` works them off later.

## When done
Return to `grovespec-init`'s last step (human check) — show the brief·tree·contracts **+ any `findings.md`/`restructuring.md`** to the human and get "right?" confirmed.
