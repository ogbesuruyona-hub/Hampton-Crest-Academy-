"""Isolated tests for renewal failures; never call Stripe, MongoDB, or production."""

import asyncio
import hashlib
import hmac
import json
import sys
import time
import types
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Billing tests do not exercise AI or market-data routers. Keep those optional
# integrations out of this isolated test environment.
openai_stub = types.ModuleType("openai")
openai_stub.AsyncOpenAI = object
sys.modules.setdefault("openai", openai_stub)
yfinance_stub = types.ModuleType("yfinance")
yfinance_stub.Ticker = object
sys.modules.setdefault("yfinance", yfinance_stub)
yahooquery_stub = types.ModuleType("yahooquery")
yahooquery_stub.Ticker = object
sys.modules.setdefault("yahooquery", yahooquery_stub)

import server  # noqa: E402


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = {doc["_id"]: deepcopy(doc) for doc in (documents or [])}

    async def find_one(self, query):
        for document in self.documents.values():
            if all(document.get(key) == value for key, value in query.items()):
                return deepcopy(document)
        return None

    async def insert_one(self, document):
        if document["_id"] in self.documents:
            from pymongo.errors import DuplicateKeyError
            raise DuplicateKeyError("duplicate")
        self.documents[document["_id"]] = deepcopy(document)

    async def update_one(self, query, update):
        document = await self.find_one(query)
        if not document:
            return
        stored = self.documents[document["_id"]]
        stored.update(deepcopy(update.get("$set", {})))
        for key in update.get("$unset", {}):
            stored.pop(key, None)

    async def delete_one(self, query):
        document = await self.find_one(query)
        if document:
            self.documents.pop(document["_id"], None)


class FakeDB:
    def __init__(self, user=None):
        self.users = FakeCollection([user] if user else [])
        self.stripe_events = FakeCollection()


def member(**overrides):
    base = {
        "_id": "user-1",
        "email": "member@example.com",
        "name": "Member",
        "role": "member",
        "complimentary": False,
        "membership_status": "active",
        "stripe_subscription_id": "sub_123",
    }
    base.update(overrides)
    return base


def test_past_due_access_uses_grace_deadline_not_stripe_period():
    now = datetime.now(timezone.utc)
    assert server.has_access(member(
        membership_status="past_due",
        grace_period_end=now + timedelta(days=1),
        current_period_end=now + timedelta(days=30),
    ))
    assert not server.has_access(member(
        membership_status="past_due",
        grace_period_end=now - timedelta(seconds=1),
        current_period_end=now + timedelta(days=30),
    ))


def test_retries_do_not_extend_grace_and_recovery_clears_failure(monkeypatch):
    first_failure = datetime.now(timezone.utc)
    original = member(membership_status="active")
    fake_db = FakeDB(original)
    monkeypatch.setattr(server, "db", fake_db)
    monkeypatch.setattr(server, "PAYMENT_GRACE_DAYS", 5)
    notifications = []

    async def fake_notification(user, grace_end, reason):
        notifications.append((user["email"], grace_end, reason))
        return {"id": "email-test"}

    monkeypatch.setattr(server, "_send_payment_issue_email", fake_notification)
    monkeypatch.setattr(server, "_send_payment_recovered_email", lambda user: asyncio.sleep(0))
    subscription = {
        "id": "sub_123",
        "status": "past_due",
        "current_period_start": int(first_failure.timestamp()),
        "current_period_end": int((first_failure + timedelta(days=30)).timestamp()),
    }
    invoice = {"attempt_count": 1, "next_payment_attempt": int((first_failure + timedelta(days=1)).timestamp())}

    asyncio.run(server._record_payment_issue(
        original,
        subscription=subscription,
        invoice=invoice,
        reason="payment_failed",
        occurred_at=first_failure,
    ))
    after_first = deepcopy(fake_db.users.documents["user-1"])
    expected_deadline = first_failure + timedelta(days=5)
    assert after_first["membership_status"] == "past_due"
    assert after_first["grace_period_end"] == expected_deadline
    assert len(notifications) == 1

    asyncio.run(server._record_payment_issue(
        after_first,
        subscription=subscription,
        invoice={"attempt_count": 2},
        reason="payment_failed",
        occurred_at=first_failure + timedelta(days=2),
    ))
    after_retry = deepcopy(fake_db.users.documents["user-1"])
    assert after_retry["grace_period_end"] == expected_deadline
    assert len(notifications) == 1

    asyncio.run(server._restore_paid_membership(after_retry, {**subscription, "status": "active"}))
    recovered = fake_db.users.documents["user-1"]
    assert recovered["membership_status"] == "active"
    assert recovered["last_payment_status"] == "paid"
    assert "grace_period_end" not in recovered
    assert "payment_failure_at" not in recovered


def test_late_failure_event_cannot_override_current_active_subscription(monkeypatch):
    current = member(membership_status="active", last_payment_status="paid")
    fake_db = FakeDB(current)
    monkeypatch.setattr(server, "db", fake_db)

    asyncio.run(server._record_payment_issue(
        current,
        subscription={"id": "sub_123", "status": "active"},
        invoice={"attempt_count": 1},
        reason="payment_failed",
        occurred_at=datetime.now(timezone.utc) - timedelta(minutes=5),
    ))

    stored = fake_db.users.documents["user-1"]
    assert stored["membership_status"] == "active"
    assert stored["last_payment_status"] == "paid"


def test_expired_grace_blocks_existing_session_on_refresh(monkeypatch):
    overdue = member(
        membership_status="past_due",
        grace_period_end=datetime.now(timezone.utc) - timedelta(minutes=1),
        last_payment_status="failed",
    )
    fake_db = FakeDB(overdue)
    monkeypatch.setattr(server, "db", fake_db)

    async def no_subscription(_subscription_id):
        return None

    monkeypatch.setattr(server, "_retrieve_subscription_snapshot", no_subscription)

    refreshed = asyncio.run(server.refresh_membership_state(overdue))
    assert refreshed["membership_status"] == "expired"
    assert refreshed["membership_inactive_reason"] == "grace_period_ended"
    assert not server.has_access(refreshed)


def test_refresh_reconciles_a_recovered_payment_before_blocking(monkeypatch):
    now = datetime.now(timezone.utc)
    overdue = member(
        membership_status="past_due",
        grace_period_end=now - timedelta(minutes=1),
        payment_failure_at=now - timedelta(days=5),
        last_payment_status="failed",
    )
    fake_db = FakeDB(overdue)
    monkeypatch.setattr(server, "db", fake_db)

    async def active_subscription(_subscription_id):
        return {
            "id": "sub_123",
            "status": "active",
            "current_period_start": int(now.timestamp()),
            "current_period_end": int((now + timedelta(days=30)).timestamp()),
        }

    async def no_email(_user):
        return None

    monkeypatch.setattr(server, "_retrieve_subscription_snapshot", active_subscription)
    monkeypatch.setattr(server, "_send_payment_recovered_email", no_email)

    refreshed = asyncio.run(server.refresh_membership_state(overdue))
    assert refreshed["membership_status"] == "active"
    assert server.has_access(refreshed)
    assert fake_db.users.documents["user-1"]["last_payment_status"] == "paid"


def test_webhook_processing_error_returns_500_and_releases_event_for_retry(monkeypatch):
    fake_db = FakeDB()
    monkeypatch.setattr(server, "db", fake_db)
    monkeypatch.setattr(server, "STRIPE_WEBHOOK_SECRET", "whsec_REMOVED")

    async def fail_processing(parsed):
        raise RuntimeError("temporary database failure")

    monkeypatch.setattr(server, "_process_stripe_event", fail_processing)
    test_app = FastAPI()
    test_app.include_router(server.api_router)
    client = TestClient(test_app, raise_server_exceptions=False)
    event = {
        "id": "evt_retry_test",
        "type": "invoice.payment_failed",
        "created": int(time.time()),
        "data": {"object": {"subscription": "sub_123"}},
    }
    payload = json.dumps(event)
    timestamp = int(time.time())
    digest = hmac.new(
        b"whsec_REMOVED",
        f"{timestamp}.{payload}".encode(),
        hashlib.sha256,
    ).hexdigest()
    response = client.post(
        "/api/webhook/stripe",
        content=payload,
        headers={"stripe-signature": f"t={timestamp},v1={digest}", "content-type": "application/json"},
    )

    assert response.status_code == 500
    assert "evt_retry_test" not in fake_db.stripe_events.documents
