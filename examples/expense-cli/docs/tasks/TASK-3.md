---
id: TASK-3
name: "add command"
role: feature
status: done
blocked_by: [TASK-2]
tdd: false
tdd_skip_reason: "existing code, documented after the fact (brownfield); tests to follow"
---

## Overview
Records one new expense. `add <YYYY-MM-DD> <category> <amount> [note]` → builds a record and appends it via storage.

## Requirements
- Save one expense from date·category·amount (required) + note (optional).
- Too few args (< 3) → usage + failure code.
- After saving, print one line of what was added.

## Contract
- Takes: positional args `[date, category, amount, note...]`. `note` joins the 4th+ args with spaces (empty if none).
- Gives: exit code. < 3 args → `1`. success → `0`.
- Invariant: `amount` is converted with `int()` (whole won, matches storage). A record is saved only via storage's `add_record`.
- Responsibility: add shapes the record to storage's contract (storage doesn't validate). *Value* validity (date format, amount numeric) is NOT checked by the current code.

(Consumes storage — see `blocked_by: [TASK-2]`. The parent is in tree.md, not here.)

## AC
- [x] ≥3 args → builds a record and appends it via storage
- [x] <3 args → usage + return `1`
- [x] success → prints the category·amount and returns `0`
- [ ] (gap) non-numeric `amount` crashes at `int()` — undefined in the contract
- [ ] (gap) `date` format isn't validated — any string is stored — undefined in the contract

## Subtasks
- [x] parse args → record → storage.add_record (add.py)
- [ ] tests: too-few-args, normal add

## Change Log
- 2026-06-04 — initial node. blocked_by storage (TASK-2). Input-validation gaps (amount/date) left marked.
