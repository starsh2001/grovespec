---
id: TASK-4
name: "list command"
role: feature
status: done
blocked_by: [TASK-2]
tdd: false
tdd_skip_reason: "existing code, documented after the fact (brownfield); tests to follow"
---

## Overview
Shows every stored expense, one per line, in the order they were saved.

## Requirements
- Print all expenses (date, category, amount, note).

## Contract
- Takes: ignores its args.
- Gives: exit code `0` (always). Prints one line per record to stdout.
- Invariant: reads everything via storage's `load()`, prints in stored order (no sort). Amounts right-aligned with thousands commas. `note` read with `.get("note", "")` (storage allows a missing note).
- Responsibility: storage reads the data; list formats and prints.

(Consumes storage — `blocked_by: [TASK-2]`.)

## AC
- [x] prints one line per record with date·category·amount·note
- [x] empty data → prints nothing, returns `0`
- [ ] (gap) a record missing `date`/`category`/`amount` raises KeyError — undefined (storage is assumed to guarantee the shape)

## Subtasks
- [x] read → format → print (list_cmd.py)

## Change Log
- 2026-06-04 — initial node. blocked_by storage (TASK-2).
