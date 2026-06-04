"""Shared store (TASK-2). Expenses as a list of records in one JSON file.

record shape: {"date": "YYYY-MM-DD", "category": str, "amount": int, "note": str}
- amount is a whole-won (KRW) integer. No decimals/cents.
"""
import json
from pathlib import Path

DATA_FILE = Path("expenses.json")


def load():
    if not DATA_FILE.exists():
        return []
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def save(records):
    DATA_FILE.write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def add_record(record):
    records = load()
    records.append(record)
    save(records)
