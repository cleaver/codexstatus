"""Command-line entry point for the shared status provider."""

from __future__ import annotations

import argparse
import json

from .provider import collect_status


def main() -> int:
    parser = argparse.ArgumentParser(description="Read local Codex sign-in and usage status")
    parser.add_argument("--pretty", action="store_true", help="Format the JSON output for humans")
    args = parser.parse_args()
    print(json.dumps(collect_status(), indent=2 if args.pretty else None, sort_keys=True))
    return 0
