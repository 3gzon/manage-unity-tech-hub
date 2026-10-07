#!/usr/bin/env python3
"""Install dependencies and verify the Unity Tech Hub monorepo scaffold."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(cmd: list[str], cwd: Path = ROOT) -> dict:
    result = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
    return {
        "command": " ".join(cmd),
        "exitCode": result.returncode,
        "stdout": result.stdout[-4000:],
        "stderr": result.stderr[-4000:],
    }


def main() -> int:
    steps = [
        ["corepack", "enable"],
        ["corepack", "prepare", "pnpm@9.15.4", "--activate"],
        ["pnpm", "install"],
        ["pnpm", "typecheck"],
        ["pnpm", "build"],
    ]

    results = [run(step) for step in steps]
    output = {"root": str(ROOT), "steps": results}
    (ROOT / "SCAFFOLD_RESULT.json").write_text(json.dumps(output, indent=2))

    failed = [r for r in results if r["exitCode"] != 0]
    if failed:
        print(json.dumps(failed, indent=2))
        return 1

    print("Scaffold verified successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
