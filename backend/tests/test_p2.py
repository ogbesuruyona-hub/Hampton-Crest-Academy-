"""Hampton Crest Academy - P2 backend tests: Stripe webhook, invites, gating, admin members.

Signs synthetic Stripe events with manual HMAC SHA256 against STRIPE_WEBHOOK_SECRET.
"""
import hashlib
import hmac
import json
import os
import time
import uuid
from pathlib import Path

import pytest
import requests
import stripe
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hampton-crest.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@hamptoncrest.com"
ADMIN_PASSWORD = "Hampton#2026"
WEBHOOK_SECRET = os.environ["STRIPE_WEBHOOK_SECRET"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _stripe_signature(payload: str, secret: str, ts: int) -> str:
    signed = f"{ts}.{payload}".encode()
    v1 = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"t={ts},v1={v1}"


def _sign_and_post(event: dict) -> requests.Response:
    payload = json.dumps(event)
    ts = int(time.time())
    header = _stripe_signature(payload, WEBHOOK_SECRET, ts)
    return requests.post(
        f"{API}/webhook/stripe",
        data=payload,
        headers={"Content-Type": "application/json", "stripe-signature": header},
    )


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _new_email():
    return f"test_p2_{uuid.uuid4().hex[:10]}@example.com"


def _make_checkout_event(email: str, name: str = "P2 Tester", event_id: str = None, sub_id: str = None):
    return {
        "id": event_id or f"evt_{uuid.uuid4().hex}",
        "object": "event",
        "api_version": "2024-04-10",
        "created": int(time.time()),
        "type": "checkout.session.completed",
        "data": {"object": {
            "id": f"cs_{uuid.uuid4().hex}",
            "object": "checkout.session",
            "customer": f"cus_{uuid.uuid4().hex[:14]}",
            "subscription": sub_id,  # null so server skips the live Subscription.retrieve call
            "customer_details": {"email": email, "name": name},
            "customer_email": email,
        }},
    }


def _make_sub_deleted_event(sub_id: str, event_id: str = None):
    return {
        "id": event_id or f"evt_{uuid.uuid4().hex}",
        "object": "event",
        "api_version": "2024-04-10",
        "created": int(time.time()),
        "type": "customer.subscription.deleted",
        "data": {"object": {"id": sub_id, "object": "subscription", "status": "canceled"}},
    }


# ---------------- Stripe Webhook signature ----------------
class TestWebhookSignature:
    def test_bad_signature_400(self):
        r = requests.post(
            f"{API}/webhook/stripe",
            data='{"id":"evt_bad","type":"x","data":{"object":{}}}',
            headers={"Content-Type": "application/json", "stripe-signature": "t=1,v1=deadbeef"},
        )
        assert r.status_code == 400, r.text

    def test_missing_signature_400(self):
        r = requests.post(
            f"{API}/webhook/stripe",
            data='{"id":"evt_bad","type":"x","data":{"object":{}}}',
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 400

    def test_valid_signature_accepted(self, mongo_db):
        email = _new_email()
        evt = _make_checkout_event(email)
        r = _sign_and_post(evt)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("received") is True
        # cleanup
        mongo_db.stripe_events.delete_one({"_id": evt["id"]})
        mongo_db.users.delete_one({"email": email})


# ---------------- checkout.session.completed → create + invite ----------------
class TestCheckoutCompleted:
    def test_creates_active_user_and_invite(self, mongo_db):
        email = _new_email()
        evt = _make_checkout_event(email, name="Alice P2")
        r = _sign_and_post(evt)
        assert r.status_code == 200
        user = mongo_db.users.find_one({"email": email})
        assert user is not None, "user not created"
        assert user["membership_status"] == "active"
        assert user.get("name") == "Alice P2"
        invite = mongo_db.invites.find_one({"email": email})
        assert invite is not None, "invite token not created"
        assert invite.get("consumed_at") is None
        # exposed for next test class
        TestCheckoutCompleted._email = email
        TestCheckoutCompleted._invite_token = invite["_id"]
        TestCheckoutCompleted._event_id = evt["id"]

    def test_duplicate_event_is_idempotent(self, mongo_db):
        # Replay the same event id
        evt = _make_checkout_event(TestCheckoutCompleted._email, event_id=TestCheckoutCompleted._event_id)
        r = _sign_and_post(evt)
        assert r.status_code == 200
        body = r.json()
        assert body.get("duplicate") is True
        # exactly one user with that email
        n = mongo_db.users.count_documents({"email": TestCheckoutCompleted._email})
        assert n == 1


# ---------------- Invite check + accept ----------------
class TestInvite:
    def test_get_invite_returns_email_and_valid(self):
        token = TestCheckoutCompleted._invite_token
        r = requests.get(f"{API}/auth/invite/{token}")
        assert r.status_code == 200
        body = r.json()
        assert body["valid"] is True
        assert body["email"] == TestCheckoutCompleted._email

    def test_unknown_invite_404(self):
        r = requests.get(f"{API}/auth/invite/notarealtoken123")
        assert r.status_code == 404

    def test_accept_invite_sets_password_and_returns_token(self):
        token = TestCheckoutCompleted._invite_token
        r = requests.post(f"{API}/auth/accept-invite",
                          json={"token": token, "password": "NewMember#2026"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("access_token")
        assert body["user"]["email"] == TestCheckoutCompleted._email
        TestInvite._access_token = body["access_token"]

    def test_invite_cannot_be_reused(self):
        token = TestCheckoutCompleted._invite_token
        r = requests.post(f"{API}/auth/accept-invite",
                          json={"token": token, "password": "Whatever#2026"})
        assert r.status_code == 400

    def test_login_works_after_accept(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": TestCheckoutCompleted._email, "password": "NewMember#2026"})
        assert r.status_code == 200
        assert "access_token" in r.json()


# ---------------- Login gating ----------------
class TestLoginGating:
    def test_inactive_user_login_403(self, mongo_db):
        email = _new_email()
        rr = requests.post(f"{API}/auth/register",
                           json={"name": "Inactive", "email": email, "password": "GoodPass#2026"})
        assert rr.status_code == 200
        # Direct login should now be blocked (register no longer activates)
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "GoodPass#2026"})
        assert r.status_code == 403, r.text
        assert "membership_inactive" in r.text

    def test_admin_bypasses_gating(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200

    def test_complimentary_user_passes(self, mongo_db, make_active):
        email = _new_email()
        rr = requests.post(f"{API}/auth/register",
                           json={"name": "Comp", "email": email, "password": "GoodPass#2026"})
        assert rr.status_code == 200
        make_active(email)
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "GoodPass#2026"})
        assert r.status_code == 200

    def test_subscription_deleted_then_login_403(self, mongo_db):
        # Create active user via webhook with a known subscription id
        email = _new_email()
        sub_id = f"sub_{uuid.uuid4().hex[:14]}"
        evt = _make_checkout_event(email, name="SubUser")
        # patch in a sub id manually without triggering live retrieve
        r = _sign_and_post(evt)
        assert r.status_code == 200
        # Set subscription id directly so the delete event resolves
        mongo_db.users.update_one(
            {"email": email},
            {"$set": {"stripe_subscription_id": sub_id, "password_hash": ""}},
        )
        # set a password so we can attempt login
        invite = mongo_db.invites.find_one({"email": email})
        rr = requests.post(f"{API}/auth/accept-invite",
                           json={"token": invite["_id"], "password": "SubPass#2026"})
        assert rr.status_code == 200
        # Confirm login works while active
        ok = requests.post(f"{API}/auth/login",
                           json={"email": email, "password": "SubPass#2026"})
        assert ok.status_code == 200
        # Now send subscription.deleted
        evt_del = _make_sub_deleted_event(sub_id)
        rd = _sign_and_post(evt_del)
        assert rd.status_code == 200
        # Login should now 403
        gated = requests.post(f"{API}/auth/login",
                              json={"email": email, "password": "SubPass#2026"})
        assert gated.status_code == 403


# ---------------- Membership config ----------------
class TestMembershipConfig:
    def test_returns_framer_and_payment_link(self):
        r = requests.get(f"{API}/membership/config")
        assert r.status_code == 200
        body = r.json()
        assert "framer_url" in body
        assert "payment_link_url" in body


# ---------------- Admin members endpoints ----------------
@pytest.fixture(scope="module")
def admin_h(admin_token):
    return _auth(admin_token)


class TestAdminMembers:
    def test_non_admin_403(self):
        # create a complimentary user and use their token
        email = _new_email()
        password = "GoodPass#2026"
        rr = requests.post(f"{API}/auth/register",
                           json={"name": "Plain", "email": email, "password": password})
        assert rr.status_code == 200
        from pymongo import MongoClient
        c = MongoClient(os.environ["MONGO_URL"])
        c[os.environ["DB_NAME"]].users.update_one(
            {"email": email}, {"$set": {"complimentary": True, "membership_status": "active"}},
        )
        c.close()
        lr = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
        token = lr.json()["access_token"]
        r = requests.get(f"{API}/admin/members", headers=_auth(token))
        assert r.status_code == 403

    def test_list_members(self, admin_h):
        r = requests.get(f"{API}/admin/members", headers=admin_h)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) > 0

    def test_search_filter(self, admin_h):
        r = requests.get(f"{API}/admin/members", params={"q": "test_p2"}, headers=admin_h)
        assert r.status_code == 200
        assert all("test_p2" in m["email"] for m in r.json())

    def test_status_filter_inactive(self, admin_h):
        r = requests.get(f"{API}/admin/members", params={"status": "inactive"}, headers=admin_h)
        assert r.status_code == 200
        for m in r.json():
            assert m.get("role") != "admin"
            assert not m.get("complimentary")
            assert m.get("membership_status") != "active"

    def test_complimentary_toggle(self, admin_h, mongo_db):
        # create a user
        email = _new_email()
        rr = requests.post(f"{API}/auth/register",
                           json={"name": "ToggleMe", "email": email, "password": "Pass#2026"})
        uid = rr.json()["user"]["id"]
        # toggle complimentary on
        r = requests.put(f"{API}/admin/members/{uid}",
                         json={"complimentary": True}, headers=admin_h)
        assert r.status_code == 200, r.text
        assert r.json().get("complimentary") is True
        # verify GET
        u = mongo_db.users.find_one({"email": email})
        assert u.get("complimentary") is True
        # toggle off
        r2 = requests.put(f"{API}/admin/members/{uid}",
                          json={"complimentary": False}, headers=admin_h)
        assert r2.status_code == 200
        assert r2.json().get("complimentary") is False

    def test_revoke(self, admin_h, mongo_db, make_active):
        email = _new_email()
        rr = requests.post(f"{API}/auth/register",
                           json={"name": "RevokeMe", "email": email, "password": "Pass#2026"})
        uid = rr.json()["user"]["id"]
        make_active(email)
        r = requests.post(f"{API}/admin/members/{uid}/revoke", headers=admin_h)
        assert r.status_code == 200
        u = mongo_db.users.find_one({"email": email})
        assert u["membership_status"] == "inactive"
        assert u.get("complimentary") is False
        # login should now be 403
        lr = requests.post(f"{API}/auth/login", json={"email": email, "password": "Pass#2026"})
        assert lr.status_code == 403

    def test_resend_invite(self, admin_h, mongo_db):
        email = _new_email()
        rr = requests.post(f"{API}/auth/register",
                           json={"name": "Resend", "email": email, "password": "Pass#2026"})
        uid = rr.json()["user"]["id"]
        before = mongo_db.invites.count_documents({"email": email})
        r = requests.post(f"{API}/admin/members/{uid}/resend-invite", headers=admin_h)
        # 200 expected when send works, 503 only if Resend delivery itself fails
        assert r.status_code in (200, 503), r.text
        if r.status_code == 200:
            after = mongo_db.invites.count_documents({"email": email})
            assert after == before + 1
