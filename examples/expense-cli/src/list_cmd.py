"""list command (TASK-4). Shows all expenses in stored order. Consumes storage."""
import storage


def run(args):
    for r in storage.load():
        note = r.get("note", "")
        print(f'{r["date"]}  {r["category"]:<10} {r["amount"]:>10,}  {note}')
    return 0
