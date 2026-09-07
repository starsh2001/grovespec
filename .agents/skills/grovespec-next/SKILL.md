---
name: grovespec-next
description: Runs the next GroveSpec step for you — asks the runtime which node and which step is due, invokes that ONE step skill, and stops. Its last line is NOTHING_TO_WORK when nothing can proceed without you, so a queue runner or loop can stop on it. Two modes: by default it stops at the human's gates (approve a spec, confirm a result); when the user asks for auto in that same invocation ("자동으로", "그냥 진행해", "next auto") it also takes gates that came out clean — recorded as approved_by machine and resurfaced every run until ratified, never as human approval. Use when the user wants to "do the next thing / just keep going / continue the build / grovespec next / 다음 작업 진행 / 알아서 이어서 해줘 / 자동으로 진행 / 다음 단계 실행", or wants one repeatable command to drive the build from a script.
---

# grovespec-next

Runs **one** step — the one that's due — and stops. You don't have to know which node or which skill; the runtime does.

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `node .grovespec/bin/grovespec.mjs lang`) and write **every** reply in that language. These files are English; your output is not.

## What it is
A driver over the eight step skills, and nothing more: **it carries no rules of its own** — each step's rules live in that step's skill, and duplicating them here is exactly the drift GroveSpec exists to stop. Repetition isn't its job either (§ *Looping it*) — one step per invocation is what keeps each session bounded (WORKFLOW §5).

## Two modes

**Ask — the default.** Approving a spec (`→ approved`) and confirming a result (`→ done`) are the human's; `grovespec next` skips nodes parked there and you report what each is waiting for.

**Auto — only when the user asks for it in *this* invocation** ("그냥 진행해", "자동으로", `next auto`). Never a remembered setting: a mode you can forget you turned on approves things you never saw. Then use `next --auto`, and:

- **A clean gate is taken by the machine and recorded as such.** `grovespec approve TASK-N` flips the status and writes `approved_by: machine`; add one Change-Log line saying so, then **commit those bytes as `approve TASK-N: <summary>`** (the decision-turn shape — `FORMATS.md` "Commits"; a `ratify` turn commits as `ratify TASK-N: …` the same way). Left uncommitted they are the dirty tree the next step stops on; given a `TASK-N: ` prefix they pollute the next cycle's diff anchor. Never edit that field by hand, and never call such a node approved without the word *machine* — `status`/`validate` keep naming it until someone runs `grovespec ratify`.
- **Only clean.** `approve` refuses an escalated record or one carrying open issues. Approving past a finding is deleting it — report a refusal, don't route around it.
- **A refused gate is not a stopped build.** Those two refusals send the work to *different* places, and only one of them is yours to end on: **open issues are ordinary progress** — the record stays `reviewed`/`in-progress` and the next step is `grovespec-fix` (or this cycle's fix phase), which auto runs like any other. **`escalated` is the human's** — but it means one thing only: the cycle spent its `max_rounds` without closing. Confirmed defects at round 3 of 15 are not an escalation; writing one there ends the loop over work the machine could have done.
- **A question with no recommended option is a real gap** (a name, a policy, a constraint the project genuinely hasn't decided) — stop and ask it. Inventing a default is the one thing a spec tool must never do.
- **The tree gate stays the human's in both modes** — a wrong decomposition is the most expensive thing to build forty nodes on top of; let `grovespec-verify` ask for it.

Say that in the invocation when you call a step skill in auto mode: take marked recommendations and record what was taken, don't ask for the final approval of a **node gate** (leave the node with its passed record — the next turn takes the gate), stop on a question with no recommendation. What this never covers is the decisions the mode reserves for the human above — plan's disposition confirm and the tree gate are **asked**, not taken.

## 1. Check the floor
`node .grovespec/bin/grovespec.mjs validate` — non-zero → **stop**: state the problems, then close with `NOTHING_TO_WORK — validate: <the first problem>`. This is the **one** place that token is written without a `next` answer to read it from — the floor is broken, so the machine's own answer can't be trusted, and re-entering the loop would just hit the same wall. Never build on a broken tree; automation multiplies the damage.

## 2. Ask what's due
`node .grovespec/bin/grovespec.mjs next` (auto mode: `next --auto`) — it answers one of:
- `next: TASK-N (name) <status> → <skill>` — run it (§3). It may also list what's waiting on the human; carry those into your report. In auto mode the step may be `grovespec approve` — that's the clean gate, taken as machine.
- `next: tree → grovespec-verify (…)` — a tree gate is armed (decomposition, or the brownfield survey's fidelity) — run `grovespec-verify` on the tree (§3).
- `next: plan — …` — the planning pass is due (the tree is empty = plan #0 · every node done with parked work = the next round) — run `grovespec-plan` (§3). Its decisions (the disposition confirm, the tree gate it ends on) stay the human's in both modes.
- `nothing runnable — …` — **stop** and go to §4. The reason is on the line: everything done with nothing parked · everything blocked · waiting on you (with which decision, per node).

Take its answer as given. **Don't re-derive the pick**, and don't pick a different node because one looks more interesting — a driver that chooses differently each run isn't repeatable, which is the point of having it. Only the user naming a node overrides it.

## 3. Run that one step
Invoke the named **step** in this session — a skill, or a decision command like `grovespec approve` (never as a subagent — verify·review spawn their cold reviewers, and nesting silently degrades them to a warm self-check). It owns everything from here: its preconditions, its questions, its output. A decision turn ends the same way every skill does: its commit (`FORMATS.md` "Commits"), then the two commands below.

When it finishes, run **two** commands:
- `validate` — if the step broke something, say so rather than reporting a clean run.
- **`grovespec next` again, with the SAME flags as §2's run** — auto mode re-runs `next --auto`. Its answer, not your reading of the situation, decides §4's last line. (Dropping `--auto` here re-creates the very bug this rule exists for: plain `next` answers *waiting on you* at a gate the machine is allowed to take, and the loop dies at every clean gate.)

## 4. Report, then the final line
**Report.** When a step skill ran, its own step-report closing (`FORMATS.md` "The step report") *is* the report — don't re-summarize it; add only what the driver knows: **anything the machine approved**, named, with what it still needs (a human's look, then `grovespec ratify`). When nothing ran, say in that same closing shape what is waiting on the human (each item: what it is · the issue in one line · what's needed).

Then the last line — **read it off the `grovespec next` you just ran, don't decide it**:

| that run answered | your last line |
|---|---|
| `nothing runnable — …` | exactly `NOTHING_TO_WORK — <the reason it gave>` |
| anything else (`next: TASK-N …` · `next: tree …` · `next: plan …`) | **no final line at all** — end with that `next: …` so the loop keeps going |

One exception, and only this one: **a question you put to the user is still unanswered when your turn ends** (the *Two modes* rule above: a question with no recommended option, or any question a step skill genuinely had to ask). Then close with `NOTHING_TO_WORK — waiting on you: <the question>` even though `next` still names a step. **Answered questions don't count** — a blocking question tool that already returned the answer leaves nothing to wait for; keep going.

Three things that are **not** reasons to stop, because each has already been handled:
- **A step skill recommending a new session.** They all do, and they are right to — but `@new` in the loop *is* that new session. The recommendation is addressed to a person driving by hand.
- **A gate the machine took** (`approved_by: machine`). It is recorded and resurfaced every run; the build proceeds.
- **A gap or open question the step parked in the record** (a `(gap)` AC item, a followup). Those are later work by design — `next` knows, and it still named a step.

**Write that token nowhere else in the reply** — a loop substring-matches the whole response, so a mention in passing stops it early.

## Looping it
```
@loop max=20 until="NOTHING_TO_WORK"
  @new
  grovespec next
@end
```
`@new` per iteration gives each step a fresh session. Ask mode stops early and often — at every approval and every confirm; **that is the method working, not a failure**, and the run has already done all the machine work up to it. `grovespec next auto` runs much further and hands back nodes marked `approved_by: machine`: **the cold review ran, the intent check didn't** — reviewers see the spec and the code, never what you meant. Nodes nobody ratifies are a project that passed no human gate at all.
