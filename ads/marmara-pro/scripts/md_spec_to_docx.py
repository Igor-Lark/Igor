#!/usr/bin/env python3
"""Rebuild Marmara/KlinkerPro Direct .docx files (wrapper)."""

import subprocess
import sys
from pathlib import Path

ADS = Path(__file__).resolve().parents[2]
SCRIPT = ADS / "scripts" / "md_spec_to_docx.py"
BASE = Path(__file__).resolve().parents[1]

PRESETS = {
    "campaign-cpa": (
        BASE / "termopaneli-priozersky-campaign-cpa.md",
        BASE / "termopaneli-priozersky-campaign-cpa-ads.csv",
    ),
    "adgroup": (BASE / "termopaneli-priozersky-adgroup.md", None),
}


def run(md: Path, ads: Path | None) -> None:
    cmd = [sys.executable, str(SCRIPT), str(md)]
    if ads:
        cmd.extend(["--ads", str(ads)])
    subprocess.check_call(cmd)


def main() -> None:
    name = sys.argv[1] if len(sys.argv) > 1 else "all"
    keys = list(PRESETS) if name == "all" else [name]
    if name != "all" and name not in PRESETS:
        print("Usage: md_spec_to_docx.py [campaign-cpa|adgroup|all]")
        raise SystemExit(1)
    for key in keys:
        md, ads = PRESETS[key]
        run(md, ads)


if __name__ == "__main__":
    main()
