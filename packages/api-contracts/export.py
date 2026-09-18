"""Export the API and embedded scene protocol without connecting to a database."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "apps/api/src"), str(ROOT / "packages/scene-schema/src")]

from smart_home.main import create_app  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    path = Path(__file__).with_name("openapi.json")
    content = (
        json.dumps(create_app().openapi(), ensure_ascii=False, indent=2, sort_keys=True)
        + "\n"
    )
    if args.check:
        if not path.is_file() or path.read_text(encoding="utf-8") != content:
            print("OpenAPI contract is missing or stale", file=sys.stderr)
            return 1
        return 0
    path.write_text(content, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
