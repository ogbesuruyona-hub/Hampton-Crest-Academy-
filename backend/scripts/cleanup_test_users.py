import argparse
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient


BACKEND_DIR = Path(__file__).resolve().parents[1]
KNOWN_TEST_EMAILS = {
    "admin@hamptoncrest.com",
    "prueba@hamptoncrest.com",
}
TEST_EMAIL_PATTERNS = [
    re.compile(r"^test_member_[a-z0-9]+@example\.com$", re.IGNORECASE),
    re.compile(r"^test_reg_[a-z0-9]+@example\.com$", re.IGNORECASE),
    re.compile(r"^member_[a-z0-9._+-]+@test\.com$", re.IGNORECASE),
]
SAFE_PROJECTION = {
    "email": 1,
    "name": 1,
    "role": 1,
    "membership_status": 1,
    "subscription_status": 1,
    "created_at": 1,
}


def is_target_test_user(user):
    email = (user.get("email") or "").lower().strip()
    return email in KNOWN_TEST_EMAILS or any(pattern.match(email) for pattern in TEST_EMAIL_PATTERNS)


def build_query():
    return {
        "$or": [
            {"email": {"$in": sorted(KNOWN_TEST_EMAILS)}},
            {"email": {"$regex": r"^test_member_[a-z0-9]+@example\.com$", "$options": "i"}},
            {"email": {"$regex": r"^test_reg_[a-z0-9]+@example\.com$", "$options": "i"}},
            {"email": {"$regex": r"^member_[a-z0-9._+-]+@test\.com$", "$options": "i"}},
        ]
    }


def print_users(users):
    for user in users:
        print(
            "- "
            f"id={user.get('_id')} "
            f"email={user.get('email', '')} "
            f"name={user.get('name', '')} "
            f"role={user.get('role', '')} "
            f"membership_status={user.get('membership_status', '')} "
            f"subscription_status={user.get('subscription_status', '')} "
            f"created_at={user.get('created_at', '')}"
        )


def main():
    parser = argparse.ArgumentParser(
        description="Delete known Hampton Crest Academy test/demo users only."
    )
    parser.add_argument("--yes", action="store_true", help="Delete without interactive confirmation.")
    parser.add_argument("--dry-run", action="store_true", help="Print matching users without deleting.")
    args = parser.parse_args()

    load_dotenv(BACKEND_DIR / ".env")
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise SystemExit("MONGO_URL and DB_NAME must be configured in backend/.env or the environment.")

    client = MongoClient(mongo_url)
    try:
        db = client[db_name]
        users_collection = db.users
        candidates = list(users_collection.find(build_query(), SAFE_PROJECTION))
        users = [user for user in candidates if is_target_test_user(user)]

        if not users:
            print("No matching test/demo users found.")
            return

        print("The following test/demo users are targeted for deletion:")
        print_users(users)

        if args.dry_run:
            print("Dry run complete. No users were deleted.")
            return

        if not args.yes:
            confirmation = input("Type DELETE to permanently delete only these users: ").strip()
            if confirmation != "DELETE":
                print("Aborted. No users were deleted.")
                return

        result = users_collection.delete_many({"_id": {"$in": [user["_id"] for user in users]}})
        print(f"Deleted {result.deleted_count} test/demo user(s).")
    finally:
        client.close()


if __name__ == "__main__":
    main()
