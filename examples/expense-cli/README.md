# expense-cli — a worked GroveSpec example

A finished small project built with GroveSpec, so you can see what *filled-in* artifacts look like. (The templates ship empty `{placeholders}`; this is the calibration target — "what a good Contract/Task/tree looks like.")

It's a tiny CLI expense tracker: `python src/cli.py <add|list|report>`.

**What it demonstrates**
- **A skeleton has its own code.** `TASK-1` (the CLI dispatcher) is a *skeleton*, yet it has real code — the command table + dispatch. Skeletons are not code-free.
- **A shared node + `blocked_by`.** `TASK-2` (storage) is consumed by add/list/report, which declare `blocked_by: [TASK-2]`. Note `blocked_by` holds the *cross-tree dependency* (storage) — **not** the parent. The parent is in `docs/tree.md`.
- **Precise Contracts.** Read `docs/tasks/*.md` to see how much a Contract states (takes · gives · invariants · empty cases) so another node can build against it *without reading the code*.
- **Honest gaps.** Unchecked AC marked `(gap)` record what the code does **not** handle — instead of pretending it does.

**Read order:** `docs/brief.md` → `docs/tree.md` → `docs/tasks/TASK-1.md` (skeleton) → `TASK-2.md` (shared) → `TASK-3.md` (a feature) → then `src/`.
