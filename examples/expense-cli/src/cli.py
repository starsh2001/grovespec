"""CLI dispatcher (TASK-1, skeleton). Routes the first arg to a command.

A skeleton has its own code: the COMMANDS table + dispatch below.
"""
import sys

import add
import list_cmd
import report

COMMANDS = {"add": add.run, "list": list_cmd.run, "report": report.run}


def main(argv):
    if not argv or argv[0] not in COMMANDS:
        print("usage: cli.py <add|list|report> ...")
        return 1
    return COMMANDS[argv[0]](argv[1:])


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
