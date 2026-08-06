---
name: grovespec-next
description: Runs the next GroveSpec step for you — asks the runtime which node and which step is due, invokes that ONE step skill, and stops. Its last line is NOTHING_TO_WORK when nothing can proceed without you, so a queue runner or loop can stop on it. Two modes: by default it stops at the human's gates (approve a spec, confirm a result); when the user asks for auto in that same invocation ("자동으로", "그냥 진행해", "next auto") it also takes gates that came out clean — recorded as approved_by machine and resurfaced every run until ratified, never as human approval. Use when the user wants to "do the next thing / just keep going / continue the build / grovespec next / 다음 작업 진행 / 알아서 이어서 해줘 / 자동으로 진행 / 다음 단계 실행", or wants one repeatable command to drive the build from a script.
---

# grovespec-next

Runs **one** step — the one that's due — and stops. You don't have to know which node or which skill; the runtime does.

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `node .grovespec/bin/grovespec.mjs lang`) and write **every** reply in that language. These files are English; your output is not.

## What it is
A driver over the seven step skills, and nothing more: **it carries no rules of its own** — each step's rules live in that step's skill, and duplicating them here is exactly the drift GroveSpec exists to stop. Repetition isn't its job either (§ *Looping it*) — one step per invocation is what keeps each session bounded (WORKFLOW §5).

## Two modes

**Ask — the default.** Approving a spec (`→ approved`) and confirming a result (`→ done`) are the human's; `grovespec next` skips nodes parked there and you report what each is waiting for.

**Auto — only when the user asks for it in *this* invocation** ("그냥 진행해", "자동으로", `next auto`). Never a remembered setting: a mode you can forget you turned on approves things you never saw. Then use `next --auto`, and:

- **A clean gate is taken by the machine and recorded as such.** `grovespec approve TASK-N` flips the status and writes `approved_by: machine`; add one Change-Log line saying so. Never edit that field by hand, and never call such a node approved without the word *machine* — `status`/`validate` keep naming it until someone runs `grovespec ratify`.
- **Only clean.** `approve` refuses an escalated record or one carrying open issues. Approving past a finding is deleting it — report a refusal, don't route around it.
- **A question with no recommended option is a real gap** (a name, a policy, a constraint the project genuinely hasn't decided) — stop and ask it. Inventing a default is the one thing a spec tool must never do.
- **The tree gate stays the human's in both modes** — a wrong decomposition is the most expensive thing to build forty nodes on top of; let `grovespec-verify` ask for it.

Say that in the invocation when you call a step skill in auto mode: take marked recommendations and record what was taken, don't ask for the final approval (leave the node with its passed record — the next turn takes the gate), stop on a question with no recommendation.

## 1. Check the floor
`node .grovespec/bin/grovespec.mjs validate` — non-zero → **stop**: state the problems in your reply, then the final line (§4). Never build on a broken tree; automation multiplies the damage.

## 2. Ask what's due
`node .grovespec/bin/grovespec.mjs next` (auto mode: `next --auto`) — it answers one of:
- `next: TASK-N (name) <status> → <skill>` — run it (§3). It may also list what's waiting on the human; carry those into your report. In auto mode the step may be `grovespec approve` — that's the clean gate, taken as machine.
- `nothing runnable — …` — **stop** and go to §4. The reason is on the line: everything done · everything blocked · waiting on you (with which decision, per node).

Take its answer as given. **Don't re-derive the pick**, and don't pick a different node because one looks more interesting — a driver that chooses differently each run isn't repeatable, which is the point of having it. Only the user naming a node overrides it.

## 3. Run that one step
Invoke the named skill **in this session** (never as a subagent — verify·review spawn their cold reviewers, and nesting silently degrades them to a warm self-check). It owns everything from here: its preconditions, its questions, its output. When it finishes, run `validate` once more — if the step broke something, say so rather than reporting a clean run.

## 4. Report, then the final line
**Surface, don't point.** What ran · what changed · what is now waiting on the human (each item: what it is, the issue in one line, what's needed) — in the message, with file paths after the substance, never instead of it. **Anything the machine approved goes in this list too**, named, with what it still needs (a human's look, then `grovespec ratify`).

Then, as the **very last line** of your reply:
- More can proceed without the human → **no final line at all**; end with `next: …` so the loop keeps going.
- Nothing can proceed → exactly:

  `NOTHING_TO_WORK — <reason>`

  Reason = the one `grovespec next` gave (every node done · every remaining node blocked · waiting on you: which decision, which node).

**Write that token nowhere else in the reply** — a loop substring-matches the whole response, so a mention in passing stops it early.

## Looping it
```
@pauseword "NOTHING_TO_WORK"
@loop max=20 until="NOTHING_TO_WORK"
  @new
  grovespec next
@end
```
`@new` per iteration gives each step a fresh session. Ask mode stops early and often — at every approval and every confirm; **that is the method working, not a failure**, and the run has already done all the machine work up to it. `grovespec next auto` runs much further and hands back nodes marked `approved_by: machine`: **the cold review ran, the intent check didn't** — reviewers see the spec and the code, never what you meant. Nodes nobody ratifies are a project that passed no human gate at all.
