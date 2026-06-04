"""add command (TASK-3). Records one expense. Consumes storage (TASK-2)."""
import storage


def run(args):
    if len(args) < 3:
        print("usage: add <YYYY-MM-DD> <category> <amount> [note]")
        return 1
    date, category, amount = args[0], args[1], int(args[2])
    note = " ".join(args[3:])
    storage.add_record(
        {"date": date, "category": category, "amount": amount, "note": note}
    )
    print(f"added: {category} {amount}")
    return 0
