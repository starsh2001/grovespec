"""report command (TASK-5). Totals by category, then a grand total. Consumes storage."""
import storage


def run(args):
    totals = {}
    for r in storage.load():
        totals[r["category"]] = totals.get(r["category"], 0) + r["amount"]
    for category in sorted(totals):
        print(f"{category:<12} {totals[category]:>12,}")
    print("-" * 25)
    print(f'{"total":<12} {sum(totals.values()):>12,}')
    return 0
