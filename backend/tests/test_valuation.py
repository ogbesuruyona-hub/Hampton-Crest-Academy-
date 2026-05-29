"""Backend tests for the new Asset Valuation feature + regression smoke."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fallback: read frontend/.env
    from pathlib import Path
    fe_env = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    for line in fe_env.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break

ADMIN_EMAIL = "admin@hamptoncrest.com"
ADMIN_PASS = "Hampton#2026"
MEMBER_EMAIL = "prueba@hamptoncrest.com"
MEMBER_PASS = "Prueba#2026"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def member_token():
    return _login(MEMBER_EMAIL, MEMBER_PASS)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


# ---------------- AUTH regression ----------------
class TestAuthRegression:
    def test_admin_login(self):
        tok = _login(ADMIN_EMAIL, ADMIN_PASS)
        assert isinstance(tok, str) and len(tok) > 20

    def test_member_login(self):
        tok = _login(MEMBER_EMAIL, MEMBER_PASS)
        assert isinstance(tok, str) and len(tok) > 20


# ---------------- VALUATION AUTH ----------------
class TestValuationAuth:
    def test_valuation_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/valuation", json={"ticker": "AAPL"}, timeout=20)
        assert r.status_code in (401, 403), f"got {r.status_code} {r.text}"

    def test_valuation_history_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/valuation/history", timeout=20)
        assert r.status_code in (401, 403)


# ---------------- VALUATION FEATURE ----------------
class TestValuationFeature:
    def test_history_endpoint_works(self, member_token):
        r = requests.get(
            f"{BASE_URL}/api/valuation/history",
            headers={"Authorization": f"Bearer {member_token}"},
            timeout=20,
        )
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)

    def test_run_valuation_msft(self, member_token):
        r = requests.post(
            f"{BASE_URL}/api/valuation",
            json={"ticker": "MSFT"},
            headers={"Authorization": f"Bearer {member_token}"},
            timeout=120,
        )
        assert r.status_code == 200, f"valuation failed: {r.status_code} {r.text[:500]}"
        body = r.json()
        assert body["ticker"] == "MSFT"
        # Structure
        for k in ("data", "dcf", "analysis"):
            assert k in body, f"missing {k}"
        analysis = body["analysis"]
        for k in ("executive_summary", "score", "rating", "verdict"):
            assert k in analysis, f"analysis missing {k}"
        score = analysis["score"]
        assert "total" in score
        assert 0 <= int(score["total"]) <= 100
        assert analysis["rating"] in ("EXCEPTIONAL", "HIGH_QUALITY", "WATCHLIST", "SPECULATIVE", "AVOID")
        assert analysis["verdict"] in ("STRONG_BUY", "BUY", "HOLD", "AVOID")

    def test_history_populated_after_valuation(self, member_token):
        r = requests.get(
            f"{BASE_URL}/api/valuation/history",
            headers={"Authorization": f"Bearer {member_token}"},
            timeout=20,
        )
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        # After previous test, should contain MSFT
        tickers = {row["ticker"] for row in body}
        assert "MSFT" in tickers, f"history missing MSFT: {tickers}"

    def test_invalid_ticker(self, member_token):
        r = requests.post(
            f"{BASE_URL}/api/valuation",
            json={"ticker": "ZZZZZ"},
            headers={"Authorization": f"Bearer {member_token}"},
            timeout=60,
        )
        assert r.status_code in (404, 400, 502), f"got {r.status_code}"


# ---------------- CONTENT REGRESSION ----------------
class TestContentRegression:
    @pytest.mark.parametrize("path", ["/api/research", "/api/education", "/api/reports", "/api/companies", "/api/books"])
    def test_content_endpoint(self, member_token, path):
        r = requests.get(
            f"{BASE_URL}{path}",
            headers={"Authorization": f"Bearer {member_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
        assert isinstance(r.json(), (list, dict))

    def test_search(self, member_token):
        r = requests.get(
            f"{BASE_URL}/api/search",
            params={"q": "academy"},
            headers={"Authorization": f"Bearer {member_token}"},
            timeout=30,
        )
        assert r.status_code == 200

    def test_chat_history(self, member_token):
        r = requests.get(
            f"{BASE_URL}/api/chat/history",
            params={"session_id": "regression-smoke-1"},
            headers={"Authorization": f"Bearer {member_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:200]
        assert isinstance(r.json(), list)

    def test_chat_send(self, member_token):
        r = requests.post(
            f"{BASE_URL}/api/chat",
            json={"message": "Hola, breve saludo en una frase."},
            headers={"Authorization": f"Bearer {member_token}"},
            timeout=60,
        )
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        # accept different possible shapes
        assert any(k in body for k in ("reply", "message", "response", "content")) or isinstance(body, dict)

    def test_billing_portal(self, member_token):
        r = requests.post(
            f"{BASE_URL}/api/billing/portal",
            headers={"Authorization": f"Bearer {member_token}"},
            timeout=30,
        )
        assert r.status_code in (200, 503, 400), f"got {r.status_code} {r.text[:200]}"
