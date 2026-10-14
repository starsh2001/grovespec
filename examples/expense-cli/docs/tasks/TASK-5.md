---
id: TASK-5
name: "report command"
role: feature
status: done
origin: mapped
blocked_by: [TASK-2]
tdd: false
tdd_skip_reason: "existing code, documented after the fact (brownfield); tests to follow"

---

# TASK-5 · report command

> Adds the expenses up by category and prints a total.

## Overview
Sums expenses by category and prints a total. Reads everything from storage, adds up each category, prints them in name order with a grand total.

## Requirements
- Show totals per category, then an overall total.

## Contract
- Takes: ignores its args.
- Gives: exit code `0` (always). Prints per-category totals + a separator + the grand total.
- Invariant: sums `amount` per category (whole won, matches storage), prints **category-name ascending**; the grand total is the sum of the category totals.
  - Amounts are right-aligned, with thousands commas.
  - Empty data prints just the separator and a `0` total — it doesn't crash.
- Responsibility: storage reads; report aggregates and displays.

(Consumes storage — `blocked_by: [TASK-2]`.)

## AC
- sums `amount` per category
- prints categories in ascending name order
- prints a grand total after a separator
- empty data → safe `0` total
- (gap) a record missing `category`/`amount` raises KeyError — undefined (storage assumed to guarantee the shape)

## Subtasks
- [x] sum by category → sort → print → total (report.py)

## Change Log
- 2026-06-04 — initial node. Froze "category ascending" + grand-total definition. blocked_by storage (TASK-2).
