#!/usr/bin/env python3
"""Install dependencies and run monorepo typecheck."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(cmd: list[str]) -> int:
    print(f"\n$ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=ROOT)
    return result.returncode


def main() -> int:
    steps = [
        ["pnpm", "install"],
        ["pnpm", "typecheck"],
    ]
    for step in steps:
        code = run(step)
        if code != 0:
            return code
    print("\nTypecheck passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
