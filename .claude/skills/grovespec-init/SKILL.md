---
name: grovespec-init
description: Sets up GroveSpec in a project — the fixed setup interview (language · review strength · reviewer models) writes config, and on existing code it surveys the codebase into an all-`done` mapped tree + parked backlogs (findings·restructuring), ending at the survey fidelity gate. It records what IS; deciding what to build is grovespec-plan's (greenfield: init hands straight to plan #0). Use when the user wants to "start a new project with GroveSpec", "adopt GroveSpec in this codebase", "grovespec init", or "reconfigure / change the review settings or language". Re-invoking init re-runs the setup interview and updates config (it does not recreate the project). To plan or lay the tree use grovespec-plan; to change a done node use grovespec-revise.
---

# grovespec-init

Setup of a GroveSpec project: **it records what *is*** — config from a fixed interview, and (brownfield) a survey of the existing code as an all-`done` mapped tree. **What to build is not init's question**: that is `grovespec-plan` (greenfield: plan #0 draws out the intent and lays the sketch tree; brownfield: plan #1 structures the parked backlog). The split is by truth criterion — init's outputs are checkable against the machine and the code; everything whose truth lives in the user's head belongs to plan.

**Re-invoke init anytime to *reconfigure*** — it re-asks the interview and updates `.grovespec/config.yaml`, without recreating anything.

> **Language — detect, then CONFIRM (don't assume).**
> - **Detect**: `node .grovespec/bin/grovespec.mjs locale` → a code (`ko`/`en`/`ja`/…) read from the OS (`$LANG`/`LC_*` when set; elsewhere the OS locale Node's `Intl` reports — works on Windows too, where `$LANG` is empty).
> - **Confirm it with the user** — the setup interview's Q1, asked with the language as a **word, not the code** (*"OS 언어가 한국어로 잡혔어요 — 이 언어로 진행할까요?"*, default = the detected one; the code is stored to `config.language`, never shown). Reply in the chosen language from word one.
> - **Detection returned nothing? ASK outright** — **never silently default to English** (an empty locale isn't a vote for English).
>
> The choice is written to `config.language`; later skills just read it. (These files are English — irrelevant to your output.)

## Flow

### 1. Figure out what you have
**Check the directory first** (glob for source files + any docs); ask the user only if it's ambiguous.

- **Already a GroveSpec project** (a `tree.md` with nodes exists) → this is a *reconfigure*: run only **§2 (the setup interview)**, update config, and **stop**. (Plan the next round → grovespec-plan; change a done node → grovespec-revise.)
- **Source files exist** → **brownfield**: §2 then §3 (the survey).
- **No code** → **greenfield**: §2, create the empty scaffolding (§4), and hand to `grovespec-plan` — init asks nothing about the product idea; the exploration is plan #0's.

### 2. Setup interview (the fixed questionnaire — ask before starting)
Run the **fixed** interview in `references/setup.md` — **language** (confirm the detected locale) · **review strength** · **reviewer models** — and write the answers to `.grovespec/config.yaml`.
- Ask **exactly those three questions, in order** — don't improvise or skip any. A fixed interview is what keeps every project configured the same and nothing decided silently.
- The **test command is not asked** — it's a derivable value, auto-detected per `setup.md`'s note (brownfield: §3; greenfield: the first `grovespec-review` derives it).

### 3. Brownfield survey (existing code only)
Read and follow `references/code-to-tree.md` — read the code first and map it into the tree (even with docs present, code comes first: docs drift from code).
- **The survey is a photograph, not a design**: the whole existing structure as an all-`done` tree, `origin: mapped`, **honest even if ugly** — a tangled module maps to a tangled node; inventing a clean structure the code doesn't have is falsifying the survey.
- **Every mapped Task gets `refs: []`.** Its criterion is the code, even when the user brought reference docs. The explicit empty list records that this is intentionally no-ref; a doc↔code mismatch is parked in `findings.md` instead of turning the intent doc into the survey's truth.
- **What's *wrong* goes beside the tree, not into it**: `findings.md` (node-level bugs · duplications · doc↔code mismatches) and `restructuring.md` (tree-level structural debt) — only if non-empty. `grovespec-plan` structures them into the next round; the tree itself stays what *is*.
- **Set `paths` in `.grovespec/config.yaml` to the existing layout** (e.g. `src`, `tasks`) so later searches hit the real dirs.
- **Detect the test command** (`package.json` `scripts.test` / pytest config / `Makefile` / `cargo`·`go` layout / …) and write `review.test`. Leave it empty only if nothing is clearly detectable.
- **conventions.md** — fill in the facts the code guarantees (terms · global rules) now (→ `code-to-tree.md` §7).
- **brief.md — from the survey, not from intent**: Scope = what the code *observably* does / doesn't (code-derived, so it stays on init's side of the truth split); Direction = the user's one-line why (the one thing to ask); Risks = what the survey saw. Later plans amend it as the scope actually changes.
- If the user brought reference docs, keep the originals under `ref/` with a location map — originals are never edited.

### 4. Make the files
- *Greenfield*: the empty scaffolding only — `docs/tasks/` dir, empty `tree.md`, empty `conventions.md` (headers per template). **No brief, no ref record, no Tasks** — those are plan #0's outputs. (`validate` treats the no-tree state as valid: the pre-plan state.)
- *Brownfield*: `tree.md` + one `done`, `origin: mapped`, `refs: []` Task per node (per `code-to-tree.md`), `conventions.md` filled, backlogs if non-empty.
- Both: `.grovespec/config.yaml` from the template + the §2 answers.

### 5. Hand off
- *Greenfield* → **next is `grovespec-plan`** (plan #0: explore → intent record + brief → the all-`sketch` tree → the decomposition gate). Init ends after config + scaffolding — deliberately small: adopting GroveSpec and designing the product are different acts.
- *Brownfield* → **next is the survey fidelity gate**: `grovespec-verify` on the tree (`target_type: tree`, write `tree_evidence_mode: fidelity` when the initial record is created, before round 1; fidelity checklist F1–F4 — reviewers.md): the survey is an agent's claim too, so cold reviewers check it *against the code* (coverage · contract↔behavior · no beautification · backlog honesty) → fix → `pin tree` seals the structure plus every mapped node's explicit no-ref assignment → **human approves the vetted survey** (`grovespec approve tree --human`). The runtime blocks node work until then. After the gate, `grovespec-plan` (plan #1) structures the backlog into the first round; `grovespec-revise`/`grovespec-grow` execute it.

> **Open and close in the step-report shape** (`FORMATS.md` "The step report" — fixed `starting` opening; `Result · Open · Your turn · Next` closing, warm full sentences). Here, *Open / Your turn* typically carry: the survey awaiting the fidelity verify · backlog items · unanswered setup questions.

> **Recommend a new session for the next step** (greenfield: `plan`; brownfield: the fidelity verify). The agent that just mapped the tree must not also orchestrate its cold review — start it fresh, with clean bounded context (WORKFLOW §5).

## What it looks like when done
```
greenfield                          brownfield
docs/                               docs/
  tree.md          (empty)            tree.md          the whole existing tree, all done (ids only)
  conventions.md   (empty headers)    conventions.md   facts the code guarantees
  tasks/           (empty dir)        tasks/           one Task per existing node (done, origin: mapped, refs: [])
                                      brief.md         from the survey (Scope = observed behavior)
                                      findings.md      backlog: bugs·duplications·mismatches (only if non-empty)
                                      restructuring.md backlog: structural debt (only if non-empty)
                                      ref/             brought-in originals (if any) + location map
.grovespec/config.yaml — the §2 interview's answers (+ brownfield: paths · review.test)
```
The greenfield brief and every ref *intent record* appear at plan #0 / plan #N — those are plan's outputs, written from intent, which is exactly why init doesn't write them.

**Commit as `init: <summary>`** — the config, and on brownfield everything the survey wrote (tree · mapped Tasks · brief · backlogs · ref). No `TASK-N: ` prefix ever (`FORMATS.md` "Commits").
