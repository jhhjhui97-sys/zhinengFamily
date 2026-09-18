"""Export/check the schema without loading API or database dependencies."""

import argparse
import json
import sys
from pathlib import Path

from .scene import SceneModel


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="check without writing")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "scene.schema.json",
    )
    args = parser.parse_args(argv)
    exported = (
        json.dumps(
            SceneModel.model_json_schema(), ensure_ascii=False, indent=2, sort_keys=True
        )
        + "\n"
    )
    if args.check:
        if (
            not args.output.is_file()
            or args.output.read_text(encoding="utf-8") != exported
        ):
            print(f"Scene schema is missing or differs: {args.output}", file=sys.stderr)
            return 1
        return 0
    args.output.write_text(exported, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
