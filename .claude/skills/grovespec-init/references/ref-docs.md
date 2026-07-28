# ref-docs — when there are reference docs (specs·existing design docs)

> grovespec-init reads this when there are *docs to reference* (detailed specs, existing design docs, etc.). The **method** only — the location-map format follows `.grovespec/templates/ref-index.md`/`FORMATS.md`.

## Big principles
- **A ref doc IS mapped into the tree — as all-`sketch`.** `spec-to-tree.md` maps the spec (or the doc with gaps filled) into all-`sketch` Tasks (structure), which `grow` details into `draft` contracts node by node, all through the normal gates. Detail is fine; being frozen is the problem, and `sketch`/`draft` are not frozen.
- **Don't edit the originals.** A doc is the record of "this is what we meant to do" — preserve it.
- **A ref doc is not the whole intent — fill its gaps into the brief.** A spec/design doc states *what to build* in detail, but usually not *why · what's deliberately out · the one shape-changing risk*. Don't just file it and move on: run the brief's facet coverage (`explore.md`), read off the doc whatever it answers, and **draw the blanks out of the user** — into `brief.md`, not invented, without touching the doc. (Same gap the tree-side actor/entity check closes, one level up: the doc presupposes intent it never states.)
- **If code is present too, code comes first — but a doc that *disagrees* with the code is signal, not noise.** Docs drift from code (stale·not-followed), so build the tree from code (code-to-tree) and use docs for *intent·risks*.
  - Where the doc and the mapped code **disagree**, don't silently let code win and move on — **park it in `findings.md` (Doc↔code mismatches)**: code wrong → a bug (revise) · doc describes unbuilt behavior → build it? (a new node) · doc merely stale → note it, leave ref as-is.
  - Bounded: only the regions you map, only material disagreements — flag for the human, don't fix here.

## Steps
1. **Keep the originals in ref/ as-is.** **Default: copy** the incoming docs into the config's ref path (default `docs/ref/`) *untouched*. Point at a doc in place instead *only* if it's actively maintained elsewhere (so two copies don't drift). When unsure, copy.
2. **Make a location map (ref-index).** A map of "what's where." Kept so you don't re-read the whole thing each time. Format is the `ref-index.md` template (Topic | File | Location). ref doesn't change, so this table doesn't go stale.
3. **Reflect into the tree/contract per Task.** init doesn't unfold the docs. Later, as grow/implement build a node, they reference the relevant part of ref to *stay true to the intended implementation*.
   - **Watch the nouns the doc leans on but never defines.** A spec/regulation freely names actors·entities it assumes already exist (employee · hire-date · team · auth identity) with no "create employee" section of its own. When you reflect its rules into the tree, make sure *some node owns each such noun* — a rule must not depend on an entity no node creates. (verify's C1 catches this, but spotting it here saves a round.)

## When it drifts
- **Found at init** (an *existing* doc and the *existing* code already disagree) → `findings.md` (Doc↔code mismatches), per the principle above — surfaced for the human, not silently resolved to code.
- **Later, while building** (the implementation diverges from ref) → **leave ref as-is** and record the divergence·reason in that Task's *Change Log*. Then all three remain: the original intent (ref) / the actual (code·contract) / why it diverged (Change Log).
