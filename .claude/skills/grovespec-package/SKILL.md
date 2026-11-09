---
name: grovespec-package
description: Runs ONE work package — the nodes a plan bundled for one session and one implementer model — through every gate in that session: their specs, one light cold spec check, TDD node by node, one test run, one cold code review of the package's joined diff, and the seals. Each step's rules stay in its own skill (grow · verify · implement · review · fix); this skill gives only the order and the package's scope. Use when `grovespec next` names a WP-N, or the user asks to "run the package / build WP-3 / grovespec package / 작업 패키지 진행".
---

# grovespec-package

A work package (`WP-N`) is a set of nodes the plan gave one session and one implementer model, sized to its budget (config `packages:`; why: METHODOLOGY §6). Every node keeps its own spec, records, seals and Change Log, and every gate is the one its skill states.

> **Language: read it first.** Read `language:` from `.grovespec/config.yaml` (or `node .grovespec/bin/grovespec.mjs lang`) and write **every** reply in that language. These files are English; your output is not.

> **Where it runs.** The main session — it spawns the cold reviewers as subagents (never run this skill as one). The session should be the package's model: `grovespec next` names it, and a driver opens the session with it.

## The rules come from the step skills
Read each step skill once and apply it to every node in turn: `grovespec-grow` · `grovespec-verify` · `grovespec-implement` · `grovespec-review` · `grovespec-fix`. Where one says to commit as `<step> TASK-N:` or to recommend a new session, the package does this instead: gate commits are `<step> WP-N: …`, and the session goes on. Code commits stay `TASK-N: <step> — …` per node — they are the cycle-diff anchors. A parent or blocker inside the package counts as ready for every step's readiness rule while it can itself go on (`grovespec check` agrees). Approve members in tree order, parents first.

## 0. Claim and read
`node .grovespec/bin/grovespec.mjs package` shows the package. Claim every member not yet done — `node .grovespec/bin/grovespec.mjs claim TASK-N package` — non-zero = **stop** and report what it printed. Read each member's Task, the Contracts of the nodes it builds on, and `conventions.md`, once.

## 1. Specs
In tree order, each member that is a sketch or a reopened draft gets what grow writes. Commit as `grow WP-N: <summary>`.

## 2. One light cold spec check
grovespec-verify's cycle, once for the whole package at `light` (the reviewer count from `verify.scale`): each member's source packet goes into its own round brief (`grovespec source TASK-N`), and the reviewers read every member's spec and packet together — the seams between members are in scope. Findings are classified into each member's own verify record; fixes and confirmations run as verify says. Clean → `pin` each member → commit `verify WP-N: …` → `approve` each member → commit `approve WP-N: …`.

## 3. Build, node by node
The approvals of §2 ended the step mark, so claim each member again first (as in §0). In tree order, each member: tests first (per its `tdd`), then code, then its decomposition check — implement's rules, its write scope included. Inside a package a value one member defines for another is an order, not a wait: build the definer first. Commit each member as `TASK-N: implement — …`.

## 4. One test run, one cold code review
`node .grovespec/bin/grovespec.mjs test WP-N` runs the per-unit suite once and records it into every open member. Then grovespec-review's cycle once over `node .grovespec/bin/grovespec.mjs diff WP-N` — the members' cycles joined: scale by the joined diff, find until `find_streak`, each must-fix item in its member's record and fixed one at a time as grovespec-fix says. Each member's AC duty is checked against the run. Clean → `pin` each member → commit `review WP-N: …` → `approve` each member → commit `approve WP-N: …`.

## 5. Close
`node .grovespec/bin/grovespec.mjs claim end`. A decision stops the package exactly as it stops a step (`FORMATS.md` "A decision, not a stage"). An escalated member waits for the person while the members that do not lean on it go on. A resumed session continues from the members' records.

> **Open and close in the step-report shape** (`FORMATS.md` "The step report"), one row per member. *Open / Your turn* typically carry: a member that could not finish and why · an escalation · a budget the package ran far over or under.
