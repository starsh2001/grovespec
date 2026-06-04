---
name: "expense-cli"
---

## Direction
A tiny command-line expense tracker. `python src/cli.py <add|list|report>` records expenses and shows them back. Every expense is appended to a single `expenses.json` file. No external dependencies — standard library only.

## Scope
- Does: add an expense, list all, report totals by category. JSON file storage.
- Doesn't: edit/delete, filters, budgets, multi-user, concurrency safety, input-format validation.

## Risks
- `add` converts the amount with `int()` — a non-numeric amount crashes. Dates aren't validated, so any string is stored as-is.
- `storage` has no lock between load and save — two concurrent runs can clobber each other.
- A corrupted or empty `expenses.json` makes `load()` raise — and add/list/report all depend on it.
