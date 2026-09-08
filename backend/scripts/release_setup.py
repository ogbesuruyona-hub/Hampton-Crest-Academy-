"""Idempotent database setup for a controlled Academy release."""

import argparse
import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import server  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Apply Academy indexes and data migrations.")
    parser.add_argument("--seed-admin", action="store_true", help="Create/update the configured bootstrap admin.")
    parser.add_argument("--seed-test-member", action="store_true", help="Create/update the explicitly configured test member.")
    args = parser.parse_args()
    asyncio.run(server.run_release_setup(
        include_admin_seed=args.seed_admin,
        include_test_seed=args.seed_test_member,
    ))


if __name__ == "__main__":
    main()
