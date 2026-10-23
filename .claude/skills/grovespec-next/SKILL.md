---
name: grovespec-next
description: Runs the next GroveSpec step for you — asks the runtime which node and which step is due, invokes that ONE step skill, and stops. Its last line is NOTHING_TO_WORK when nothing can proceed without you, so a queue runner or loop can stop on it. It stops at decisions, never at stages — a gate that came out clean with nothing to decide is taken on the record (approved_by machine, never counted as your approval) and the loop goes on; it stops only where a decision is genuinely yours (an ambiguous requirement · a product behavior or scope choice · accepting an unmet requirement), asked with the issue, the options, their impact and a recommendation. Two modes: by default (ask) every such decision stops for you; when the user asks for auto in that same invocation ("자동으로", "그냥 진행해", "next auto") a decision that carries a recommended option is taken as recommended and only one with no defensible recommendation stops. Use when the user wants to "do the next thing / just keep going / continue the build / grovespec next / 다음 작업 진행 / 알아서 이어서 해줘 / 자동으로 진행 / 다음 단계 실행", or wants one repeatable command to drive the build from a script.
---

# grovespec-next

Runs **one** step — the one that's due — and stops. You don't have to know which node or which skill; the runtime does.

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `node .grovespec/bin/grovespec.mjs lang`) and write **every** reply in that language. These files are English; your output is not.

## What it is
A driver over the nine step skills, and nothing more: **it carries no rules of its own** — each step's rules live in that step's skill, and duplicating them here is exactly the drift GroveSpec exists to stop. Repetition isn't its job either (§ *Looping it*) — one step per invocation is what keeps each session bounded (WORKFLOW §5).

## What stops the loop: a decision, never a stage
The rule and the shape of the ask are one paragraph in `FORMATS.md` "The step report" (*A decision, not a stage*): the person is stopped only where a decision is genuinely theirs — an ambiguous requirement, a product behavior or scope choice, accepting an unmet or unverifiable requirement — and the ask carries **the issue · the options · each option's impact · the recommended one**. A gate that came out clean within the agreed requirements is **not** a decision: its verdict is recorded and the build goes on. No issue, no ask.

**A clean gate is taken on the record, in both modes — by the gate skill itself, in the turn that sealed it.** verify and review end a clean pass with `pin` → the gate commit → `node .grovespec/bin/grovespec.mjs approve TASK-N`, which flips the status and writes `approved_by: machine` — the cold verdict, recorded as the machine's and never as the person's (`FORMATS.md` "`approved_by` states"). `grovespec next` names that same `grovespec approve TASK-N` only for a record left sealed but untaken — an interrupted turn, or a record from before the skills took it themselves; run it then exactly as the skill would: add one Change-Log line saying so, then **commit those bytes as `approve TASK-N: <summary>`** (the decision-turn shape — `FORMATS.md` "Commits"; a `ratify` turn commits as `ratify TASK-N: …` the same way). Never edit that field by hand, and never call such a node approved without the word *machine* — `status`/`validate` keep naming it until someone runs `grovespec ratify`.

## Two modes

**Ask — the default.** Every decision stops for the person: the step skill asks it in the four-part shape through the host's question tool, and the loop waits for the answer — only an ask written into the closing, on a host with no question tool, ends the loop (§4). Nothing else stops the loop — not a clean gate, not a step's new-session recommendation, not a parked followup.

**Auto — only when the user asks for it in *this* invocation** ("그냥 진행해", "자동으로", `next auto`). Never a remembered setting. Then use `next --auto`, and the step skill is told to **take a decision that carries a recommended option** — as recommended, recording what was taken and why — and to stop only at **a question with no defensible recommendation** (a name, a policy, a constraint the project genuinely hasn't decided).

In both modes:
- **Only clean.** `approve` refuses an escalated record or one carrying open issues. Approving past a finding is deleting it — report a refusal, don't route around it.
- **A refused gate is not a stopped build.** Those two refusals send the work to *different* places, and only one of them is yours to end on: **open issues are ordinary progress** — the record stays `reviewed`/`in-progress` and the next step is `grovespec-fix` (or this cycle's fix phase), which runs like any other. **`escalated` is the human's** — but it means one thing only: the cycle spent its `max_rounds` without closing — confirmed defects inside the budget are not one.
- **The tree gate and plan's disposition confirm stay the human's in both modes** — a decomposition and a disposition *are* scope choices; let `grovespec-verify` / `grovespec-plan` ask them, with the tree or the table as the issue.
- **A step resumes where its record stands — a new run never restarts a cycle.** A review/fix cycle's state file carries its phase, current item, and counters; the step skill continues from them. A new session is a new context, not a new sweep.
- **The record list is not the loop's queue.** `followups` (improvements · harmless bugs) never becomes work because the loop had nothing else to do — a gate that closed with only record-list items left is a **pass**, and the only route from that list into the build is the user picking an item at a planning pass. In ask mode that pick *is* a decision, so the terminal routes to `grovespec-plan`; in auto mode nobody is there to pick, and the runtime agrees: with every node done and only record-category items parked, `next --auto` answers *nothing runnable* (naming the list). Routed must-fix work, unclassified legacy items, the brownfield backlogs and fresh signals still route to plan in every mode — until a plan has ruled on them: parked work the newest plan kept parked, untouched since, answers *nothing runnable* (naming that plan).

Say the mode in the invocation when you call a step skill: **ask** — put every decision to the user in the four-part shape, and take a gate with nothing to decide on the record (`approve`, machine) in that same turn; **auto** — take marked recommendations and record what was taken (never the person's OK to touch their machine — `FORMATS.md` "The person's machine"), stop on a question with no recommendation. In neither mode ask for approval of a gate that has nothing to decide.

## 1. Check the floor
`node .grovespec/bin/grovespec.mjs validate` — non-zero → **stop**: state the problems, then close with `NOTHING_TO_WORK — validate: <the first problem>`. This is the **one** place that token is written without a `next` answer to read it from — the floor is broken, so the machine's own answer can't be trusted, and re-entering the loop would just hit the same wall. Never build on a broken tree; automation multiplies the damage.

## 2. Ask what's due
`node .grovespec/bin/grovespec.mjs next` (auto mode: `next --auto`) — it answers one of:
- `next: TASK-N (name) <status> → <skill>` — run it (§3). It may also list what's waiting on the human, and nodes another worktree holds or finished on a branch not merged here (skipped here); carry those into your report. The step may be `grovespec approve` — a sealed clean gate, taken on the record in either mode.
- `next: tree → grovespec-verify (…)` — a tree gate is armed (decomposition, or the brownfield survey's fidelity) — run `grovespec-verify` on the tree (§3).
- `next: recheck — …` — a contract change landed and its candidates are armed — run `grovespec-recheck` (§3): one step judges reach for them all; only judged-touched nodes reopen. Same in both modes.
- `next: retro — …` — every node is done and the milestone owes its closing look — run `grovespec-retro` (§3). It asks nothing and reopens nothing, so it runs the same in both modes.
- `next: plan — …` — the planning pass is due — run `grovespec-plan` (§3). Its decisions (the disposition confirm, the tree gate it ends on) stay the human's in both modes.
- `nothing runnable — …` — **stop** and go to §4. The reason is on the line: everything done with nothing parked · everything blocked, or held by another worktree (a node, or the tree-wide step that is due) · waiting on you (an escalation or the tree gate, per node).

Take its answer as given. **Don't re-derive the pick**, and don't pick a different node because one looks more interesting. Only the user naming a node overrides it.

## 3. Run that one step
Invoke the named **step** in this session — a skill, or a decision command like `grovespec approve` (never as a subagent — verify·review spawn their cold reviewers, and nesting silently degrades them to a warm self-check). It owns everything from here: its preconditions, its questions, its output. A decision turn ends the same way every skill does: its commit (`FORMATS.md` "Commits"), then the two commands below.

When it finishes, run **two** commands:
- `validate` — if the step broke something, say so rather than reporting a clean run.
- **`grovespec next` again, with the SAME flags as §2's run** — auto mode re-runs `next --auto`. Its answer, not your reading of the situation, decides §4's last line. (The two modes answer differently at the terminal — the record list ends an auto run and routes an ask run to plan — and a flag dropped here switches the build's mode mid-loop.)

## 4. Report, then the final line
**After the step, `node .grovespec/bin/grovespec.mjs claim end`** — the step's mark ends (harmless when the step already ended it).

**Report.** When a step skill ran, its own step-report closing (`FORMATS.md` "The step report") *is* the report — don't re-summarize it; add only what the driver knows. Machine-taken gates are not re-listed — their backlog is named once, at the milestone's retro. When nothing ran, say in that same closing shape what is waiting on the human (each item: what it is · the issue in one line · what's needed).

Then the last line — **read it off the `grovespec next` you just ran, don't decide it**:

| that run answered | your last line |
|---|---|
| `nothing runnable — …` | exactly `NOTHING_TO_WORK — <the reason it gave>` |
| anything else (`next: TASK-N …` · `next: tree …` · `next: recheck …` · `next: retro …` · `next: plan …`) | **no final line at all** — end with that `next: …` so the loop keeps going |

One exception, and only this one: **a decision you put to the user is still unanswered when your turn ends** — asked in your closing because the host has no question tool (a step skill's four-part ask in ask mode, or in auto mode a question with no recommended option). Then close with `NOTHING_TO_WORK — waiting on you: <the issue>` even though `next` still names a step. **A question asked through the host's question tool never ends on the token** — a blocking tool already returned its answer, and an async one's answer comes back as your next message; keep going from it.

Three things that are **not** reasons to stop, because each has already been handled:
- **A step skill recommending a new session.** They all do, and they are right to — but `@new` in the loop *is* that new session. The recommendation is addressed to a person driving by hand.
- **A gate the machine took** (`approved_by: machine`). It is recorded and resurfaced every run; the build proceeds.
- **A gap or open question the step parked in the record** (an `accepted-gap` ruling, a followup). Those are later work by design — `next` knows, and it still named a step.

**Write that token nowhere else in the reply** — a loop substring-matches the whole response, so a mention in passing stops it early.

## Looping it
```
@loop max=20 until="NOTHING_TO_WORK"
  @new
  grovespec next
@end
```
`@new` per iteration gives each step a fresh session. Ask mode stops at every decision that is the person's — **that is the method working, not a failure** — and at nothing else; a clean gate is recorded and passed through. Auto runs further still, taking recommended options too, and hands back `approved_by: machine` nodes and recorded decisions that resurface every run until a person ratifies (why that trade is stated instead of silent: METHODOLOGY §9).
