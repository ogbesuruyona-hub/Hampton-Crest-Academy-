"""Hampton Crest Academy - backend API tests (auth + health)."""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hampton-crest.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@hamptoncrest.com"
ADMIN_PASSWORD = "Hampton#2026"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def new_member(session):
    """Register one new member for the session."""
    email = f"test_member_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"name": "TEST Member", "email": email, "password": "TestPass#2026"}
    r = session.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "password": payload["password"], "data": data}


# ---------------- Health ----------------
class TestHealth:
    def test_health_ok(self, session):
        r = session.get(f"{API}/health")
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") == "ok"
        assert "time" in body

    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") == "ok"


# ---------------- Auth: Register ----------------
class TestRegister:
    def test_register_returns_token_and_user(self, new_member):
        data = new_member["data"]
        assert "access_token" in data and isinstance(data["access_token"], str) and len(data["access_token"]) > 20
        assert data.get("token_type") == "bearer"
        u = data["user"]
        assert u["email"] == new_member["email"]
        assert u["name"] == "TEST Member"
        assert u["role"] == "member"
        assert "id" in u and u["id"] or "_id" in u

    def test_register_duplicate_email_400(self, session, new_member):
        payload = {"name": "Dup", "email": new_member["email"], "password": "AnotherPass#2026"}
        r = session.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_register_short_password_422(self, session):
        payload = {"name": "Short", "email": f"test_short_{uuid.uuid4().hex[:6]}@example.com", "password": "x"}
        r = session.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 422


# ---------------- Auth: Login ----------------
class TestLogin:
    def test_admin_login_success(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and len(data["access_token"]) > 20
        u = data["user"]
        assert u["email"] == ADMIN_EMAIL
        assert u["role"] == "admin"

    def test_admin_login_wrong_password_401(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WrongPassword!"})
        assert r.status_code == 401

    def test_login_unknown_email_401(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "nobody_xyz@example.com", "password": "whatever12"})
        assert r.status_code == 401

    def test_login_case_insensitive_email(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL.upper(), "password": ADMIN_PASSWORD})
        assert r.status_code == 200


# ---------------- Auth: me + logout ----------------
class TestMeLogout:
    def _token(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        return r.json()["access_token"]

    def test_me_with_token(self, session):
        token = self._token(session)
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == ADMIN_EMAIL
        assert u["role"] == "admin"
        # Note: API serializes with alias '_id'. Accept either key but record this as a code quality issue.
        assert ("id" in u) or ("_id" in u)

    def test_me_without_token_401(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_invalid_token_401(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
        assert r.status_code == 401

    def test_logout_authenticated(self, session):
        token = self._token(session)
        r = requests.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_logout_unauthenticated_401(self):
        r = requests.post(f"{API}/auth/logout")
        assert r.status_code == 401


# ---------------- New member end-to-end ----------------
class TestMemberFlow:
    def test_new_member_can_call_me(self, session, new_member):
        token = new_member["data"]["access_token"]
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == new_member["email"]
        assert u["role"] == "member"

    def test_new_member_login_then_me(self, session, new_member):
        r = session.post(f"{API}/auth/login", json={"email": new_member["email"], "password": new_member["password"]})
        assert r.status_code == 200
        token = r.json()["access_token"]
        r2 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200
        assert r2.json()["email"] == new_member["email"]
