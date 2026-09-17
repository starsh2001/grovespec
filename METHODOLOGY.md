# GroveSpec

> Write a rough spec first, build from it, review and fix, then write the next spec. Repeat.

GroveSpec is a development methodology for handing coding work to an AI agent. An AI agent can only hold a limited amount of information at once (its context), so the work is cut into small pieces with defined steps to match.

> **Scope — GroveSpec is for building software.** Its core assumes code: interface *Contracts*, a tree by entry point, tests-first, searching the codebase, spec↔code drift. It is *not* a general workflow for documentation, planning, or other prose work. (Some underlying principles — start rough, cold review, plain language — transfer; the workflow itself does not.)

Off-the-shelf SDD (Spec-Driven Development) tools write the whole spec first, then build. GroveSpec is different. It doesn't write the spec out in full up front — it grows it a little at a time as it builds.

---

## 1. What's different from existing methods

If you sort development methods by how they treat the spec:

- **Off-the-shelf SDD tools**: write the spec out in full before starting to build. The spec is the center; the code is its output.
- **Vibe coding**: build with no spec at all.

GroveSpec is neither. It writes a rough spec first, builds from it, reviews the result to fix the spec, then writes the next spec. It repeats this.

Off-the-shelf SDD tools write the spec once and then don't update it when the code changes, so the two drift apart. GroveSpec reconciles that gap every time, at the review step.

---

## 2. The core idea: detailed but uncommitted

The spec exists from the start, and it starts **detailed** — as a hypothesis. It gets *refined* as you build.

The old fear was that early detail gets frozen and then costs rework. But the problem was never the *detail* — it was the *freezing*. A detailed spec held as the tree's hypothesis (each node `sketch` → `draft`, then verified → implemented → reviewed before `done`) is exactly that — a hypothesis, not a commitment. The build changes things; the gates catch what's wrong.

Without detail, each node starts from a vacuum — the agent either exhausts the user asking for intent, or freestyles. A detailed spec is the source that prevents both: each node has grounded intent from the start, but nothing is committed until it passes the gates.

- **Fine to spec up front — everything**, as long as it's held as a hypothesis. The detailed spec (kept as `ref`) is to greenfield what existing code is to brownfield: the source the tree is mapped from. The tree itself is mapped as **sketches** (structure + one-liners), each detailed into a full `draft` contract just before it's built — so the whole structure is visible cheaply, yet no single session writes 50 contracts.
- **Not fine — freezing detail without the gates.** Off-the-shelf SDD tools freeze the spec before building. GroveSpec sketches the whole tree, details each node to `draft`, and gates it individually. The detail is a starting point, not a contract, until `verify` says it holds.

---

## 3. The spec–implementation cycle

GroveSpec starts with a detailed spec and gates each node through cold review as it builds. Here's that order, compared to off-the-shelf SDD tools.

### The off-the-shelf SDD order

```
finalize the full PRD → finalize the full Architecture → [ story → build → QA ] repeat
```

The PRD and architecture are *finished* (frozen) before building starts. When building reveals they were wrong, changing them is expensive — so they rarely get changed, and the drift compounds.

### The GroveSpec order

```
init:  config (+ brownfield: survey the code → all-done tree → the fidelity gate)
  → plan #0:  explore → intent record (ref) + the whole tree as sketches + per-node refs
  → verify (tree):  cold review of the decomposition → fix → human approve
  → per node, top-down:  grow → verify → implement → review ⇄ fix → done
  → every node done:  plan #N structures the parked work into the next round → …
  → later expansion:  grow ONE new node → the same per-node gate
```

(The step definitions — what each does, with what inputs and outputs — live once, in [WORKFLOW.md](WORKFLOW.md) §1–§2.)

### Rounds — and why init and plan are two skills

The split is by **truth criterion**. init records what *is* — config, and on existing code a *survey* — so everything it outputs can be checked against the machine or the code (which is why the brownfield survey gets a cold **fidelity** gate: the map is an agent's claim too, and every later change computes its blast radius by trusting those Contracts). plan decides what to build *next* — its truth lives in the user's head, so its outputs (intent records, the disposition of parked work) end at human-confirmed gates instead. One principle assigns every artifact *and* its gate; no per-case rules.

The rounds exist because of a deliberate asymmetry: gates block only on defects in their own target — everything else real gets *parked* (followups, the brownfield backlogs) rather than spinning the loop. Parking keeps reviews convergent, but parked work with no scheduled consumer is silent loss; **plan is the consumer.** An all-done tree with parked work routes to plan, which clusters it by family (three nodes parking the same hole = one design decision, not three chores), takes the human's disposition — reopen · restructure · *consciously drop, on the record* — and turns it into the next round of ordinary node work. A finished brownfield adoption and a finished greenfield sprint are the same state (an all-done tree + a backlog), so one pass serves both.

The difference from off-the-shelf SDD: the structure is laid out from the start, but nothing is *frozen* — every node is `sketch`, then `draft`, until it passes the gates. The gates are where reality meets intent: a contract flaw caught at verify is free; a code flaw caught at review is cheap. The build can change things; the spec is a starting point, not a prison.

And the *decomposition itself* gets a cold gate before any node is built — `verify` at **tree scale** (D1–D5): is a whole feature missing (the system scaffolding a domain doc never mentions — settings·admin·audit), is a one-liner hiding a subtree, does an actor have no owner? This is the same cold-review medicine GroveSpec spends on specs and code, finally applied to the structure — the one decision that used to get only a human glance (which, on a real run, let a missing settings screen and a naive approval model through until a human caught them). It's affordable only because the tree is `sketch` (one-liners): a reviewer holds the whole decomposition at once.

The order matters. The spec is verified *before* any code, and the code is gated by *tests* plus a cold review of its *diff*. You don't write code first and reconcile the spec afterward. If the code diverges from the spec: a mistake → conform the code; an intentional change → that's a contract change, done via *revise* (+ Change Log), never a silent edit.

### The three layers of spec

The spec splits into three layers.

- **Brief** — the whole-project overview. Direction·scope·risks. Rarely changes. → `docs/brief.md`
- **Conventions** — implementation notes. Term definitions·common rules·global constraints. Cross-cutting *rules* (e.g. every screen checks auth first) go here too — shared *code* becomes a node (Principle 3), but shared *rules* go in conventions. Filled in as you build: **`implement` records a new cross-cutting rule/term the moment it establishes one, and the root's implement seeds the chosen stack + foundational patterns** — so later nodes read them here instead of re-deriving from code. Only `implement` appends, so this is the one living doc that would grow unbounded — every node reads it, so the cost of bloat is multiplied by node count. A `full` `verify` therefore **prunes** stale entries as part of its Resolve step: appending and pruning are deliberately split across two skills, so the writer is never its own editor. → `docs/conventions.md`
- **Per-Task spec** — each node's concept (intent·requirements·contract·AC) in one file. → `docs/tasks/{node}.md`

Greenfield adds a fourth, *frozen* source beside these living layers: the **intent records** in **`ref/`** — plan #0's detailed spec, then one dated record per later planning pass — the full body of intent that `grow` details every node's contract from (it is to greenfield what existing *code* is to brownfield). The **brief is the lean current summary** (direction·scope·risks, human-confirmable at a glance); the records are the detail — and the history — behind it. Both come from the same exploration at plan #0, and later plans add records (never edit one) while amending the brief only when scope truly changes. Plan assigns each node exact current headings in Task `refs` while the whole tree is visible; grow preserves that assignment instead of rediscovering its own source. So intent flows **ref records → brief (current summary) + tree-wide `refs` assignment → per-Task contract (written by grow)**, with Conventions holding the cross-cutting rules throughout — three non-overlapping memories: *brief = now · ref = the history of intent · Change Log = each node's history*.

---

## 4. The four principles

All four principles below come from the idea in §2 — spec everything as a hypothesis, gate each node before committing.

### Principle 1 — Split into a tree by entry point, and split a feature further if it's complex

Split the work into a tree. This tree is **split by entry point (screen·command), not by dependency**. For a UI app the screens are the natural entry points; for a CLI it's the commands.

**Skeleton** — laid out top-down by entry point. The top skeleton sets the overall structure, and you go down screen by screen, command by command.

**Feature** — at the bottom of a skeleton, where the actual behavior is built. If a feature is complex, split it further into child features — a feature can contain features. Where to stop: "is this a self-contained unit?" If it's simple, leave it; if complex, split further. Individual components (buttons·dropdowns) are not nodes — they're details decided when you build the feature (Principle 2).

When a feature needs to be shared, you don't design it up front; you split it out as shared when it's discovered (Principle 3).

Stand up the top skeleton first, top-down, and dig one layer deeper at a time. Because a parent skeleton lays out the structure its children will slot into, and the children slot in there, **there's no later step where you merge things back together.**

**The tree is a hypothesis, not a fixed design.** It's drawn whole at init (all `sketch`), but nothing is *committed* until each node passes the gates (verify → implement → review → `done`). `grow` details each sketch into a `draft` contract just before it's built; when building reveals a planned node was wrong, you *revise* or drop it — a `sketch`/`draft` costs near zero to change. Later, `grow` also expands the tree beyond the initial spec.

**The tree structure is written separately in `docs/tree.md`.** It's a file that expresses the tree shape with Task numbers only (→ §5). The structure is recorded here so you don't have to re-derive the tree from the code every time.

The relationship between code and tree isn't that one is the permanent original. **Which one is the truth is decided by the point in time.** At first, with no code, the design (tree) is the truth; when building forces a design change, the code side fixes the tree. Once they exchange once, that node converges (the corrected tree doesn't push back on the code again). Leaving the two out of sync would throw off the next task, so you update them together every time you work (the skill enforces this). As long as design and implementation exist separately you can't eliminate drift entirely, but reconciling every task keeps it far smaller than writing once and walking away.

### Principle 2 — Decide the place early, decide the how as late as possible

What gets exchanged (the interface) is decided early. It's big-frame, so it rarely changes. How it's built (libraries, tech stack, component layout), on the other hand, is decided as late as possible.

The how reveals itself as you build. Decide it early and it's just a guess. A structure set wrong by a guess is worse than nothing. What you didn't build, you can build later; but a structure built wrong forces every later piece of code to route around it, and it keeps snagging.

This is also the spec's **scope rule**, and the line is **what a consumer can observe** — not a topic list. A node's *Contract* states what it **takes · gives · guarantees**: the public names consumers call, the shape of what crosses the boundary, error behavior, ordering, and any atomicity or concurrency promise a consumer can *see and rely on*. What stays out is the unobservable inside: algorithms, private structure, a store's internal schema, how a transaction is implemented. The same topic can fall on either side — "the file is valid JSON after every add" is contract (a consumer reads that file); "writes go through a temp-file rename" is mechanism. A skeleton still defers most detail with `[→ child/deferred: …]` markers — an observable that a *child* will own belongs in that child's contract, and pinning it into the root early is the over-specification that makes verify churn. So an unspecified mechanism or a deferred child-owned edge is **correct delegation, not a gap** — `grovespec-verify` enforces this.

### Principle 3 — Sharing has two sources: visible at design time → up front, accidental overlap → extract after discovery

Sharing has two sources. There's one test to tell them apart — **"without this, does the tree shape break?"**

- **Structural shared things visible at design time** (like auth·core domain — things without which other nodes can't be built *around* them) → make them shared nodes from the start. They're structure, not a guess, so they're part of the structure the skeleton lays out.
- **Accidental, miscellaneous shared things** (utils like a date format) → don't split them out early. While building, when you notice "oh, this is the same as the one over there", extract it then.

The reason for not splitting accidental shared things out early is the same as Principle 2. Until the same code is used a second time, you can't tell whether it's really common code or code only that feature needs. Splitting early is a guess, and if the guess is wrong, the mis-grouped code keeps snagging. Extract after seeing the real overlap and that doesn't happen.

When to extract: **the rule of thumb is around the third time the same code shows up** (two isn't enough to be sure). For obvious duplication, earlier.

> Note — "I'll probably use it again" is a guess, not structure. Extract early only for *laying out structure*; for *plain reuse*, wait until it's discovered. Otherwise the bad abstraction Principle 2 was trying to prevent comes right back.

The "find it then" method is grep (searching the whole codebase for a particular word). Before writing a new feature, search the existing code for what's related — reuse it if it exists, build new if it doesn't (→ the reason you must force this search when handing it to an agent is §8).

### Principle 4 — Pull only the visible risks forward

Most of the spec reveals itself as you build, but some risks are already visible at the start. Pull only those risks out early and write them in the risks section of `docs/brief.md`.

> **What to put in**: only the *risks* that are visible up front. The test — **leave out anything that says "what to build", put in anything that says "where it might break."** "The profile should have name and email" stays out. "Payment and inventory totals can drift out of sync" goes in.

Written down this way, just before you make a Task related to that risk you can check it and build it right from the start. Only the risks are written up front; the rest of the spec still reveals itself as you build, so this doesn't conflict with Principle 2.

---

## 5. Task — the tree's unit of work

Each node in the tree becomes a **Task** file on disk (`docs/tasks/{node}.md`). A Task holds a node's *concept* in one file — Overview·Requirements·Contract·AC·Subtasks·Change Log (status·blocked_by etc. are frontmatter, not body sections). What the code looks like is in the code, not the Task.

### One kind, two roles

**There's only one kind of Task.** No tier names like epic·story. Every Task, wherever it sits, is the same kind, and by its tree position it takes **one of two roles**:

- **Skeleton role** — holds what's below *and* builds its own structural code: the container, the interface, the dispatch/glue children slot into (a screen's layout, a CLI's command table, a module's public interface). A skeleton is *not* code-free — it's implemented like a feature. **The root skeleton's structural code is the base environment + an empty end-to-end runnable shell** — the project *stood up* (stack chosen, build/run wired) so it actually runs while doing nothing: a blank page that loads, a server that boots, a CLI that prints help. Nothing exists below the root yet, so standing up that runnable shell is the root's *own* build (no feature logic — those are the children); **the tech stack is chosen here.** Whether a node *is* a skeleton, and what its children are, is **confirmed when it's implemented** — its sketched children reconciled against the build (keep / drop / add), recorded as its decomposition in the Change Log; each child is then detailed (`grow`) one at a time, after it's `done`.
- **Feature role** — builds the actual leaf behavior. If a feature is complex, split it into smaller features inside (Principle 1).

Individual components (buttons·dropdowns) are neither, so they're not Tasks — they're details decided when you build (Principle 2).

Off-the-shelf SDD tools split work into multiple kinds, like epic·story. GroveSpec keeps a single kind; hierarchy lives in tree.md (below), and `blocked_by` records only *cross-tree dependencies*.

### Blocking: `blocked_by`

Two things must be done before a node can start: its **parent** (which lays out the structure it slots into) and any **shared node it consumes** (e.g. auth, storage). The parent is already in tree.md, so `blocked_by` holds *only the second kind* — the cross-tree dependencies, **not the parent**. A node is unblocked when its parent (from tree.md) is done **and** every node in its `blocked_by` is done. The work order falls out as "start from the nodes that just got unblocked."

> **How to record it**: `blocked_by` = the shared/cross-tree nodes this one depends on — usually `[]` for a leaf. Don't put the parent in (that's in tree.md). grow sets it when a node it defines consumes a shared node.

### Position is held by `docs/tree.md`

Where each Task sits in the tree is written in `docs/tree.md`, not in the Task file. tree.md draws the tree shape with Task numbers only:

```
- TASK-1
  - TASK-2
    - TASK-4
    - TASK-5
  - TASK-3
    - TASK-6
```

Why numbers only — a node name can change (rename) but the number doesn't. Link by name and you'd have to fix tree.md on every rename; link by number and you don't touch it. Each number points to `docs/tasks/TASK-N.md`, and the node name lives inside that file.

When a human needs to see the tree at a glance, just ask the agent to lay out the current tree state then. Don't put human-convenience information into tree.md itself.

**Changing the structure (add·delete·move·split·merge) is done by editing tree.md.** Because the structure is managed in one place, moving or deleting a node doesn't require touching multiple files.

### Task file format

A Task (`docs/tasks/TASK-N.md`) is YAML frontmatter + fixed sections — `Overview · Requirements · Contract · AC · Subtasks · Change Log`. The exact fields·types·order are the parser contract, fixed in `.grovespec/templates/FORMATS.md`, with a fill-in template at `.grovespec/templates/task.md` — not reprinted here, to keep one source of truth. Headers and field names are English; the *content* is written in `config.language`.

There's no `parent` in the frontmatter — you read the parent from tree.md, so the same information isn't kept in two places.

### Non-functional requirements (performance · security · reliability)

GroveSpec keeps no separate NFR document — NFRs live where they bite:
- *Global* rules (e.g. "every request is authenticated", "all amounts are whole-won") → `conventions.md`.
- *Per-node behavioral* invariants (units · order · empty cases) → the node's **Contract**.
- *Measurable targets* (latency · throughput · error rate) → the node's **AC, written as checkable items** ("- [ ] p95 < 200ms @ 100 rps"), so a test or the review can verify them rather than waving at vague prose.

Security and reliability are also actively probed by the review's *breaker* and *security* personas. NFRs are first-class *content*, just not a first-class *file* — keep them measurable, and put them where the work touches them.

### It doesn't matter where it was made

A Task is a markdown file on disk. Whether a human wrote it by hand or an external tool converted it, it works the same as long as the format matches. GroveSpec only defines the file format and the rules; it doesn't know external tools exist.

### Changing an already-done node

Because structure (tree.md) and content (Task) are separated, there are two kinds of change.
- **Behavior change** — reopen the node (to `draft` if the spec/contract changes, else `approved`) and fix it. *If the contract changed*, find the nodes that use that contract (grep+tree) and re-verify·re-review them (propagation).
- **Structure change** (split·merge·move) — edit tree.md.

The procedure is in [WORKFLOW.md](WORKFLOW.md) under revise.

---

## 6. The per-node gate

Every node goes through the same gate, starting once its parent is `done`:

```
grow (sketch → draft) → verify (→ approved) → implement (→ implemented) → review ⇄ fix (→ done)
```

The procedure — what each step does, in what order, with what inputs — is defined once, in [WORKFLOW.md](WORKFLOW.md) §2–§3 and the skills. What belongs *here* is why the gate has this shape:

For an all-mapped no-ref tree, the criterion remains code through both spec and result lifecycle records. A gate file is bookkeeping, not a source assignment: only adding an actual `refs` coordinate or a non-mapped node activates intent ownership. The catalog roster/material is still observed as a tripwire, so new intent cannot appear invisibly behind that boundary. This keeps an ordinary mapped Contract revise from invalidating the already-approved fidelity tree merely because its verify record appeared; if intent is now in scope, revise must assign its exact `refs` and take the resulting tree gate explicitly.

- **Pre-check before building** (risks · conventions · search existing code — inside `implement`). A person carries "I think I've seen this before" into every task; an agent, isolated to what it sees, doesn't — so the look-around is forced as a step (→ §8). Building with the risks and the existing code in front of you is what makes the risky parts come out right the first time and keeps duplication from arising.
- **Tests first.** Written from the AC while there is no implementation, they fail — and become the fixed target the build must hit, instead of a moving one. Nodes that resist up-front tests (exploratory prototypes · UI · hardware-dependent checks) may skip, with the reason recorded in the Task (`tdd_skip_reason`). Because TDD is decided per *node*, one project can mix both — an unplanned strength of the tree structure.
- **Building confirms the decomposition.** The sketched children were a hypothesis; building the node is what reconciles them against reality (keep · drop · add) and confirms its `role`, recorded in the Change Log.
- **Two cold reviews, on different things.** verify checks the *contract* before any code exists — a flaw caught there is free; caught after building, it costs the build. review checks the *code* — the tests are the deterministic spine, and the cold reviewers read only this node's diff, which is what keeps review cost flat as the project grows. review never re-asks spec questions; verify settled those. (A third, once-only cold review runs at init on the whole decomposition — §3.)
- **verify holds the yardstick against its source** (introduced in v0.9.5; machine enforcement shipped in v0.11.0, whose fixed-seed rerun it finally passed). Every gate after grow reads the Task as its criteria — implement builds to it, review tests against it — so a draft that silently *narrows* its ref intent is invisible to the rest of the chain: each later eye faithfully checks the narrowed text. Proof run #5 (Sonnet 4.6) shipped exactly this in `today`: ref §1 made goals the primary use, §4 said a day with no record is still a 0-minute goal result, and §5.4 said `today` shows goal result + streak, yet the draft narrowed rows to tags with records and every later gate passed. v0.9.5 added C1's ref→draft map, but one replay still lost the decisive §4 sentence in the caller's summary. A first coordinate/table candidate also failed its fixed-seed diagnostic (`Detected=false`, `Carried=false`, `Bound=false`): C1 misclassified the behavior as delegated, the main session dropped its row while copying, C3 called the narrowed wording implicit handling, and the promised join never ran. The lesson is narrower than “better prompting”: prose cannot prove which source belongs to a node, that every source row survived transport, or that an anchor still means what its label once meant. The current candidate moves those facts into machine bindings. First, plan writes each Task's exact current heading set in structured `refs`; tree D1 reviews the source→node map, and `pin tree` seals the current catalog, every catalog/assigned section's canonical material, and the node assignments as `source_scope_digest`. An all-mapped, all-empty-scope fidelity tree keeps code as its criterion, while catalog roster/material remains an observed tripwire; an actual ref assignment or non-mapped node activates ownership. The tree cycle writes its explicit `tree_evidence_mode` before round 1 and pin seals the **rest of the mode-specific reviewer substrate** as `tree_evidence_digest`: brief + sketches for decomposition, mapped Task claims + code + backlogs for fidelity. That closes both mode loss after interruption and the gap where the source map stayed fixed but the one-line responsibility, rough Contract, or surveyed code changed between the cold pass and human approval. Second, target-only `grovespec source TASK-N` derives that assignment itself and emits one shared packet whose stable clause ids include canonical heading paths; its source digest also binds selected/nested heading context, excluded `(gap)` candidates, and fenced body, keeping explicit no-ref distinct from assigned-but-all-gap. Third, spec `pin` refuses missing/unfilled/incompatible rows and seals not only basis labels but the current content they resolve to; spec and result pin also bind the Task frontmatter during the pending decision window. Every seal is write-once per cold cycle, and `approve`/`validate` recompute current pending evidence instead of allowing re-pin to bless changed bytes. Result gates require a clean reviewed project input for both human and machine decisions — the project outside the current Task/evidence/run lock, plus a nested-repository Task's historical footprint — rather than only src/tests. These invariants structurally prevent caller-chosen scope, dropped-row, skipped-join, stale-heading, stale-assignment, newly invisible intent, old-approval rebind, same-label/different-anchor-content, tree-review-substrate swap, and unreviewed build-input failures. They still do **not** prove the model's semantic judgment: a reviewer can point `carried|handled` at a real but insufficient Contract/AC line. The fixed-seed external rerun remains required before release, and repeated runs remain required before calling the result stable. **That rerun is what caught the residual, and it took two more turns of the screw.** First the oracle itself was wrong: it refused `found: { … }`, the one-line flow map `templates/review-state.yaml` mandates, so every judge round read as an unparsable record and three campaigns failed on a format the product prescribes — an oracle that contradicts the artifact it grades measures nothing. With that fixed, the real defect stood alone and was exactly the predicted one: the packet delivered §4:8 (*a day with no record is 0 minutes*) verbatim, the coherence lens dispositioned it `carried`, and its anchor — *today's total is computed by `dailyTotals`* — was a real Contract line on the right topic. The case still never reached output, because a **different** line, the row set (*tags with a record today*), had already excluded it. C1 had been asking **presence** (is this topic handled somewhere?) where the narrowing lives in **reachability** (does this case reach what the source says must be observable?), and a topically-correct anchor satisfies presence forever. So `carried` now owes a one-line walk — `c1_case: <condition> -> <observable>` — anchored on the line that **admits the case into the output**, not the line that handles its topic; a selection line that excludes the case makes the disposition `divergence` or `missing`, never `carried`. The runtime refuses a `carried` without its walk. On the next rerun the same cold lens named the filter itself (*ref §5.4's intent and the Contract's 'tags with a record today' filter diverge*) and the clause landed in Contract and AC: `Detected · Carried · Bound · Valid` all true. The check stays bounded the way C5's Stop rule taught: only this node's assigned clauses, `(gap)` candidates excluded from dispositions, presence-or-deferral only — never a demand that AC measure each one.
- **The review bar is *sufficient*, not exhaustive** (adapted from BMAD's PO *validate-story*). A flaw counts only if a competent implementer would be **blocked or build the wrong thing** — named, along with the decision they can't make. Without that bar an adversarial reviewer finds unbounded plausible flaws and the loop never converges; a real run took 14 rounds before it was added. It is deliberately two-sided: a check passes only when a reviewer **shows** it holds, so leniency on imagined edges cannot slide into rubber-stamping an under-specified spec.
- **Both cold reviews default to *subtract*.** verify already did: an unspecified detail gets a deferral marker or a cut, never a new clause, and *a skeleton Contract that grew this round is a smell*. review and fix now do too, because the same ratchet runs on the code side — each fix enlarges the diff, the enlarged diff is the next round's input, and new code has no track record, so a rigorous cold reviewer always finds something in it. A proof run spent **six consecutive rounds** that way on a 106-line CLI: the node's product code never moved, while its test scaffolding grew to 4× the product and every round found real-but-marginal flaws in the scaffolding the *previous* round's fix had added. Hence: prefer removing over adding, report the fix's net line delta, and when a round's findings all sit in code the last fix introduced, **revert it rather than fix forward**.
- **The severity gate is where the loop actually terminates.** Reviewer capability sets how *many* findings appear; severity sets whether they *stop* the loop — and only the second one controls convergence. So blocking requires an answer, not a story: can the failure be exhibited in code that **exists today** (an unbuilt consumer is a prediction), does it break something the contract **explicitly promises**, is there a documented workaround. Whatever a gate lowers **stays** lowered — hunting a fresh justification to hold a level is the main leak, and it is the one a capable reviewer is best at. The blocking list is ranked and capped, because labels are unlimited and a ranking is not. In the same proof run these gates cut a round's blocking findings from **3 to 1** on identical input.
- **The cycle terminates on lists, not verdict streaks** (v0.8.0). The old terminator — pass `repeat` rounds in a row — made every round an independent coin flip that reset on tails: proof run #3 measured 46 cold rounds for two `done` nodes of a 364-line product, one 13-round code review among them whose passes at R4·R6·R8 were each broken by the next round's fresh eyes. What those late rounds *found* exposed the real variable: a genuine data-loss defect survived 8 rounds and 205 planted mutations because every lens swept one axis at a time and the defect lived in a two-axis cell — **recall is bought by strategy diversity, not by more identically-armed rounds**. So the cycle runs **find → judge → fix**: find sweeps the *frozen* target in cold waves, each wave handed the **found list** (*don't re-report* — 109 of the run's 125 triage verdicts were drops, many re-killing an already-killed shape) and a **strategy ledger** it must exhaust (`repeat` survives as the minimum wave count — its recall duty); judge grades everything **once**; each fix is confirmed against **its own diff**. Cold stays cold where it matters: a finder still never sees how the target was built, the author's reasoning, or any clean-claim — reviewer *output* travels; innocence claims don't. And the one checklist item with no finite positive proof ("readable in one pass") blocks only on a shown FAIL, because demanding positive proof of a negative made reviewers invent grounds — the proof run failed three zero-blocker rounds on sibling-relative length metrics while the round that finally passed measured *worse* density. A round budget is no brake if it can be raised on *"one more should settle it"* — raising `max_rounds` now requires naming what the next round would **learn**, and in the proof run a triage handed that rule declined its own next round. And `implement` has to **run the thing** once and paste the output: twelve review rounds went by before anyone started that CLI, which prints one line saying it has no commands yet — the fact that would have reframed every one of them.
- **Concern for an unbuilt child is over-reach too.** The scope rule catches *"I'll decide X for the child."* Its twin — *"the child would stumble here, so this node must build scaffolding"* — invokes the child instead of deciding for it, so it reads as protecting them and slips through. A third — *"I'll write the rule into the child's Task so they can't get it wrong"* — reads as the most responsible of the three and is the only one that **cannot terminate**: the edit lands in *this* node's cycle diff, so each fix hands the next cold round a fresh page of prose to find holes in, and prose specifying a mechanism can always be found under-specified because the check that would settle it can't exist until that node is built. A proof run showed the shape plainly — the child's Task file was edited eight times, **six of them by the parent's commits and never once by its own work**, and the parent's last five rounds all ran on that one planted line while its product code had not moved in nineteen. So this is fenced mechanically, not just discouraged: `fix`'s write-scope covers another node's **Task**, not only its code. What the node genuinely learned still travels — a global rule to `conventions.md`, the measurement to its own record — and the unbuilt node reads it on its own turn, when it can answer with a test instead of a paragraph. All three spend this node's budget on a consumer that doesn't exist yet; all three are dropped.
- **Closed decisions are remembered — in the gate record, not the Task.** Cold reviewers have no memory of earlier rounds, so a call once made would be re-litigated forever; the dropped-as-nitpick · accepted-gap adjudications carry it forward, each with its written reason. They live in the node's review record, and `reopen` preserves them across cycles — what a reset wipes is *evidence* (rounds, open issues, the pass itself), and a settled call is not evidence but a boundary, which a new cycle doesn't expire. They are deliberately **not** copied into the Change Log: the reviewers' criteria come from the Task file, and a proof run showed the copy failing at scale — 22 rounds left 134 settled calls against a Task already at 126KB, so the copy would have handed every prior verdict to precisely the reader whose blankness the method depends on. The reason field is what keeps a kept call honest: when a reopen changes the contract, entries whose reason leaned on the old contract are pruned before the next round — a dead reason must not suppress a now-real finding.
- **The filter must sit before the cost, not after it** (v0.11.0 — measured on a proof run: a Windows tray launcher, 19 nodes, 295 commits in 7 days, 81% of them touching no source). The severity gates and the defender worked as designed there — of ~350 raised findings, 301 were dropped and almost none forced a wrong repair — but every drop was paid for *first*: raised by a finder, graded by the judge, some re-raised across waves and cycles and re-struck by hand. Four rules move the filter upstream, each from a measured leak:
  - **Verdict records travel itemized.** Condensing adjudications into do-not-raise *categories* leaked — the same claim re-entered as a "new" finding until a judge re-struck it ("남겨 두면 라운드마다 같은 모양이 다시 올라온다" is a live quote from that run's judge files). Finders now receive the adjudicated list itself: claim + verdict + reason. This does not breach the clean-claim ban — a verdict record settles one claim, never an area; what it kills is regeneration, not recall.
  - **The parked pool has an entry bar** (gate1 `behavior`|`mechanism`; `validate` enforces). The pool is the next planning pass's mandatory reading: the run's first cleanup round read 87 parked items and dispositioned 76 of them to death. A contrived/story keep is recorded as an adjudication and re-enters only as live measurement — the same promotion rule known-issues already had.
  - **A confirmation's out-of-scope finds park instead of chaining.** Each closing lap could open the next — confirmation → neighbour-find → fix → confirmation, for rounds. Live evidence (gate1 `behavior` / gate2 `yes`) still extends the cycle; a colder suspicion joins `followups` and waits its turn.
  - **Three cases is a class.** One cycle case-patched a single family through 12+ fix laps — a pattern-blocklist re-pierced each round — because "block the cause, not the demonstration" was advice, not arithmetic. The third fix aimed at one family now stops the case-work: close the class structurally or escalate with the family named.
  And one rule bounds the propagation tax: a consumer reopened only by a contract change, whose enumerated use-sites the change never reaches, reviews at `skip` on its empty diff — the run's zero-line re-check had paid a five-commit full cycle whose single blocking finding attacked the evidence prose itself.
- **A deterministic floor under the gates.** The runtime owns the *bookkeeping facts* — what a node's diff is (`diff`), whether the tests ran, how they exited and on which commit (`test`), whether a status has the passed gate records that let it advance and *who decided them* (`validate`), whether the bytes a gate passed on are still the bytes (`pin` seals at the pass, `approve` verifies them before flipping any state), what skipped the skills entirely (`fresh`). The agent's judgment is spent on meaning; a fact a session could misreport is recomputed, never trusted — the gates judge *whether the work is good*, the floor guarantees *what the work even was*.

---

## 7. Starting situations

There are several situations you start GroveSpec from. The initial prep differs by what you start with.

| Starting situation | What you have | How to build the tree | ref |
|---|---|---|---|
| Blank slate | just an idea | plan #0: explore → intent record → all-`sketch` tree + per-node `refs` | the record (produced at plan #0) |
| Rough spec | simple requirements | plan #0: explore fills gaps → intent record → all-`sketch` tree + per-node `refs` | the record (produced at plan #0) |
| Detailed spec | a detailed spec doc | plan #0: fill gaps → all-`sketch` tree + per-node `refs` | the spec doc |
| Existing code only | source code | init: code-to-tree → all-`done` tree → fidelity gate | none |
| Existing code + docs | code + spec doc | init: code-to-tree → all-`done` tree → fidelity gate | the spec doc |

The key — **whatever you start with, it all converges on a Task tree.** Once the tree is built, the per-node cycle (§3, §6) is the same in every case. Only the starting point differs.

### The tree is mapped whole, not grown one step at a time

Greenfield maps the **full tree at plan #0** (init readies the vessel; the first planning pass lays the tree) — all `sketch` (structure + one-liners + exact per-node `refs`). The old "one node at a time" rule tried to avoid baking unverified assumptions, but created a vacuum: each node started from nothing, so the agent either exhausted the user asking for intent, or improvised. The fix isn't to avoid detail — it's to mark it as a *hypothesis*: the whole structure and source assignment are sketched cheaply and tree-verified, then `grow` preserves each node's assignment while detailing it into a `draft` contract, which goes through verify → implement → review before becoming `done`. Any node that turns out wrong is revised or dropped at near-zero cost (a sketch isn't a contract commitment, though changing its sealed source assignment reopens the tree gate). Writing all the *contracts* up front would be the "too much in one head" blow-up GroveSpec exists to avoid — so the contract detail stays bounded, one node per `grow`.

The detailed spec — produced by explore or brought by the user — is kept as **ref** (reference docs). It's the record of "this is what we meant to do." When implementation diverges, the spec stays as-is; the divergence goes in the Task's Change Log.

### ref is kept as the original

ref is kept exactly as it came in and is not edited. ref is the record of "this is what we meant to do." **Greenfield, GroveSpec itself *authors* the records (plan #0's spec, then one per planning pass) — but each, once written, is frozen exactly like a brought-in doc.** The series rule keeps history without contradiction: a later plan **adds** a dated record whose sections *name what they supersede* — it never edits an old one — so every shift of intent stays on the record. If the *intent itself* was captured wrong, that's a re-`explore` in a new record, not a silent in-place edit.

If building diverges from ref — leave ref as-is and record the divergence and its reason in that Task's Change Log. This keeps all three: the intent and its history (ref), the actual implementation (code and spec), and why they diverged (Change Log).

Make a location map once at the start (`ref/index.md`) — what's where — and you don't have to read the whole of ref every time. The records don't change; **the index moves**: when a later record supersedes a section, its Topic row points at the new record, so readers reaching ref through the index always read current truth.

### If there's code, code comes first

When there's existing code, build the tree from the code. Even with a spec doc alongside, look at the code first. The spec doc may have drifted from the code — stale, or not built as first planned. Code is "what actually is"; docs are "what was meant to be." So build the tree from the code, then keep the spec doc as ref and reference it only for intent or risks.

This is why off-the-shelf SDD tools are weak on existing projects. With no design doc, you have to reconstruct the spec backward from the code, and in that process an AI easily fabricates things that aren't true. GroveSpec doesn't reconstruct — it searches the code as it goes (Principle 3) — so it doesn't have this problem. And it maps the code *honestly*, all `done`, even where the structure is poor: what the mapping finds *wrong* — bugs, duplications, doc↔code disagreements, or a structure too tangled to tree cleanly — isn't forced into the tree (that would make the tree lie about the code), but parked as a draft backlog (`findings.md` for node-level, `restructuring.md` for tree-shape) that `plan` structures into rounds (`revise` executes; a single item can go straight there). And because the survey is itself an agent's claim, it gets the same cold medicine before anything trusts it: the **fidelity gate** (verify-tree F1–F4, criteria = the code) — coverage both ways, contracts matching real behavior, no beautification, the backlog honest.

### Paths are changeable

An existing project already has its own doc structure. Change the default paths (`docs/...`) in `.grovespec/config.yaml` to wherever you want and GroveSpec works there. But only the location (path) is changeable; the structure isn't. The brief is one overview, tasks is one file per node, each Task has a `blocked_by` — this structure is fixed.

> Detecting the case above and the prep for each is handled by the entry skills (`grovespec-init`, handing to `grovespec-plan`). This document only settles "why it's divided this way"; the concrete procedure lives in the skills.

---

## 8. What to shore up when you hand it to an agent

When a person does it directly it rolls along naturally, but handing it to an agent has leak points.

**A person, while building, naturally notices "oh, this is needed over there too." An agent, isolated to what it sees at once, can't.** At the moment the same thing is needed a second time, if the first isn't in front of it, it doesn't even know there's an overlap. So it falls into "build it new again, unaware" instead of "find it and share."

The fix isn't to pre-build the shared code. It's to force a look at the first piece of code right before writing the second. The extraction point stays late, but the fact of overlap isn't missed. This is why §6 has a pre-check:
1. Pull the key words from what the Task is trying to do.
2. Search the source code + `docs/tasks/` + existing Tasks for those words.
3. Put the matched existing code·notes in front of you.
4. Answer "reuse, or write new?" clearly and proceed.

Success rides on two things.
- **Use the same word for the same thing**: search finds letters, so the same concept must always use the same word to get a hit. A person catches it by meaning even if the word differs a bit, but an agent can't — instead, an agent searches diligently and consistently. As long as the words are unified, the agent actually misses less.
- **Force the search every time**: a person's "I think I saw this before" hunch is replaced, for an agent, by the rule "at this step, always search first."

---

## 9. Distribution form

- **Target**: Claude Code and OpenAI Codex.
- **Form**: one byte-identical set of per-step skills, installed under the host's discovery path (`.claude/skills/` or `.agents/skills/`), + a light config (`.grovespec/`). The unit is not "whose role" but **"which step"** — divided by step, not by role. The eight skills (init·plan·grow·verify·implement·review·fix·revise) and how they're divided are in [WORKFLOW.md](WORKFLOW.md). A ninth, `grovespec-next`, is a *driver* rather than a step: it runs whichever step is due and stops, so the build can be repeated from a script without a person tracking what comes next. It adds no methodology. By default it stops at the human's gates; its opt-in auto mode may take one that came out clean — but then the record says a **machine** took it and every later run resurfaces it until a person ratifies. That distinction is the whole point: a gate an agent can take on your behalf *silently* is not a gate, while one it takes *on the record* is a stated trade — the cold review still ran, the intent check didn't.
- **The methodology is built into the skills.** Each step's skill carries its own guidance and reads only the files it needs, at the time, from the paths config points to.
- **The unit of work is a markdown file on disk** (§5). It's not tied to a particular issue tracker or API; a board·IDE just reads these files and displays them.
- **Install**: copy `.grovespec/` and the matching skill tree — `.claude/skills/grovespec-*` for Claude Code, `.agents/skills/grovespec-*` for Codex, both for a dual-host project (an `npx grovespec` installer is on the roadmap).
- **Design principle**: GroveSpec itself follows §2 — fix as little as possible. It enforces only the order of steps and the gates, and leaves what to build within each step blank. Off-the-shelf SDD tools get heavy because they make you fill in templates with no blanks left. GroveSpec sets only the steps and leaves the content blank. How finely to split, how detailed to write the spec — these aren't set by rule. The agent follows the default approach ("skeleton or feature, don't go down to the component") but adjusts to the situation.
- **Rules live in the skills; *why* lives here.** A skill doc is read on every run and instructs an agent, which needs the *what*, not the justification. Attribution, the history of a decision, and "this is why we changed it" belong in this document. A skill doc that argues with its reader has stopped being an instruction.
- **The host split ends at discovery.** Claude Code and Codex look in different directories, but a GroveSpec step must not acquire two meanings from that filesystem detail. The two checked-in trees therefore have identical bytes and host-neutral wording; `doccheck` rejects drift, and `version` hashes either one under the same logical path. A dual-host install that disagrees is not assigned an arbitrary winner — its fingerprint is refused. This keeps one methodology while still letting each host use its native skill discovery.
- **Subtraction gate.** Skill docs are only ever patched *additively* — each review round closes a leak by adding a sentence and bolding it, and nothing ever proposes a deletion, so density climbs until the load-bearing rules are indistinguishable from the caveats. So: **before a version tag, if the skill bundle grew since the last tag with no removals, run a pass that may only merge, cut, or move rationale into this document — never add.** The size check uses the canonical `.claude/skills/` tree (`git ls-tree -r -l <tag> .claude/skills/`); `tests/doccheck.sh` separately requires the Codex twin to have exactly the same bytes.

---

## Appendix A — the comparison at a glance

| Aspect | Vibe coding | GroveSpec | Off-the-shelf SDD tools |
|---|---|---|---|
| Spec exists | No | Yes | Yes |
| When the spec is known | — | structure at init (sketched); each contract detailed per node, gated | all fixed before start |
| Where the spec lives | — | inside the cycle (each node gated individually) | outside the cycle (fixed once) |
| How far the spec leads the code | 0 (not written) | the whole structure (sketched), contracts detailed as you build | all up front (frozen) |
| Unit of work | none | one kind of Task, two roles (skeleton/feature) | epic ⊃ story (multiple kinds) |
| How it's split | — | by entry point: skeleton + feature (components are out) | — |
| How hierarchy is expressed | — | tree.md (parent-child) + `blocked_by` (cross-tree deps) | kind separation + separate docs |
| Shared code | ignored | structural up front, accidental extracted on discovery | up-front architecture doc |
| Source of tree structure | — | tree.md (point-in-time synced with code) | separate design doc |
| Green/brownfield | — | same way | diverges |

## Appendix B — directory layout

```
project root/
  CLAUDE.md / AGENTS.md    # the user's host instructions — GroveSpec neither reads nor writes them
  src/                     # code = where the tree's real structure lives
  docs/                    # ── project assets (everything that survives removing the tool) ──
    tree.md                #   tree structure (Task numbers only). Always synced with the code
    brief.md               #   the whole-project overview (direction·scope·risks)
    conventions.md         #   implementation notes (terms·common rules·global constraints)
    tasks/                 #   Task files (node concept: intent·requirements·contract·AC)
      {node}.md
    findings.md            #   brownfield backlog: node-level bugs·duplications·doc↔code mismatches (optional)
    restructuring.md       #   brownfield backlog: tree-level structural debt (optional)
    ref/                   #   the detailed spec (greenfield: explore authored it — always present) or brought-in reference docs (brownfield: if any). Frozen, unchanged. + a location map
  .claude/skills/          # ── Claude Code discovers the methodology skills here ──
  .agents/skills/          # ── Codex discovers the byte-identical skills here ──
    grovespec-init/  grovespec-grow/  grovespec-verify/  grovespec-implement/  grovespec-review/  grovespec-fix/  grovespec-revise/
  .grovespec/              # ── the tool owns: config·templates only ──
    config.yaml            #   customize paths (default docs/...) + language. The model itself is fixed.
    templates/
```

Paths are customized in `.grovespec/config.yaml` (a hard requirement for brownfield, §7). Treat all of `docs/` as the asset; delete `.grovespec/` + the installed `.claude/skills/grovespec-*` and/or `.agents/skills/grovespec-*`, and every trace of the tool is gone while the project stands intact.

---

*GroveSpec — specs grow with your code.*
