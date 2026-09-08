"""HTTP regression for the premium membership boundary using synthetic users only."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import jwt
import pytest
import requests
from bson import ObjectId
from pymongo import MongoClient


BASE_URL = os.environ.get("MEMBERSHIP_TEST_BASE_URL", "").rstrip("/")
MONGO_URL = os.environ.get("MEMBERSHIP_TEST_MONGO_URL", "")
DB_NAME = os.environ.get("MEMBERSHIP_TEST_DB_NAME", "")
JWT_SECRET = os.environ.get("MEMBERSHIP_TEST_JWT_SECRET", "")

pytestmark = pytest.mark.skipif(
    not all((BASE_URL, MONGO_URL, DB_NAME, JWT_SECRET)),
    reason="Synthetic membership integration environment is not configured",
)


def _token(user_id: ObjectId, email: str) -> str:
    return jwt.encode(
        {"sub": str(user_id), "email": email, "type": "access", "iat": datetime.now(timezone.utc)},
        JWT_SECRET,
        algorithm="HS256",
    )


@pytest.fixture(scope="module")
def identities():
    client = MongoClient(MONGO_URL)
    database = client[DB_NAME]
    marker = "membership-boundary-integration"
    users = {
        "active": {"_id": ObjectId(), "email": "active-boundary@example.invalid", "name": "Active Test", "role": "member", "membership_status": "active", "complimentary": True},
        "expired": {"_id": ObjectId(), "email": "expired-boundary@example.invalid", "name": "Expired Test", "role": "member", "membership_status": "expired", "complimentary": False},
        "admin": {"_id": ObjectId(), "email": "admin-boundary@example.invalid", "name": "Admin Test", "role": "admin", "membership_status": "active", "complimentary": True, "totp_enabled": True},
    }
    for user in users.values():
        user["test_marker"] = marker
        database.users.insert_one(user)
    try:
        yield {
            name: {"Authorization": f"Bearer {_token(user['_id'], user['email'])}"}
            for name, user in users.items()
        }
    finally:
        database.bookmarks.delete_many({"user_id": {"$in": [str(user["_id"]) for user in users.values()]}})
        database.users.delete_many({"test_marker": marker})
        client.close()


PREMIUM_READS = [
    "/api/dashboard-summary",
    "/api/research",
    "/api/education",
    "/api/reports",
    "/api/companies",
    "/api/books",
    "/api/bookmarks",
    "/api/bookmarks/check?content_type=books&content_id=synthetic",
    "/api/search?q=synthetic",
    "/api/valuation/history",
    "/api/progress/courses",
]

PREMIUM_GATED_PATHS = PREMIUM_READS + [
    "/api/research/synthetic",
    "/api/education/synthetic",
    "/api/education/synthetic/open",
    "/api/reports/synthetic",
    "/api/reports/synthetic/open",
    "/api/companies/synthetic",
    "/api/books/synthetic",
    "/api/books/synthetic/open",
    "/api/files/synthetic",
    "/api/courses/fundamentos/quiz-status",
]


@pytest.mark.parametrize("path", PREMIUM_GATED_PATHS)
def test_premium_read_requires_authentication(path):
    assert requests.get(f"{BASE_URL}{path}", timeout=10).status_code == 401


@pytest.mark.parametrize("path", PREMIUM_GATED_PATHS)
def test_expired_member_is_forbidden_from_every_premium_read(identities, path):
    response = requests.get(f"{BASE_URL}{path}", headers=identities["expired"], timeout=10)
    assert response.status_code == 403, (path, response.status_code, response.text)
    assert response.json().get("detail") == "membership_inactive"


@pytest.mark.parametrize("path", PREMIUM_READS)
def test_active_member_can_access_premium_reads(identities, path):
    response = requests.get(f"{BASE_URL}{path}", headers=identities["active"], timeout=10)
    assert response.status_code == 200, (path, response.status_code, response.text)


def test_expired_member_cannot_mutate_bookmarks(identities):
    create = requests.post(
        f"{BASE_URL}/api/bookmarks",
        headers=identities["expired"],
        json={"content_type": "books", "content_id": "synthetic"},
        timeout=10,
    )
    remove = requests.delete(
        f"{BASE_URL}/api/bookmarks?content_type=books&content_id=synthetic",
        headers=identities["expired"],
        timeout=10,
    )
    assert create.status_code == 403
    assert remove.status_code == 403


def test_admin_keeps_authorized_access(identities):
    assert requests.get(f"{BASE_URL}/api/dashboard-summary", headers=identities["admin"], timeout=10).status_code == 200
    assert requests.get(f"{BASE_URL}/api/directory", headers=identities["admin"], timeout=10).status_code == 200
