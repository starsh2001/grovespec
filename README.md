# GroveSpec

**A spec methodology for agentic coding that keeps spec and code from drifting apart — by changing only a small *partial tree* at a time.**

GroveSpec is a set of [Claude Code](https://claude.com/claude-code) skills + templates. You grow a project as a **tree of nodes**, where each node publishes a **Contract** — what it guarantees to the outside, so other nodes can rely on it without reading its internals. The spec stays *one node ahead* of the code, and every change is gated by a **cold, multi-reviewer** pass.

> **Scope:** GroveSpec is for building *software*. Its core — interface Contracts, an entry-point tree, tests, code search, spec↔code drift — assumes code. It is not a general workflow for documentation or planning.

## The problem it targets

At scale, spec-driven workflows tend to fail in two ways:

- **Specs a human can't actually review** — vast documents full of terms a person can't follow, so review degrades into a rubber stamp.
- **Drift** — the spec and the code slowly disagree, because one change ripples through a document nobody re-reads.

GroveSpec fights both: keep each change inside a **small partial tree** — the node you change plus the few nodes its contract touches (its children and its consumers), never the whole tree — so it's cheap to review deeply; and keep specs **plain enough to confirm at a glance**.

Working with *no* method has its own failure shape: every session starts from zero — context re-explained, architecture re-derived, the same decision re-made slightly differently each time — and review happens only when you remember to ask. GroveSpec's answer to both is the same thing: small files on disk that carry the state, and gates that don't depend on anyone remembering.

## How it works

```
init (once: spec → whole tree as sketches)
  → verify the decomposition (cold) → human approve
  → per node:  grow (detail) → verify → implement → review ⇄ fix → done
  → revise                     change an already-done node later
```

- **Tree of contracts.** A project is a tree. Each node is a `Task` with a **Contract** (what it takes, gives, and guarantees). Consumers depend on the Contract, never the internals — so a change reaches only as far as the contracts it touches.
- **Whole tree, sketched first.** init lays out the entire tree as one-line *sketches* from a detailed spec; each node's full contract is detailed (`grow`) just before it's built. The tree is a *hypothesis*, refined as you build — not a big design locked in up front.
- **Cold gates at every scale.** The whole **decomposition** is cold-reviewed once at init — is a feature missing, a sketch hiding a subtree, an actor unowned? Then each node's **spec** is cold-**verified** before any code, and its **code** is gated by **tests + a cold review of just that node's diff** — several fresh-eyes reviewers with different roles, never the whole codebase, so review cost stays flat as the project grows. Effort scales to the change.
- **Propagation on change.** Changing a done node asks one question: *did the contract change?* If not, fix just that spot. If so, find the nodes that used it and re-review them. Nothing more.

## The seven skills

One per step of a node's life: `sketch → draft → approved → implemented → reviewed ⇄ fixed → done`.

| Skill | What it does |
|---|---|
| `grovespec-init` | First-time setup (once). From whatever you have — idea, spec, or existing code — produces the brief, the detailed spec, and the whole tree: greenfield as `sketch`, brownfield as `done`. |
| `grovespec-grow` | Detail one node's *sketch* into a full *draft* spec (no code), from the reference spec — the per-node step of the initial build, and the tool for later expansion. |
| `grovespec-verify` | Cold, multi-role, parallel review of the **draft spec** → human approve (`draft → approved`). The anti-rubber-stamp gate, spent where a flaw is cheapest. At `full` it also prunes entries this node made stale from `conventions.md` — only `implement` adds there, so nothing else would ever remove. |
| `grovespec-implement` | Turn an approved spec into code: pre-check → tests first → code → confirm the node's decomposition (`approved → implemented`). |
| `grovespec-review` | Run the **tests** + cold-review **only this node's diff** (not the codebase) → confirmed issue list (`implemented → reviewed`). |
| `grovespec-fix` | Apply the review's issues to this node's code → re-review (`reviewed ⇄ fixed`), until clean → `done`. |
| `grovespec-revise` | Change an already-done node — behavior (reopen + propagate), structure (split·merge·move), or promote a leaf to a skeleton. |

## Artifacts

```
docs/
  brief.md           direction · scope · risks
  tree.md            the node tree (ids only)
  conventions.md     glossary · common rules
  tasks/TASK-N.md    one node each: Overview · Requirements · Contract · AC · Subtasks · Change Log
  ref/               the detailed spec (greenfield) or brought-in reference docs (brownfield), frozen + a location map
.grovespec/
  config.yaml         paths · review settings · language
  schema              the format contract (machine SoT; FORMATS.md mirrors it)
  templates/          fill-in templates + FORMATS.md (the parser contract)
  bin/grovespec       deterministic checks — validate · status · check · impact · tree · version
  VERSION             the runtime bundle version — compare an install against this repo
```

**Headers and field names are fixed (English) — the parser contract. The content is written in your project's language** (`config.language`, set once at init). A Korean team writes Korean specs under English headers; an English team writes English. Plain language — in whatever language you work in.

## Using it

GroveSpec is currently a set of Claude Code skills. To adopt it in a project:

1. Copy `.claude/skills/grovespec-*` and `.grovespec/` into your repo — the *whole* `.grovespec/` directory, dotfiles included: it ships its own `.gitattributes` so the runtime checks out as LF (`bin/grovespec` is bash — CRLF breaks it). Your project's own `.gitattributes` isn't touched.
2. Ask Claude: **"grovespec init"** — it draws out a detailed spec and lays out the whole tree as sketches (brownfield: maps your existing code), plus `.grovespec/config.yaml`.
3. From there, per node: **"detail the next node"** (grow) → **"verify it"** → **"implement it"** → **"review it"** (→ **"fix"** if issues), top-down.

**Keeping installs in sync.** A project carries a *copy* of the skills + `.grovespec/`, so it can fall behind. `bash .grovespec/bin/grovespec version` prints the installed runtime's version (`.grovespec/VERSION`); compare it against this repo's before trusting an old install.

**When it pays.** Every node asks the human for two confirmations — approve the spec, confirm the result. That's deliberate friction, spent where drift starts. For software you'll keep and grow it's cheap insurance; for a throwaway script it's overkill — GroveSpec is built for the first case.

**See a complete worked project:** [examples/expense-cli](examples/expense-cli) — a **brownfield** mini-CLI: its existing code *documented* as filled brief · tree · Tasks (real Contracts, honest gaps). The best way to see what good specs look like before you start.

**Optional deterministic checks** ship in `.grovespec/bin/grovespec` (no install — needs only `bash`, which the required `git` already provides on every OS):

- `validate` — format + graph coherence (orphans, cycles, impossible states); exits non-zero with fixes.
- `status` — each node's state + which are unblocked, and what's next.
- `check [TASK-N]` — is a node ready to work (parent done + blocked_by done), and what's the next step (verify/implement/review/fix/grow)? The top-down gate `grow`/`verify`/`implement` run, so the build can't drift bottom-up.
- `impact TASK-N` — the consumer set a contract change reaches (the blast radius).
- `tree` — the id-only tree rendered with names + status. `version` — the installed runtime's version.

They're a bonus enforcement floor — run `validate` + your test suite in CI to catch drift and out-of-band edits between sessions; the core loop runs on the skills + cold review without them.

> A one-command installer (`npx grovespec`) is on the roadmap.

## Design docs

- [METHODOLOGY.md](METHODOLOGY.md) — the *what and why*: the principles and the reasoning behind them.
- [WORKFLOW.md](WORKFLOW.md) — the *how*: the workflow, the steps, and how the skills are divided.
- [.grovespec/templates/FORMATS.md](.grovespec/templates/FORMATS.md) — the artifact formats (parser contract).

Ownership is deliberate, so the docs can't drift apart: the flow and steps are defined once in WORKFLOW, the reasoning in METHODOLOGY, formats in `.grovespec/templates/FORMATS.md`, numbers in `.grovespec/config.yaml`. Everything else (this README included) summarizes and points.

## Influences

GroveSpec stands on earlier spec-driven work, with thanks. Its *explore* stance is influenced by [OpenSpec](https://github.com/Fission-AI/OpenSpec)'s explore mode. The cold, multi-reviewer gate and the one-node-ahead tree are GroveSpec's own response to the rubber-stamp reviews and spec↔code drift that every spec workflow meets at scale — territory charted by [BMAD-METHOD](https://github.com/bmadcode/bmad-method) and [Spec-Kit](https://github.com/github/spec-kit). Different bets, shared lineage.

## Status

**v0.2.0 — early, partly proven.** The cold-review engine is the piece with real evidence behind it: a controlled cold-spawn multi-reviewer run on a planted-flaw sample caught the planted flaws, emergent ones, *and* flaws its own fixes introduced (no false convergence) — and the brownfield mapping (code → tree + contracts) was validated on a sample too. What has **not** been run end-to-end is the greenfield full cycle (grow → verify → implement → review → done) on a real project, or init on a large codebase. Expect rough edges there; the skills and formats may still shift before 1.0.

## License and the name

The code is licensed under [Apache-2.0](LICENSE) — use it, modify it, fork it, ship commercial things with it.

The **name** is handled separately, as Apache-2.0 grants no trademark rights (§6): "GroveSpec" is a trademark of Sooho Choi, and [TRADEMARK.md](TRADEMARK.md) says what that means in practice. The short version: **don't brand your product or fork "GroveSpec"** so that people mistake it for the official one — but *functional* use of the name is expressly allowed, including the `.grovespec/` directory, the `grovespec-*` skill names, the `grovespec` command, and factual statements like "based on GroveSpec" or "compatible with GroveSpec". A fork should not have to rename its own directories, and it doesn't.

---

*Plain language, no coined terms — a spec you can't read at a glance is a spec you can't trust.*
