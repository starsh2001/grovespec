---
id: TASK-1
name: "expense-cli (CLI dispatcher)"
role: skeleton
status: done
origin: mapped
blocked_by: []
tdd: false
tdd_skip_reason: "thin dispatcher; behavior is covered by the command tasks' tests"
---

## Overview
The entry point. `python src/cli.py <command> ...` reads the first arg and routes the rest to the matching command (add/list/report). Its own logic is just dispatch; the real work is in the child nodes. *Skeleton — but it still has code: the command table + dispatch.*

## Requirements
- Run `add`/`list`/`report` given as the first arg.
- No arg / unknown command → print usage and return a failure code.
- Pass the command's return value through as the process exit code.

## Contract
- Takes: `argv` (the command name + its args). In practice `sys.argv[1:]`.
- Gives: an integer exit code. Unknown/empty command → `1`. Known → that command's return value.
- Invariant: commands are registered in one place — the `COMMANDS` dict (`add`/`list`/`report`). It splits the command name from the rest (`argv[1:]`) and hands the rest to the child.
- Responsibility: arg-shape validation and the real work belong to each command (child). The dispatcher only decides "which command."

## AC
- [x] `add`/`list`/`report` as the first arg runs that command
- [x] no arg / unknown command → usage + return `1`
- [x] the command's return value becomes the exit code
- [ ] (gap) an exception thrown inside a command isn't caught by the dispatcher — undefined in the contract

## Subtasks
- [x] command table + dispatch (cli.py)

## Change Log
- 2026-06-04 — initial node. Skeleton dispatcher; its code is the `COMMANDS` table + dispatch (a skeleton has its own code).
