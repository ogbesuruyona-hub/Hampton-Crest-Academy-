"""Shared fixtures for backend tests.

P2 introduces membership gating: a newly-registered user is `inactive` and cannot
log in or call any protected route until they have membership_status='active' or
complimentary=True. To keep all prior register→login tests working without
changing product behaviour, we expose a `make_active` helper that bumps a freshly
registered user to `complimentary=True` directly in Mongo.
"""
import os
from pathlib import Path

import pytest
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="session")
def make_active(mongo_db):
    """Mark a user (by email) as complimentary so legacy register→login flows pass."""
    def _activate(email: str):
        mongo_db.users.update_one(
            {"email": email.lower().strip()},
            {"$set": {"complimentary": True, "membership_status": "active"}},
        )
    return _activate


@pytest.fixture(autouse=True)
def _clear_login_attempts(mongo_db):
    # don't let leftover lockouts from previous runs break the next case
    mongo_db.login_attempts.delete_many({})
    yield
