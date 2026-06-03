# GroveSpec

**A spec methodology for agentic coding that keeps spec and code from drifting apart — by changing only a small *partial tree* at a time.**

GroveSpec is a set of [Claude Code](https://claude.com/claude-code) skills + templates. You grow a project as a **tree of nodes**, where each node publishes a **Contract** — what it guarantees to the outside, so other nodes can rely on it without reading its internals. The spec stays *one node ahead* of the code, and every change is gated by a **cold, multi-reviewer** pass.

## The problem it targets

At scale, spec-driven workflows tend to fail in two ways:

- **Specs a human can't actually review** — vast documents full of terms a person can't follow, so review degrades into a rubber stamp.
- **Drift** — the spec and the code slowly disagree, because one change ripples through a document nobody re-reads.

GroveSpec fights both: keep each change inside a **small partial tree** (so it's cheap to review deeply), and keep specs **plain enough to confirm at a glance**.

## How it works

```
init (once)
  → [ grow → implement → done ]   grow the tree one node at a time
  → revise                        change an already-done node later
```

- **Tree of contracts.** A project is a tree. Each node is a `Task` with a **Contract** (what it takes, gives, and guarantees). Consumers depend on the Contract, never the internals — so the blast radius of a change is bounded by the contracts it touches.
- **One node ahead.** The spec leads the code by exactly one layer. The tree is a *hypothesis*, refined as you build — not a big design locked in up front.
- **Cold review gate.** Both grow (spec) and implement (code) end in a review loop: several *fresh-eyes* reviewers — who never saw how it was built — inspect in parallel with different roles (consumer-impersonator, gap-finder, coherence, non-expert, breaker), the findings are triaged, and the caller fixes. Review effort scales to the size of the change.
- **Propagation on change.** Changing a done node asks one question: *did the contract change?* If not, fix just that spot. If so, find the nodes that used it and re-review them. Nothing more.

## The five skills

| Skill | What it does |
|---|---|
| `grovespec-init` | First-time setup (once). From whatever you have — idea, spec, or existing code — produces the brief, tree, and top-level Tasks. |
| `grovespec-grow` | Write the next node's *concept spec* (no code). For a skeleton, also defines its children's contracts. |
| `grovespec-implement` | Turn a confirmed spec into code: pre-check → tests first → code → review → done. |
| `grovespec-review` | Cold, multi-role, parallel review that returns a triaged issue list. The anti-rubber-stamp gate. |
| `grovespec-revise` | Change an already-done node — behavior (reopen + propagate) or structure (split·merge·move). |

## Artifacts

```
docs/
  brief.md           direction · scope · risks
  tree.md            the node tree (ids only)
  conventions.md     glossary · common rules
  tasks/TASK-N.md    one node each: Overview · Requirements · Contract · AC · Subtasks · Change Log
  ref/               original reference docs, kept as-is + a location map
config.yaml          paths · review settings · language
```

**Headers and field names are fixed (English) — the parser contract. The content is written in your project's language** (`config.language`, set once at init). A Korean team writes Korean specs under English headers; an English team writes English. Plain language — in whatever language you work in.

## Using it

GroveSpec is currently a set of Claude Code skills. To adopt it in a project:

1. Copy `.claude/skills/grovespec-*` and `.grovespec/` into your repo.
2. Ask Claude: **"grovespec init"** — it sets up the brief, tree, and first Tasks.
3. From there: **"grow the next node"**, then **"implement it"**, looping down the tree.

> A one-command installer (`npx grovespec`) and a human-facing tree view are on the roadmap.

## Design docs

- [METHODOLOGY.md](METHODOLOGY.md) — the *what and why*: the principles and the reasoning behind them.
- [SKILLS.md](SKILLS.md) — the *how*: the workflow, the steps, and how the skills are divided.

## Status

Early, and validated by dogfooding — including a real cold-spawn, multi-reviewer run that caught planted flaws, emergent ones, *and* flaws introduced by its own fixes (no false convergence). Not yet a packaged tool; expect rough edges.

---

*Plain language, no coined terms — a spec you can't read at a glance is a spec you can't trust.*
