# ref-docs — when there are reference docs (specs·existing design docs)

> grovespec-init reads this when there are *docs to reference* (detailed specs, existing design docs, etc.). The **method** only — the location-map format follows `.grovespec/templates/ref-index.md`/`FORMATS.md`.

## Big principles
- **Don't convert docs into a tree.** Bake a whole detailed spec into the tree and unverified assumptions blanket the entire tree. Build the tree one layer at a time like greenfield (grow), or from code with `code-to-tree.md` if code exists. Keep the docs *beside you, for reference* only.
- **Don't edit the originals.** A doc is the record of "this is what we meant to do" — preserve it.
- **If code is present too, code comes first.** Docs can drift from code (stale·not-followed). Build the tree from code (code-to-tree); reference the docs only for *intent·risks*.

## Steps
1. **Keep the originals in ref/ as-is.** Put the incoming docs in the config's ref path (default `docs/ref/`) *untouched*. (If it's a live operational doc already sitting somewhere, you may point at that spot instead of copying — so two copies don't drift.)
2. **Make a location map (ref-index).** A map of "what's where." Kept so you don't re-read the whole thing each time. Format is the `ref-index.md` template (Topic | File | Location). ref doesn't change, so this table doesn't go stale.
3. **Reflect into the tree/contract per Task.** init doesn't unfold the docs. Later, as grow/implement build a node, they reference the relevant part of ref to *stay true to the intended implementation*.

## When it drifts
If the implementation diverges from ref — **leave ref as-is** and record the divergence·reason in that Task's *Change Log*. Then all three remain: the original intent (ref) / the actual (code·contract) / why it diverged (Change Log).
