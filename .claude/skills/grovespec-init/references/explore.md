# explore — when there's just an idea or a rough spec (greenfield)

> grovespec-init reads this when there's *no code and no detailed doc* — just an idea or a rough spec. The **method** only; the brief format is owned by `.grovespec/templates/brief.md`/`FORMATS.md` — don't restate it, land on that.

## Big principles
- **Talk in the user's language.** Converse in the language init established (user's message → OS locale → ask; this doc is English, your replies are not). The brief lands in `config.language`.
- **Output is a brief, nothing else.** explore writes only `brief.md` — no tree, no Tasks, no code.
- **Converse toward the shape; don't run a questionnaire.** Lead with the user's own words and follow where they go — no fixed question list, no set order. Lay the options out, name what's risky, and poke at what's being taken for granted (by them and by you).
- **Land lean.** Think wide, but *finish narrow* — a brief someone reads at a glance and says "yes, that's the direction." A long document here would re-create the exact thing GroveSpec exists to kill (a spec no human can confirm), so the last move is always to *cut it down*.
- **Expand their intent — don't just refine their sentence.** People often can't *state* what they want but *recognize* it when shown. Don't only reason forward from their first answer — surface what they didn't name, dig for the *why*, show divergent versions to react to. Recognition beats extraction. When they're stuck, draw it out — facilitation + moves in `references/elicitation.md`.
- **Provoke and offer, but don't assert.** Generating options for them to react to is the job; inventing the answer and calling it theirs is not. (No seed at all? Ask what they want to build — don't guess one into being.)
- **Greenfield only.** Code and detailed-doc starts don't explore — there the code/doc is the truth and exploring would just invent. (See `code-to-tree.md` / `ref-docs.md`.)

## Steps
*(Moves, not a sequence — use what the conversation needs, in any order.)*

1. **Start from the seed.** Read the idea back in your own words; find the *real* intent under it. Confirm you share the same picture before going wide.
2. **Open the space.** Lay out 2-3 shapes the idea could take (a spectrum: simple → rich) and let the user pick a thread. A quick sketch (even ASCII) beats paragraphs when it makes the choice visible.
3. **Pull on the risk early.** Find the thing that *changes the whole shape* if it goes wrong (safety, money, a hard dependency). Naming it now is worth more than any feature list — it becomes the brief's risks.
4. **Test the assumptions.** The user's ("does it really need accounts?") and your own. Re-frame the moment a better framing shows up.
5. **Close when it's ready — the user's call.** Once the direction has held steady through at least one assumption-test without reshaping, *recommend* capturing it (*"this feels settled — want me to write the brief?"*) — don't wait to be asked. If they'd rather keep going, keep going; the brief is just where the thinking gets parked.

## Write the brief
Compress the conversation into `brief.md` (template `.grovespec/templates/brief.md`): **Direction** (2-3 sentences) · **Scope** (Does / Doesn't — what's deliberately left out matters as much as what's in) · **Risks** (where it might break, *not* what to build). Short, plain, in `config.language`. If more than ~5 risks surface, keep only the *shape-changing* ones — the rest belong to grow.

## When done
Return to `grovespec-init`'s flow — set the language, then build from the brief (tree.md + the root Task only, `draft`), with the human-check at the end ("is this the right direction?") gating it before any effort goes into growing the tree.
