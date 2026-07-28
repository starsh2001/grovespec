# explore — drawing out a detailed spec from the user (greenfield)

> grovespec-init reads this when there's *no code* — just an idea, a rough spec, or a detailed doc with intent gaps. The **method** only; artifact formats follow `.grovespec/templates/`.

## Big principles
- **Talk in `config.language`.** init sets it from the OS locale (`grovespec locale`; if undetectable, it asks — never a silent English default). Use that language for everything here, including your opening question. This doc is English — irrelevant to your output.
- **Output is a detailed spec (saved as ref) + a brief.** The detailed spec is the *source of truth for intent* — thorough enough that `spec-to-tree.md` can decompose it into an all-`sketch` tree (and that `grow` can later detail each sketch from it). The brief is the lean overview (direction · scope · risks) extracted from it. Together they are to greenfield what *code* is to brownfield: the source the tree is mapped from.
- **Converse toward the shape; don't run a questionnaire.** Lead with the user's own words and follow where they go — no fixed question list, no set order. Lay the options out, name what's risky, and poke at what's being taken for granted (by them and by you).
- **Detailed, not frozen.** The detailed spec is a *hypothesis*, not a commitment. It maps to an all-`sketch` tree, each node later detailed to a `draft` contract by `grow` — and every node still goes through verify → implement → review → `done`. Detail up front means each node starts with *grounded intent* instead of a vacuum; it does *not* mean the build can't change things.
- **Expand their intent — don't just refine their sentence.** People often can't *state* what they want but *recognize* it when shown. Don't only reason forward from their first answer — surface what they didn't name, dig for the *why*, show divergent versions to react to. Recognition beats extraction. When they're stuck, draw it out — facilitation + moves in `references/elicitation.md`. *What* to surface isn't open-ended: it's the coverage below — first the direction facets, then the feature detail.
- **Provoke and offer, but don't assert.** Generating options for them to react to is the job; inventing the answer and calling it theirs is not. (No seed at all? Ask what they want to build — don't guess one into being.)
- **Greenfield — with or without a ref doc.** If the user brought a detailed spec: don't re-brainstorm what it already covers — read it, **fill only the facets/features it leaves blank** (`ref-docs.md`), and proceed to `spec-to-tree.md`. Existing **code** is the real exception — there the code *is* the intent, mapped as-is (`code-to-tree.md`), not explored.

## Phase 1 — Direction (the facets)
*Get the direction right before digging into features.* This is **not** a question list to read aloud (that's the questionnaire explore rejects) — it's a coverage check you run *against the conversation*, in any order, **skipping whatever the seed or a ref doc already answers**. A facet you never probed is a guess you're about to bake into the whole spec.

Each facet feeds the brief, and each *reshapes the product* if it's wrong:

**Direction** —
- **Who, and the job it's hired for** — who actually uses it, and the real motive under the surface ask (why-ladder *past* the first answer; "their eyes").
- **What "it worked" looks like** — one concrete winning moment / the main path, not an abstract goal.
- **How far it has to go** — a throwaway probe vs. something people lean on. This drives more than any feature and is the one most often left unasked — ask it outright.

**Scope** —
- **The deliberate _not_** — what's tempting but consciously left out (the brief's *Doesn't* — as load-bearing as the *Does*).
- **Fixed givens** — constraints/decisions the user already holds (platform · offline · a deadline · must-use-X). Miss one and the whole frame is wrong → rework.

**Risks** —
- **The shape-changing risk** — the one thing that redraws everything if it goes wrong (safety · money drift · a hard dependency · data correctness · scale).

A facet is *covered* when it's **grounded** (the user said it, or a ref doc states it) or **consciously deferred** (named aloud) — never silently skipped.

## Phase 2 — Feature detail (the spec body)
Once the direction is solid, **go deeper** — draw out the features, behaviors, contracts, and edges that make up the actual product. This is what turns a brief into a *buildable spec*. Still conversational, still not a questionnaire; now following each capability thread until you can write its contract.

What to draw out:
- **The main features / entry points** — what the user does, screen by screen / command by command. Walk the main path first ("show me a typical session from start to finish"), then branch into the secondary ones.
- **For each feature**: what it takes · what it gives · the business rules · the happy path · the meaningful edges (empty · error · conflict). Don't chase every edge — the ones the user cares about or that change the shape.
- **Actors and entities** — who and what the system works with (user roles · key data entities · their attributes the rules depend on). The actor/prerequisite-closure check (`reviewers.md` C1) will catch it later, but grounding them here saves a verify round.
- **Shared concerns** — auth, data model, notifications, anything 2+ features lean on. These become shared nodes in the tree.
- **Cross-cutting rules** — "all amounts are whole-won", "every action is logged" — these seed `conventions.md`.

How to draw it out:
- **Walk, don't list.** "Show me what happens when a user [does X]" is better than "list your features." Walk the product as a user; each fork in the walk is a feature boundary.
- **Sketch as you go.** After each cluster of features, feed back a mini-summary ("so far I see: A does X, B does Y, C is shared by both — right?"). Corrections are cheap here.
- **Mark the gaps, don't fill them.** Where the user says "I haven't thought about that" — note it as a gap, move on. It becomes an unchecked AC in the draft Task. Don't invent the answer.
- **Stop when you can tree it.** You have enough when you can decompose the product into a tree of nodes, each with a reasonable contract (takes · gives · guarantees) and identified gaps. You don't need every edge nailed — verify will probe them.

## Steps (both phases)
*(Moves, not a sequence — use what the conversation needs, in any order.)* Their job is to **cover the facets (phase 1) and the feature detail (phase 2)** — reach for whichever move draws out a still-blank spot.

1. **Start from the seed.** Read the idea back in your own words; find the *real* intent under it. Confirm you share the same picture before going wide.
2. **Open the space.** Lay out 2-3 shapes the idea could take (a spectrum: simple → rich) and let the user pick a thread. A quick sketch (even ASCII) beats paragraphs when it makes the choice visible.
3. **Pull on the risk early.** Find the thing that *changes the whole shape* if it goes wrong (safety, money, a hard dependency). Naming it now is worth more than any feature list — it becomes the brief's risks.
4. **Walk the product.** Once direction is solid, walk the main user journey end to end. Each stop is a feature; each fork is a boundary. This is where phase 2 lives.
5. **Test the assumptions.** The user's ("does it really need accounts?") and your own. Re-frame the moment a better framing shows up.
6. **Close on coverage, not on calm — then it's the user's call.** Close when: direction facets are all covered **and** you have enough feature detail to decompose into a tree. A still-blank facet or an unexplored main feature is the *next* thing to draw out, not a thing to wave past. *Then* recommend capturing it (*"I think I've got the whole picture — want me to write the spec and brief?"*). If they'd rather keep going, keep going.

## Write the outputs

### 1. The detailed spec → ref/
Write the full spec to `{paths.ref}/spec.md` (or a descriptive name). Once written here and human-approved at init, it's the **frozen intent baseline** — not edited in place afterward (like any ref doc): later build divergences are recorded in Change Logs, and a wrong *intent* is a re-`explore`, not a ref edit. Organized by feature area, in `config.language`, with gaps explicitly marked. Enough detail that `spec-to-tree.md` can place the tree and `grow` can later detail each node's contract from it.

### 2. The brief → brief.md
Compress the direction into `brief.md` (template `.grovespec/templates/brief.md`): **Direction** (2-3 sentences) · **Scope** (Does / Doesn't) · **Risks** (where it might break). Short, plain, in `config.language`. The brief is the overview; the detailed spec is the body.

## When done
Return to `grovespec-init`'s flow — init reads `spec-to-tree.md` to map the detailed spec into the full tree of all-`sketch` Tasks (structure now; per-node contracts come later, when `grovespec-grow` details each sketch), with the human-check ("is this the right decomposition?") gating it before the gates start.
