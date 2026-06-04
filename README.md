# GroveSpec

**A spec methodology for agentic coding that keeps spec and code from drifting apart — by changing only a small *partial tree* at a time.**

GroveSpec is a set of [Claude Code](https://claude.com/claude-code) skills + templates. You grow a project as a **tree of nodes**, where each node publishes a **Contract** — what it guarantees to the outside, so other nodes can rely on it without reading its internals. The spec stays *one node ahead* of the code, and every change is gated by a **cold, multi-reviewer** pass.

> **Scope:** GroveSpec is for building *software*. Its core — interface Contracts, an entry-point tree, tests, code search, spec↔code drift — assumes code. It is not a general workflow for documentation or planning.

## The problem it targets

At scale, spec-driven workflows tend to fail in two ways:

- **Specs a human can't actually review** — vast documents full of terms a person can't follow, so review degrades into a rubber stamp.
- **Drift** — the spec and the code slowly disagree, because one change ripples through a document nobody re-reads.

GroveSpec fights both: keep each change inside a **small partial tree** — the node you change plus the few nodes its contract touches (its children and its consumers), never the whole tree — so it's cheap to review deeply; and keep specs **plain enough to confirm at a glance**.

## How it works

```
init (once)
  → per node:  grow → verify → implement → review ⇄ fix → done
  → revise                     change an already-done node later
```

- **Tree of contracts.** A project is a tree. Each node is a `Task` with a **Contract** (what it takes, gives, and guarantees). Consumers depend on the Contract, never the internals — so a change reaches only as far as the contracts it touches.
- **One node ahead.** The spec leads the code by exactly one layer. The tree is a *hypothesis*, refined as you build — not a big design locked in up front.
- **Two cold gates.** The spec is cold-**verified** before any code (fresh-eyes reviewers in parallel — consumer-impersonator, gap-finder, coherence, non-expert, breaker). The code is gated by **tests + a cold review of just that node's diff** (correctness, security, maintainer, breaker, test-quality) — never the whole codebase, so review cost stays flat as the project grows. Effort scales to the change.
- **Propagation on change.** Changing a done node asks one question: *did the contract change?* If not, fix just that spot. If so, find the nodes that used it and re-review them. Nothing more.

## The seven skills

One per step of a node's life: `draft → approved → implemented → reviewed ⇄ fixed → done`.

| Skill | What it does |
|---|---|
| `grovespec-init` | First-time setup (once). From whatever you have — idea, spec, or existing code — produces the brief, tree, and the root Task (greenfield) or the whole existing tree (brownfield). |
| `grovespec-grow` | Write **one** new node's *draft spec* (no code). Its own children are decided later, at *its* implement. |
| `grovespec-verify` | Cold, multi-role, parallel review of the **draft spec** → human approve (`draft → approved`). The anti-rubber-stamp gate, spent where a flaw is cheapest. |
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
  ref/               original reference docs, kept as-is + a location map
.grovespec/config.yaml  paths · review settings · language
```

**Headers and field names are fixed (English) — the parser contract. The content is written in your project's language** (`config.language`, set once at init). A Korean team writes Korean specs under English headers; an English team writes English. Plain language — in whatever language you work in.

## Using it

GroveSpec is currently a set of Claude Code skills. To adopt it in a project:

1. Copy `.claude/skills/grovespec-*` and `.grovespec/` into your repo.
2. Ask Claude: **"grovespec init"** — it creates `docs/` (brief, tree, first Tasks) and `.grovespec/config.yaml`.
3. From there, per node: **"grow the next node"** → **"verify it"** → **"implement it"** → **"review it"** (→ **"fix"** if issues), looping down the tree.

**See a complete worked project:** [examples/expense-cli](examples/expense-cli) — a **brownfield** mini-CLI: its existing code *documented* as filled brief · tree · Tasks (real Contracts, honest gaps). The best way to see what good specs look like before you start.

**Optional deterministic checks** ship in `.grovespec/bin/grovespec` (no install — needs only `bash`, which the required `git` already provides on every OS):

- `validate` — format + graph coherence (orphans, cycles, impossible states); exits non-zero with fixes.
- `status` — each node's state + which are unblocked, and what's next.
- `check [TASK-N]` — is a node ready to work (parent done + blocked_by done), and what's the next step (verify/implement/review/fix/grow)? The top-down gate `grow`/`verify`/`implement` run, so the build can't drift bottom-up.
- `impact TASK-N` — the consumer set a contract change reaches (the blast radius).
- `tree` — the id-only tree rendered with names + status.

They're a bonus enforcement floor (CI-friendly); the core loop runs on the skills + cold review without them.

> A one-command installer (`npx grovespec`) is on the roadmap.

## Design docs

- [METHODOLOGY.md](METHODOLOGY.md) — the *what and why*: the principles and the reasoning behind them.
- [WORKFLOW.md](WORKFLOW.md) — the *how*: the workflow, the steps, and how the skills are divided.

## Influences

GroveSpec stands on earlier spec-driven work, with thanks. Its *explore* stance is influenced by [OpenSpec](https://github.com/Fission-AI/OpenSpec)'s explore mode. The cold, multi-reviewer gate and the one-node-ahead tree are GroveSpec's own response to the rubber-stamp reviews and spec↔code drift that every spec workflow meets at scale — territory charted by [BMAD-METHOD](https://github.com/bmadcode/bmad-method) and [Spec-Kit](https://github.com/github/spec-kit). Different bets, shared lineage.

## Status

Early. Validated by a controlled cold-spawn, multi-reviewer run on a planted-flaw sample — it caught the planted flaws, emergent ones, *and* flaws its own fixes introduced (no false convergence). Not yet used on a real project or packaged as a tool; expect rough edges.

---

*Plain language, no coined terms — a spec you can't read at a glance is a spec you can't trust.*
