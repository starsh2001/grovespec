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
init:  explore → detailed spec (ref) + the whole tree as sketches
  → verify (tree):  cold review of the decomposition → fix → human approve   (once)
  → per node, top-down:  grow → verify → implement → review ⇄ fix → done
  → later expansion:  grow ONE new node → the same per-node gate
```

(The step definitions — what each does, with what inputs and outputs — live once, in [WORKFLOW.md](WORKFLOW.md) §1–§2.)

The difference from off-the-shelf SDD: the structure is laid out from the start, but nothing is *frozen* — every node is `sketch`, then `draft`, until it passes the gates. The gates are where reality meets intent: a contract flaw caught at verify is free; a code flaw caught at review is cheap. The build can change things; the spec is a starting point, not a prison.

And the *decomposition itself* gets a cold gate before any node is built — `verify` at **tree scale** (D1–D5): is a whole feature missing (the system scaffolding a domain doc never mentions — settings·admin·audit), is a one-liner hiding a subtree, does an actor have no owner? This is the same cold-review medicine GroveSpec spends on specs and code, finally applied to the structure — the one decision that used to get only a human glance (which, on a real run, let a missing settings screen and a naive approval model through until a human caught them). It's affordable only because the tree is `sketch` (one-liners): a reviewer holds the whole decomposition at once.

The order matters. The spec is verified *before* any code, and the code is gated by *tests* plus a cold review of its *diff*. You don't write code first and reconcile the spec afterward. If the code diverges from the spec: a mistake → conform the code; an intentional change → that's a contract change, done via *revise* (+ Change Log), never a silent edit.

### The three layers of spec

The spec splits into three layers.

- **Brief** — the whole-project overview. Direction·scope·risks. Rarely changes. → `docs/brief.md`
- **Conventions** — implementation notes. Term definitions·common rules·global constraints. Cross-cutting *rules* (e.g. every screen checks auth first) go here too — shared *code* becomes a node (Principle 3), but shared *rules* go in conventions. Filled in as you build: **`implement` records a new cross-cutting rule/term the moment it establishes one, and the root's implement seeds the chosen stack + foundational patterns** — so later nodes read them here instead of re-deriving from code. Only `implement` appends, so this is the one living doc that would grow unbounded — every node reads it, so the cost of bloat is multiplied by node count. A `full` `verify` therefore **prunes** stale entries as part of its Resolve step: appending and pruning are deliberately split across two skills, so the writer is never its own editor. → `docs/conventions.md`
- **Per-Task spec** — each node's concept (intent·requirements·contract·AC) in one file. → `docs/tasks/{node}.md`

Greenfield adds a fourth, *frozen* source beside these living layers: the **detailed spec** `explore` draws out, kept in **`ref/`** — the full body of intent that `grow` details every node's contract from (it is to greenfield what existing *code* is to brownfield). The **brief is its lean compression** (direction·scope·risks, human-confirmable at a glance); the ref spec is the detail behind it. Both are written together at init from the same exploration — the brief extracted from the ref spec. So intent flows **ref spec → brief (its summary) → Per-Task contract (committed, written by grow)**, with Conventions holding the cross-cutting rules throughout.

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

This is also the spec's **scope rule**: a node's *Contract* states what it **takes · gives · guarantees** — never the *mechanism* (atomicity, schemas, concurrency, API/response shapes, algorithms), which is the *how*, deferred to the node's own implement or to a child. So an unspecified mechanism or a child-owned edge in a spec is **correct delegation, not a gap** — `grovespec-verify` enforces this, and a skeleton defers most detail with `[→ child/deferred: …]` markers. (Pinning all that into a root is the over-specification that makes verify churn.)

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

- **Pre-check before building** (risks · conventions · search existing code — inside `implement`). A person carries "I think I've seen this before" into every task; an agent, isolated to what it sees, doesn't — so the look-around is forced as a step (→ §8). Building with the risks and the existing code in front of you is what makes the risky parts come out right the first time and keeps duplication from arising.
- **Tests first.** Written from the AC while there is no implementation, they fail — and become the fixed target the build must hit, instead of a moving one. Nodes that resist up-front tests (exploratory prototypes · UI · hardware-dependent checks) may skip, with the reason recorded in the Task (`tdd_skip_reason`). Because TDD is decided per *node*, one project can mix both — an unplanned strength of the tree structure.
- **Building confirms the decomposition.** The sketched children were a hypothesis; building the node is what reconciles them against reality (keep · drop · add) and confirms its `role`, recorded in the Change Log.
- **Two cold reviews, on different things.** verify checks the *contract* before any code exists — a flaw caught there is free; caught after building, it costs the build. review checks the *code* — the tests are the deterministic spine, and the cold reviewers read only this node's diff, which is what keeps review cost flat as the project grows. review never re-asks spec questions; verify settled those. (A third, once-only cold review runs at init on the whole decomposition — §3.)
- **The review bar is *sufficient*, not exhaustive** (adapted from BMAD's PO *validate-story*). A flaw counts only if a competent implementer would be **blocked or build the wrong thing** — named, along with the decision they can't make. Without that bar an adversarial reviewer finds unbounded plausible flaws and the loop never converges; a real run took 14 rounds before it was added. It is deliberately two-sided: a check passes only when a reviewer **shows** it holds, so leniency on imagined edges cannot slide into rubber-stamping an under-specified spec.
- **Closed decisions are remembered.** Cold reviewers have no memory of earlier rounds, so a call once made would be re-litigated forever. The dropped-as-nitpick · accepted-gap adjudications go into the node's Change Log, where any later cold round reads them.

---

## 7. Starting situations

There are several situations you start GroveSpec from. The initial prep differs by what you start with.

| Starting situation | What you have | How to build the tree | ref |
|---|---|---|---|
| Blank slate | just an idea | explore → detailed spec → all-`sketch` tree | the spec (produced at init) |
| Rough spec | simple requirements | explore fills gaps → detailed spec → all-`sketch` tree | the spec (produced at init) |
| Detailed spec | a detailed spec doc | fill gaps → all-`sketch` tree | the spec doc |
| Existing code only | source code | code-to-tree → all-`done` tree | none |
| Existing code + docs | code + spec doc | code-to-tree → all-`done` tree | the spec doc |

The key — **whatever you start with, it all converges on a Task tree.** Once the tree is built, the per-node cycle (§3, §6) is the same in every case. Only the starting point differs.

### The tree is mapped whole, not grown one step at a time

Greenfield maps the **full tree at init** — all `sketch` (structure + one-liners). The old "one node at a time" rule tried to avoid baking unverified assumptions, but created a vacuum: each node started from nothing, so the agent either exhausted the user asking for intent, or improvised. The fix isn't to avoid detail — it's to mark it as a *hypothesis*: the whole structure is sketched cheaply, then `grow` details each node into a `draft` contract and it goes through the gates (verify → implement → review) before becoming `done`. Any node that turns out wrong is revised or dropped at near-zero cost (a sketch isn't even a commitment). Writing all the *contracts* up front would be the "too much in one head" blow-up GroveSpec exists to avoid — so the contract detail stays bounded, one node per `grow`.

The detailed spec — produced by explore or brought by the user — is kept as **ref** (reference docs). It's the record of "this is what we meant to do." When implementation diverges, the spec stays as-is; the divergence goes in the Task's Change Log.

### ref is kept as the original

ref is kept exactly as it came in and is not edited. ref is the record of "this is what we originally meant to do." **Greenfield, GroveSpec itself *authors* `ref/spec.md` (via explore) — but once it's written and human-approved at init, it's frozen exactly like a brought-in doc: a fixed baseline, so every later build divergence shows up as a Change-Log delta against stable intent rather than being edited away. If the *intent itself* was captured wrong, that's a re-`explore` (re-state the intent), not a silent in-place edit of ref.**

If building diverges from ref — leave ref as-is and record the divergence and its reason in that Task's Change Log. This keeps all three: the original intent (ref), the actual implementation (code and spec), and why they diverged (Change Log).

Make a location map once at the start — what's where — and you don't have to read the whole of ref every time. Since ref doesn't change, this map doesn't go stale either.

### If there's code, code comes first

When there's existing code, build the tree from the code. Even with a spec doc alongside, look at the code first. The spec doc may have drifted from the code — stale, or not built as first planned. Code is "what actually is"; docs are "what was meant to be." So build the tree from the code, then keep the spec doc as ref and reference it only for intent or risks.

This is why off-the-shelf SDD tools are weak on existing projects. With no design doc, you have to reconstruct the spec backward from the code, and in that process an AI easily fabricates things that aren't true. GroveSpec doesn't reconstruct — it searches the code as it goes (Principle 3) — so it doesn't have this problem. And it maps the code *honestly*, all `done`, even where the structure is poor: what the mapping finds *wrong* — bugs, duplications, doc↔code disagreements, or a structure too tangled to tree cleanly — isn't forced into the tree (that would make the tree lie about the code), but parked as a draft backlog (`findings.md` for node-level, `restructuring.md` for tree-shape) that `revise` works off later.

### Paths are changeable

An existing project already has its own doc structure. Change the default paths (`docs/...`) in `.grovespec/config.yaml` to wherever you want and GroveSpec works there. But only the location (path) is changeable; the structure isn't. The brief is one overview, tasks is one file per node, each Task has a `blocked_by` — this structure is fixed.

> Detecting the case above and the prep for each is handled by the entry skill (`grovespec-init`). This document only settles "why it's divided this way"; the concrete procedure lives in the skill.

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

- **Target**: the Claude Code terminal (and compatible agents).
- **Form**: per-step skills (`.claude/skills/`) + a light config (`.grovespec/`). The unit is not "whose role" but **"which step"** — divided by step, not by role. The seven skills (init·grow·verify·implement·review·fix·revise) and how they're divided are in [WORKFLOW.md](WORKFLOW.md).
- **The methodology is built into the skills.** Each step's skill carries its own guidance and reads only the files it needs, at the time, from the paths config points to.
- **The unit of work is a markdown file on disk** (§5). It's not tied to a particular issue tracker or API; a board·IDE just reads these files and displays them.
- **Install**: copy `.claude/skills/grovespec-*` and `.grovespec/` into your project (an `npx grovespec` installer is on the roadmap).
- **Design principle**: GroveSpec itself follows §2 — fix as little as possible. It enforces only the order of steps and the gates, and leaves what to build within each step blank. Off-the-shelf SDD tools get heavy because they make you fill in templates with no blanks left. GroveSpec sets only the steps and leaves the content blank. How finely to split, how detailed to write the spec — these aren't set by rule. The agent follows the default approach ("skeleton or feature, don't go down to the component") but adjusts to the situation.
- **Rules live in the skills; *why* lives here.** A skill doc is read on every run and instructs an agent, which needs the *what*, not the justification. Attribution, the history of a decision, and "this is why we changed it" belong in this document. A skill doc that argues with its reader has stopped being an instruction.
- **Subtraction gate.** Skill docs are only ever patched *additively* — each review round closes a leak by adding a sentence and bolding it, and nothing ever proposes a deletion, so density climbs until the load-bearing rules are indistinguishable from the caveats. So: **before a version tag, if `.claude/skills/` grew since the last tag with no removals, run a pass that may only merge, cut, or move rationale into this document — never add.** The check is mechanical (`git ls-tree -r -l <tag> .claude/skills/`), not a judgment call.

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
  CLAUDE.md                # the user's — GroveSpec neither reads nor writes it (Claude's standard location)
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
  .claude/skills/          # ── platform (Claude) owns: the methodology skills ──
    grovespec-init/  grovespec-grow/  grovespec-verify/  grovespec-implement/  grovespec-review/  grovespec-fix/  grovespec-revise/
  .grovespec/              # ── the tool owns: config·templates only ──
    config.yaml            #   customize paths (default docs/...) + language. The model itself is fixed.
    templates/
```

Paths are customized in `.grovespec/config.yaml` (a hard requirement for brownfield, §7). Treat all of `docs/` as the asset; delete `.grovespec/` + `.claude/skills/grovespec-*` and every trace of the tool is gone while the project stands intact.

---

*GroveSpec — specs grow with your code.*
