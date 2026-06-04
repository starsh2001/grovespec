<!-- Implementation notes. Headers fixed; content in config.language. -->

## Glossary
- one expense: "record" (used everywhere — code and contracts)
- category: "category" (e.g. food, transport)
- data file: `expenses.json`

## Common Rules
- `amount` is an integer in whole won (KRW) — no decimals/cents.
- All expenses live in one `expenses.json` as a list of records; data access goes only through the storage module (commands never open the file directly).
- Files are written UTF-8, `ensure_ascii=False`, `indent=2`.
- The record shape is defined by storage (TASK-2): `{"date": "YYYY-MM-DD", "category": str, "amount": int, "note": str}`.
- Standard library only.
