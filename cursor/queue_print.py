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
    print(
        "Агентам РК печать не нужна (23.08.2026). "
        "Word только в cursor/, ссылку дать в чат. Не класть в inbox/.",
        file=sys.stderr,
    )
    if "--force" not in sys.argv:
        print("Остановлено. Явный запрос на бумагу: queue_print.py --force файл.docx", file=sys.stderr)
        return 1
    sys.argv = [a for a in sys.argv if a != "--force"]
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
    rel = dest.relative_to(ROOT)
    print(f"В очереди печати: {rel}")
    print(f"Дальше: git add {rel} && commit && push ЭТОЙ ветки.")
    print("Локальный watcher забирает inbox/*.docx со всех origin/cursor/*.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
