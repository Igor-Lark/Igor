#!/usr/bin/env python3
"""Поставить Word в очередь печати: inbox/ (клон D:\\CURSOR\\print-bridge)."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INBOX = ROOT / "inbox"
LEGACY = ROOT / "локальная" / "print-inbox"


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python3 cursor/queue_print.py <file.docx>", file=sys.stderr)
        return 2
    src = Path(sys.argv[1]).expanduser().resolve()
    if not src.is_file() or src.suffix.lower() != ".docx":
        print(f"need an existing .docx, got {src}", file=sys.stderr)
        return 2
    INBOX.mkdir(parents=True, exist_ok=True)
    dest = INBOX / src.name
    shutil.copy2(src, dest)
    LEGACY.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, LEGACY / src.name)
    print(f"В очереди печати: {dest.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
