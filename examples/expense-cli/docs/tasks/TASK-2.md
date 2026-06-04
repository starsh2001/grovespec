---
id: TASK-2
name: "storage (shared store)"
role: feature
status: done
blocked_by: []
tdd: true
tdd_skip_reason: ""
---

## Overview
Reads and writes expense records to one JSON file (`expenses.json`). add/list/report reach the data only through this module. Defines the record shape and the storage rules in one place.

## Requirements
- Read all stored expenses as a list.
- Save the whole list to the file.
- Append one expense to the end of the existing data.

## Contract
Other nodes (add/list/report) use storage by this contract alone, without seeing its internals.
- **record shape**: `{"date": "YYYY-MM-DD", "category": str, "amount": int, "note": str}`. `amount` is a whole-won integer.
- **`load()`**: no args. Returns the list of records. File missing → returns `[]` (not an exception).
- **`save(records)`**: writes the whole list, overwriting. UTF-8, `ensure_ascii=False`, `indent=2`. Returns nothing.
- **`add_record(record)`**: `load()` → append → `save()`. Always appends to the end (no sort, no dedup).
- **Responsibility split**: storage *defines* the record shape but does *not validate* it — that's the caller's (add's) job.

## AC
- [x] `load()` returns `[]` when the file is missing
- [x] `load()` returns the stored list when the file exists
- [x] `save()` writes with `ensure_ascii=False`, `indent=2`
- [x] `add_record()` appends to the end
- [ ] (gap) `load()` raises on a broken/empty file — undefined in the contract
- [ ] (gap) no lock on save/add_record — concurrent runs clobber — undefined in the contract

## Subtasks
- [x] load/save/add_record (storage.py)
- [ ] tests for load (missing→`[]`) and append

## Change Log
- 2026-06-04 — initial node. Froze the record shape, `amount` unit, missing-file behavior, and the "caller validates" split.
