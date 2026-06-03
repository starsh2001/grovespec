# GroveSpec

> Write a rough spec first, build from it, review and fix, then write the next spec. Repeat.

GroveSpec is a development methodology for handing coding work to an AI agent. An AI agent can only hold a limited amount of information at once (its context), so the work is cut into small pieces with defined steps to match.

> **Scope — GroveSpec is for building software.** Its core assumes code: interface *Contracts*, a tree by entry point, tests-first, searching the codebase, spec↔code drift. It is *not* a general workflow for documentation, planning, or other prose work. (Some underlying principles — start rough, cold review, plain language — transfer; the workflow itself does not.)

Off-the-shelf SDD (Spec-Driven Development) tools write the whole spec first, then build. GroveSpec is different. It doesn't write the spec out in full up front — it grows it a little at a time as it builds.

The name comes from *grove* (a small wood), which shares a root with *grow*. In a single tree, the roots and branches are the skeleton, the leaves on them are the features, and the tree itself is the system. The word packs together a tree (a structure that forks top-down like branches) and growth.

---

## 1. What's different from existing methods

If you sort development methods by how they treat the spec:

- **Off-the-shelf SDD tools**: write the spec out in full before starting to build. The spec is the center; the code is its output.
- **Vibe coding**: build with no spec at all.

GroveSpec is neither. It writes a rough spec first, builds from it, reviews the result to fix the spec, then writes the next spec. It repeats this.

Off-the-shelf SDD tools write the spec once and then don't update it when the code changes, so the two drift apart. GroveSpec reconciles that gap every time, at the review step.

---

## 2. The core idea: start rough

The spec exists from the start, but it starts rough. It gets more detailed as you build.

Some things are fine to decide up front; some are not.

- **Fine to decide up front — the broad direction**: "it's a shop with payment, inventory, and auth", "there are these three screens." Big-frame things, rarely change.
- **Not fine to decide up front — the details**: "the payment screen has 7 buttons, the validation rules are these, the state transitions are those." The finer the detail, the more likely it changes as you build. Decide it early and you'll have to fix it later when it no longer fits.

So GroveSpec doesn't say "don't decide up front" — it says "decide only the broad direction you can be sure of right now."

---

## 3. The spec–implementation cycle

GroveSpec starts with a rough spec and grows it as it builds and reviews. Here's that order, compared to off-the-shelf SDD tools.

### The off-the-shelf SDD order

```
finalize the full PRD → finalize the full Architecture → [ story → build → QA ] repeat
```

The PRD and architecture are finished before building starts. The only thing that repeats is the story implementation inside; the spec itself is all fixed at the start.

### The GroveSpec order

```
1. Write the Task file
     - Overview·Requirements·spec      (think through what to build)
     - AC                              (acceptance criteria)
   ↓
2. Write tests first   (from the AC, before building)
   ↓
3. Build
   ↓
4. Review
     - did the tests pass?
     - if the implementation differs from the spec:
         intentional difference → update the spec + record in the Change Log
         a mistake              → fix the implementation
   ↓
5. Write the next Task   (just the next one step)
   ↓
   back to step 1 (repeat)
```

The order matters. You write the Task file first and write code from it. You don't write code first and reconcile the spec afterward. And you don't skip the review. If the code has diverged from the spec, you must reconcile it in review and record why it changed.

The spec leads the code by only one step. You have to decide what to build next, so you need a plan one step ahead. But decide details much further out, well ahead, and you'll have to fix them when they don't fit as you build.

### The three layers of spec

The spec splits into three layers.

- **Brief** — the whole-project overview. Direction·scope·risks. Rarely changes. → `docs/brief.md`
- **Conventions** — implementation notes. Term definitions·common rules·global constraints. Cross-cutting *rules* (e.g. every screen checks auth first) go here too — shared *code* becomes a node (Principle 3), but shared *rules* go in conventions. Filled in as you build. → `docs/conventions.md`
- **Per-Task spec** — each node's concept (intent·requirements·contract·AC) in one file. → `docs/tasks/{node}.md`

---

## 4. The four principles

All four principles below come from the idea in §2 — start rough, get detailed as you build.

### Principle 1 — Split into a tree by entry point, and split a feature further if it's complex

Split the work into a tree. This tree is **split by entry point (screen·command), not by dependency**. For a UI app the screens are the natural entry points; for a CLI it's the commands.

**Skeleton** — laid out top-down by entry point. The top skeleton sets the overall structure, and you go down screen by screen, command by command.

**Feature** — at the bottom of a skeleton, where the actual behavior is built. If a feature is complex, split it further into child features — a feature can contain features. Where to stop: "is this a self-contained unit?" If it's simple, leave it; if complex, split further. Individual components (buttons·dropdowns) are not nodes — they're details decided when you build the feature (Principle 2).

When a feature needs to be shared, you don't design it up front; you split it out as shared when it's discovered (Principle 3).

Stand up the top skeleton first, top-down, and dig one layer deeper at a time. Because a parent skeleton lays out the structure its children will slot into, and the children slot in there, **there's no later step where you merge things back together.**

**The tree is a hypothesis, not a fixed design.** The first skeleton should hold a rough whole tree so there's a frame to divide the work by. When building reveals something wrong, you fix it.

**The tree structure is written separately in `docs/tree.md`.** It's a file that expresses the tree shape with Task numbers only (→ §5). The structure is recorded here so you don't have to re-derive the tree from the code every time.

The relationship between code and tree isn't that one is the permanent original. **Which one is the truth is decided by the point in time.** At first, with no code, the design (tree) is the truth; when building forces a design change, the code side fixes the tree. Once they exchange once, that node converges (the corrected tree doesn't push back on the code again). Leaving the two out of sync would throw off the next task, so you update them together every time you work (the skill enforces this). As long as design and implementation exist separately you can't eliminate drift entirely, but reconciling every task keeps it far smaller than writing once and walking away.

### Principle 2 — Decide the place early, decide the how as late as possible

What gets exchanged (the interface) is decided early. It's big-frame, so it rarely changes. How it's built (libraries, tech stack, component layout), on the other hand, is decided as late as possible.

The how reveals itself as you build. Decide it early and it's just a guess. A structure set wrong by a guess is worse than nothing. What you didn't build, you can build later; but a structure built wrong forces every later piece of code to route around it, and it keeps snagging.

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

Each node in the tree becomes a **Task** file on disk (`docs/tasks/{node}.md`). A Task holds a node's *concept* in one file — Overview·Requirements·Contract·AC·Subtasks·status·Change Log. What the code looks like is in the code, not the Task.

### One kind, two roles

**There's only one kind of Task.** No tier names like epic·story. Every Task, wherever it sits, is the same kind, and by its tree position it takes **one of two roles**:

- **Skeleton role** — builds the structure to hold what's below. When you make a skeleton, you also define the spec of the one level directly below it. That level may be features, or more skeletons.
- **Feature role** — builds the actual behavior. If a feature is complex, split it into smaller features inside (Principle 1).

Individual components (buttons·dropdowns) are neither, so they're not Tasks — they're details decided when you build (Principle 2).

Off-the-shelf SDD tools split work into multiple kinds, like epic·story. GroveSpec keeps a single kind and expresses hierarchy only through blocking (`Blocked By`), not through kinds.

### Blocking: `Blocked By`

A parent has to build the structure (be Done) before a child can start, so a child Task is blocked by its parent. When a parent goes Done, its children can all start at once. The work order falls out naturally as "start from the Tasks that just got unblocked."

> **How to record it**: it's almost always the parent. It could be a sibling or another Task, so the field is left open. Record it only when something actually blocks.

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

`docs/tasks/TASK-N.md`:

```markdown
---
id: TASK-N
name: "{node name}"
role: feature              # skeleton | feature
status: backlog            # backlog | todo | in-progress | review | done
blocked_by: []             # [TASK-2, ...] / [] if none
tdd: true                  # true | false
tdd_skip_reason: ""        # required when tdd: false
---

## Overview
{What this node covers, in 2-3 sentences. Why it's needed.}

## Requirements
{What it must do. From the user's point of view.}

## Contract
{What it guarantees to the outside (parent·other nodes). What it takes·gives·invariants. Other nodes rely on this without seeing the internals.}

## AC
- [ ] {acceptance criterion 1}
  - [ ] {detail}
- [ ] {acceptance criterion 2}

## Subtasks
- [ ] {implementation step 1}
- [ ] {implementation step 2}

## Change Log
- {YYYY-MM-DD} — {what changed and why — conceptually. How the code changed is held by git.}
```

There's no `parent` in the frontmatter because you can see who the parent is from tree.md. The same information isn't kept in two places. (The exact fields·types·order are fixed by `.grovespec/templates/FORMATS.md` — the contract the tooling parses. Headers and field names are English; the *content* is written in `config.language`.)

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
- **Behavior change** — reopen the node (done→in-progress) and fix it. *If the contract changed*, find the nodes that use that contract (grep+tree) and re-review them (propagation).
- **Structure change** (split·merge·move) — edit tree.md.

The procedure is in [WORKFLOW.md](WORKFLOW.md) under revise.

---

## 6. The per-Task gate

Every time you build a feature Task, it goes through the flow below. Start from a Task whose `Blocked By` is cleared.

```
pre-check → write tests first → build → per-node review → integration review
```

### Pre-check
1. **Look up risks** — is there a risk in `docs/brief.md` this Task touches? If so, go in knowing it before building.
2. **Check conventions** — check the terms·rules in `docs/conventions.md` related to this Task.
3. **Search existing code** — find related existing code to reuse, or discover it anew (Principle 3).

### Write tests first
Write tests from the AC first. With no implementation yet, the tests fail. These failing tests become the target of the implementation.

That said, for cases hard to pin down with tests up front — exploratory prototypes·UI work·hardware-dependent checks — this step may be skipped. If skipped, record the reason in the Task frontmatter's `tdd_skip_reason`. The detailed judgment is handled by the skill.

### Build
Write code until the tests pass. Because you build knowing the risks and the existing code, the risky parts come out right from the start and no duplication arises.

### Per-node review
"Did this Task do its own job properly" — a check within the Task.
- Did all the tests pass?
- Are the AC met?
- If the implementation differs from the spec: an intentional difference → update the spec + record in the Change Log; a mistake → fix the implementation.

### Integration review
"Does this Task break the contract it agreed with other Tasks." It works properly only when the things being compared are actually reviewed together. Verify against the modules the pre-check's code search pulled in.

### Review is done by several fresh eyes
The per-node and integration reviews have several reviewers — who *didn't see how it was built* — find flaws in parallel with different roles, aggregate, and then check "is it over-strict." The strength (Critical / Should Fix / Nice to Have) and repeat (number of consecutive passes) are set in config, and each round runs as a new session. The detailed rules are in [WORKFLOW.md](WORKFLOW.md) §3.

Because reviewers are *cold* (no memory of earlier rounds — or of a review months ago), a call made once would be re-made: the next cold review re-raises an issue the over-strictness check already ruled a nitpick, or re-flags an accepted gap. So when a review closes, the caller records the outcome and any *dropped-as-nitpick · accepted-gap* adjudications, with the reason, in the node's **Change Log**. (Accepted contract gaps are already unchecked AC; this just extends the same "don't re-decide it" protection across revisions — a Change-Log line, not a separate gate file.)

---

## 7. Starting situations

There are several situations you start GroveSpec from. The initial prep differs by what you start with.

| Starting situation | What you have | How to build the tree | ref |
|---|---|---|---|
| Blank slate | just an idea | greenfield (drawn out in conversation) | none |
| Rough spec | simple requirements | greenfield | none (reflected in the brief) |
| Detailed spec | a detailed spec doc | greenfield | the spec doc |
| Existing code only | source code | built by analyzing the code | none |
| Existing code + docs | code + spec doc | built by analyzing the code | the spec doc |

The key — **whatever you start with, it all converges on a Task tree.** Once the tree is built, the cycle after that (§3) is the same in every case. Only the starting point differs.

### The tree is always built one step at a time

Even if you brought a detailed spec, you don't unfold it into a tree all at once. You build it top-down one step at a time, like greenfield. The reason is the same as §2 — bake a whole detailed spec into the tree and unverified assumptions blanket the entire tree. If an assumption turns out wrong while building the top, you have to redo the whole tree below.

Instead the detailed spec is kept as **ref (reference docs)**. Each time you make a Task and run the gate, you reference the relevant part of ref. That way you don't bake the whole spec in up front, yet you don't stray from the implementation the person wanted.

### ref is kept as the original

ref is kept exactly as it came in and is not edited. ref is the record of "this is what we originally meant to do."

If building diverges from ref — leave ref as-is and record the divergence and its reason in that Task's Change Log. This keeps all three: the original intent (ref), the actual implementation (code and spec), and why they diverged (Change Log).

Make a location map once at the start — what's where — and you don't have to read the whole of ref every time. Since ref doesn't change, this map doesn't go stale either.

### If there's code, code comes first

When there's existing code, build the tree from the code. Even with a spec doc alongside, look at the code first. The spec doc may have drifted from the code — stale, or not built as first planned. Code is "what actually is"; docs are "what was meant to be." So build the tree from the code, then keep the spec doc as ref and reference it only for intent or risks.

This is why off-the-shelf SDD tools are weak on existing projects. With no design doc, you have to reconstruct the spec backward from the code, and in that process an AI easily fabricates things that aren't true. GroveSpec doesn't reconstruct — it searches the code as it goes (Principle 3) — so it doesn't have this problem.

### Paths are changeable

An existing project already has its own doc structure. Change the default paths (`docs/...`) in `.grovespec/config.yaml` to wherever you want and GroveSpec works there. But only the location (path) is changeable; the structure isn't. The brief is one overview, tasks is one file per node, each Task has a `Blocked By` — this structure is fixed.

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
- **Form**: per-step skills (`.claude/skills/`) + a light config (`.grovespec/`). The unit is not "whose role" but **"which step"** — divided by step, not by role. The five skills (init·grow·implement·review·revise) and how they're divided are in [WORKFLOW.md](WORKFLOW.md).
- **The methodology is built into the skills.** Each step's skill carries its own guidance and reads only the files it needs, at the time, from the paths config points to.
- **The unit of work is a markdown file on disk** (§5). It's not tied to a particular issue tracker or API; a board·IDE just reads these files and displays them.
- **Install**: copy `.claude/skills/grovespec-*` and `.grovespec/` into your project (an `npx grovespec` installer is on the roadmap).
- **Design principle**: GroveSpec itself follows §2 — fix as little as possible. It enforces only the order of steps and the gates, and leaves what to build within each step blank. Off-the-shelf SDD tools get heavy because they make you fill in templates with no blanks left. GroveSpec sets only the steps and leaves the content blank. How finely to split, how detailed to write the spec — these aren't set by rule. The agent follows the default approach ("skeleton or feature, don't go down to the component") but adjusts to the situation.

---

## Appendix A — the comparison at a glance

| Aspect | Vibe coding | GroveSpec | Off-the-shelf SDD tools |
|---|---|---|---|
| Spec exists | No | Yes | Yes |
| When the spec is known | — | Task→test→build→review→next Task | all fixed before start |
| Where the spec lives | — | inside the cycle (keeps growing) | outside the cycle (fixed once) |
| How far the spec leads the code | 0 (not written) | just the next step | all up front |
| Unit of work | none | one kind of Task, two roles (skeleton/feature) | epic ⊃ story (multiple kinds) |
| How it's split | — | by entry point: skeleton + feature (components are out) | — |
| How hierarchy is expressed | — | `Blocked By` (almost always the parent) | kind separation + separate docs |
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
    ref/                   #   reference docs (detailed·existing specs). Originals, unchanged. May be absent
  .claude/skills/          # ── platform (Claude) owns: the methodology skills ──
    grovespec-init/  grovespec-grow/  grovespec-implement/  grovespec-review/  grovespec-revise/
  .grovespec/              # ── the tool owns: config·templates only ──
    config.yaml            #   customize paths (default docs/...) + language. The model itself is fixed.
    templates/
```

Paths are customized in `.grovespec/config.yaml` (a hard requirement for brownfield, §7). Treat all of `docs/` as the asset; delete `.grovespec/` + `.claude/skills/grovespec-*` and every trace of the tool is gone while the project stands intact.

---

*GroveSpec — specs grow with your code.*
