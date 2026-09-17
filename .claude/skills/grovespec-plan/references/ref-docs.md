# ref-docs — when there are reference docs (specs·existing design docs)

> grovespec-plan reads this when the user brings *docs to reference* at plan #0 (detailed specs, design docs); grovespec-init reads it for brownfield brought-in originals. The **method** only — the location-map format follows `.grovespec/templates/ref-index.md`/`FORMATS.md`.

## Big principles
- **A ref doc IS mapped into the tree — as all-`sketch`.** `spec-to-tree.md` maps the spec (or the doc with gaps filled) into all-`sketch` Tasks (structure), which `grow` details into `draft` contracts node by node, all through the normal gates. Detail is fine; being frozen is the problem, and `sketch`/`draft` are not frozen.
- **Don't edit the originals.** A doc is the record of "this is what we meant to do" — preserve it.
- **A ref doc is not the whole intent — fill its gaps into the brief.** A spec/design doc states *what to build* in detail, but usually not *why · what's deliberately out · the one shape-changing risk*. Don't just file it and move on: run the brief's facet coverage (`explore.md`), read off the doc whatever it answers, and **draw the blanks out of the user** — into `brief.md`, not invented, without touching the doc. (Same gap the tree-side actor/entity check closes, one level up: the doc presupposes intent it never states.)
- **If code is present too, code comes first — but a doc that *disagrees* with the code is signal, not noise.** Docs drift from code (stale·not-followed), so build the tree from code (code-to-tree) and use docs for *intent·risks*.
  - Where the doc and the mapped code **disagree**, don't silently let code win and move on — **park it in `findings.md` (Doc↔code mismatches)**: code wrong → a bug (revise) · doc describes unbuilt behavior → build it? (a new node) · doc merely stale → note it, leave ref as-is.
  - Bounded: only the regions you map, only material disagreements — flag for the human, don't fix here.

## Steps
1. **Keep the originals in ref/ as-is.** **Default: copy** the incoming docs into the config's ref path (default `docs/ref/`) *untouched*. Point at a doc in place instead *only* if it's actively maintained elsewhere (so two copies don't drift). When unsure, copy.
2. **Make a location map (ref-index).** A map of "what's where." Kept so you don't re-read the whole thing each time. Format is the `ref-index.md` template (Topic | File | Location). Frozen records don't change; when a later record supersedes one, the index moves to the current coordinate.
3. **Assign current headings to Tasks before the tree gate.** Each sketch frontmatter carries its exact source scope as a canonical flow list such as `refs: [spec.md@4, spec.md@5.4]`, with paths relative to `paths.ref`. `ref/index.md` says which record is current; `refs` says which of those current headings this node owns. Use `refs: []` only for an intentional no-ref node. A heading containing only `(gap)` text is still assigned: its scope exists even though its behavior is deliberately undefined.
4. **Reflect into the contract from that assignment.** `grow` preserves and reads the Task's `refs`; spec `verify` runs `grovespec source TASK-N` so the runtime resolves the same headings without a model-written hand-off.
   - **Watch the nouns the doc leans on but never defines.** A spec/regulation freely names actors·entities it assumes already exist (employee · hire-date · team · auth identity) with no "create employee" section of its own. When you reflect its rules into the tree, make sure *some node owns each such noun* — a rule must not depend on an entity no node creates. (verify's C1 catches this, but spotting it here saves a round.)

## When it drifts
- **Found at init** (an *existing* doc and the *existing* code already disagree) → `findings.md` (Doc↔code mismatches), per the principle above — surfaced for the human, not silently resolved to code.
- **Later, while building** (the implementation diverges from ref) → **leave ref as-is** and record the divergence·reason in that Task's *Change Log*. Then all three remain: the original intent (ref) / the actual (code·contract) / why it diverged (Change Log).
