"""Hampton Crest Academy - P1 backend tests: brute-force, 2FA, email prefs, PDF uploads, file serve."""
import os
import time
import uuid
import io

import pyotp
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hampton-crest.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@hamptoncrest.com"
ADMIN_PASSWORD = "Hampton#2026"

MIN_PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<</Root 1 0 R>>\n%%EOF\n"


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def fresh_user():
    """A dedicated user for 2FA tests so we never touch the admin's 2FA state."""
    email = f"test_p1_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass#2026"
    r = requests.post(f"{API}/auth/register", json={"name": "TEST P1 User", "email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"email": email, "password": password, "token": r.json()["access_token"], "id": r.json()["user"]["id"]}


# ---------------- Brute-force lockout ----------------
class TestBruteForce:
    def test_lockout_after_5_failed(self):
        """A dedicated email used here (not admin) so we don't lock out the admin."""
        email = f"bf_user_{uuid.uuid4().hex[:8]}@example.com"
        # register
        rr = requests.post(f"{API}/auth/register", json={"name": "BF", "email": email, "password": "GoodPass#2026"})
        assert rr.status_code == 200
        # 5 failed attempts -> attempts each return 401
        for i in range(5):
            r = requests.post(f"{API}/auth/login", json={"email": email, "password": "WrongPass!"})
            assert r.status_code == 401, f"attempt {i+1}: got {r.status_code}: {r.text}"
        # 6th attempt should now be locked out -> 429
        r6 = requests.post(f"{API}/auth/login", json={"email": email, "password": "WrongPass!"})
        assert r6.status_code == 429, f"expected 429 after lockout, got {r6.status_code}: {r6.text}"
        detail = r6.json().get("detail", "")
        assert "Try again" in detail or "minute" in detail.lower()
        # Even the correct password is rejected during lockout
        r_correct = requests.post(f"{API}/auth/login", json={"email": email, "password": "GoodPass#2026"})
        assert r_correct.status_code == 429

    def test_successful_login_clears_attempts(self):
        email = f"bf_ok_{uuid.uuid4().hex[:8]}@example.com"
        rr = requests.post(f"{API}/auth/register", json={"name": "BF2", "email": email, "password": "GoodPass#2026"})
        assert rr.status_code == 200
        # 4 failed
        for _ in range(4):
            r = requests.post(f"{API}/auth/login", json={"email": email, "password": "WrongPass!"})
            assert r.status_code == 401
        # success at 5th try should clear
        ok = requests.post(f"{API}/auth/login", json={"email": email, "password": "GoodPass#2026"})
        assert ok.status_code == 200
        # Now do 4 fails again - if attempts not cleared, we'd be locked
        for _ in range(4):
            r = requests.post(f"{API}/auth/login", json={"email": email, "password": "WrongPass!"})
            assert r.status_code == 401  # still not locked because counter was reset


# ---------------- 2FA Setup, Login, Disable, Backup Code ----------------
class TestTwoFactor:
    secret = None
    backup_codes = []

    def test_status_initially_disabled(self, fresh_user):
        r = requests.get(f"{API}/auth/2fa/status", headers=_bearer(fresh_user["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["enabled"] is False

    def test_setup_returns_secret_uri_qr(self, fresh_user):
        r = requests.post(f"{API}/auth/2fa/setup", headers=_bearer(fresh_user["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body.get("secret"), str) and len(body["secret"]) >= 16
        assert "otpauth://" in body.get("uri", "")
        # QR png base64 (optional spec field)
        assert "qr_png_base64" in body
        TestTwoFactor.secret = body["secret"]

    def test_verify_setup_with_valid_totp_enables(self, fresh_user):
        assert TestTwoFactor.secret, "setup must run first"
        code = pyotp.TOTP(TestTwoFactor.secret).now()
        r = requests.post(f"{API}/auth/2fa/verify-setup",
                          headers=_auth(fresh_user["token"]),
                          json={"code": code})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("enabled") is True
        codes = body.get("backup_codes") or []
        assert isinstance(codes, list) and len(codes) == 10
        TestTwoFactor.backup_codes = codes

    def test_status_enabled_after_setup(self, fresh_user):
        r = requests.get(f"{API}/auth/2fa/status", headers=_bearer(fresh_user["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["enabled"] is True
        # 10 backup codes remaining
        assert body.get("backup_codes_remaining", 0) == 10

    def test_login_now_requires_2fa(self, fresh_user):
        r = requests.post(f"{API}/auth/login",
                          json={"email": fresh_user["email"], "password": fresh_user["password"]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("requires_2fa") is True
        assert body.get("temp_token")
        assert not body.get("access_token")
        fresh_user["temp_token"] = body["temp_token"]

    def test_2fa_verify_invalid_code_401(self, fresh_user):
        r = requests.post(f"{API}/auth/2fa/verify",
                          json={"temp_token": fresh_user["temp_token"], "code": "000000"})
        assert r.status_code == 401

    def test_2fa_verify_valid_totp_returns_access(self, fresh_user):
        code = pyotp.TOTP(TestTwoFactor.secret).now()
        r = requests.post(f"{API}/auth/2fa/verify",
                          json={"temp_token": fresh_user["temp_token"], "code": code})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("access_token")
        assert body.get("user", {}).get("email") == fresh_user["email"]

    def test_backup_code_works_and_is_consumed(self, fresh_user):
        # New login to obtain temp token
        rl = requests.post(f"{API}/auth/login",
                           json={"email": fresh_user["email"], "password": fresh_user["password"]})
        assert rl.status_code == 200 and rl.json().get("requires_2fa")
        temp = rl.json()["temp_token"]
        code = TestTwoFactor.backup_codes[0]
        r = requests.post(f"{API}/auth/2fa/verify", json={"temp_token": temp, "code": code})
        assert r.status_code == 200, r.text
        assert r.json().get("access_token")
        # Try to reuse same backup code -> should fail
        rl2 = requests.post(f"{API}/auth/login",
                            json={"email": fresh_user["email"], "password": fresh_user["password"]})
        temp2 = rl2.json()["temp_token"]
        r2 = requests.post(f"{API}/auth/2fa/verify", json={"temp_token": temp2, "code": code})
        assert r2.status_code == 401, "backup code should be consumed and not reusable"

    def test_disable_2fa(self, fresh_user):
        code = pyotp.TOTP(TestTwoFactor.secret).now()
        r = requests.post(f"{API}/auth/2fa/disable",
                          headers=_auth(fresh_user["token"]),
                          json={"password": fresh_user["password"], "code": code})
        assert r.status_code == 200, r.text
        # status now disabled
        s = requests.get(f"{API}/auth/2fa/status", headers=_bearer(fresh_user["token"]))
        assert s.json()["enabled"] is False
        # login flow back to normal
        rl = requests.post(f"{API}/auth/login",
                           json={"email": fresh_user["email"], "password": fresh_user["password"]})
        assert rl.status_code == 200
        assert rl.json().get("access_token")
        assert not rl.json().get("requires_2fa")


# ---------------- Email digest preferences ----------------
class TestEmailPrefs:
    def test_default_is_opt_in_true(self, fresh_user):
        r = requests.get(f"{API}/auth/me", headers=_bearer(fresh_user["token"]))
        assert r.status_code == 200
        assert r.json().get("email_digest_opt_in", True) is True

    def test_update_to_false(self, fresh_user):
        r = requests.put(f"{API}/auth/email-preferences",
                        headers=_auth(fresh_user["token"]),
                        json={"email_digest_opt_in": False})
        assert r.status_code == 200, r.text
        assert r.json().get("email_digest_opt_in") is False
        # persisted on me
        r2 = requests.get(f"{API}/auth/me", headers=_bearer(fresh_user["token"]))
        assert r2.json().get("email_digest_opt_in") is False

    def test_update_back_to_true(self, fresh_user):
        r = requests.put(f"{API}/auth/email-preferences",
                        headers=_auth(fresh_user["token"]),
                        json={"email_digest_opt_in": True})
        assert r.status_code == 200
        assert r.json().get("email_digest_opt_in") is True


# ---------------- PDF Upload + File Serve ----------------
class TestPdfUpload:
    upload = None  # store admin upload result

    def test_non_admin_forbidden(self, fresh_user):
        files = {"file": ("test.pdf", io.BytesIO(MIN_PDF_BYTES), "application/pdf")}
        r = requests.post(f"{API}/uploads/report-pdf",
                          headers=_bearer(fresh_user["token"]),
                          files=files)
        assert r.status_code == 403

    def test_non_pdf_rejected(self, admin_token):
        files = {"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")}
        r = requests.post(f"{API}/uploads/report-pdf",
                          headers=_bearer(admin_token),
                          files=files)
        assert r.status_code == 400

    def test_admin_upload_success(self, admin_token):
        files = {"file": ("monthly.pdf", io.BytesIO(MIN_PDF_BYTES), "application/pdf")}
        r = requests.post(f"{API}/uploads/report-pdf",
                          headers=_bearer(admin_token),
                          files=files)
        assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
        data = r.json()
        for key in ("id", "url", "filename", "size", "content_type"):
            assert key in data, f"missing field {key} in {data}"
        assert data["content_type"] == "application/pdf"
        assert data["filename"] == "monthly.pdf"
        assert data["size"] == len(MIN_PDF_BYTES)
        assert data["url"].startswith("/api/files/")
        TestPdfUpload.upload = data

    def test_oversize_413(self, admin_token):
        big = b"%PDF-1.4\n" + b"a" * (25 * 1024 * 1024 + 10)
        files = {"file": ("big.pdf", io.BytesIO(big), "application/pdf")}
        r = requests.post(f"{API}/uploads/report-pdf",
                          headers=_bearer(admin_token),
                          files=files)
        assert r.status_code == 413

    def test_file_serve_with_bearer(self, admin_token):
        assert TestPdfUpload.upload, "upload must run first"
        url = BASE_URL + TestPdfUpload.upload["url"]
        r = requests.get(url, headers=_bearer(admin_token))
        assert r.status_code == 200, f"file serve failed: {r.status_code} {r.text[:200]}"
        assert "application/pdf" in r.headers.get("content-type", "")
        # bytes match
        assert r.content == MIN_PDF_BYTES

    def test_file_serve_with_query_auth(self, admin_token):
        url = BASE_URL + TestPdfUpload.upload["url"] + f"?auth={admin_token}"
        r = requests.get(url)
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "")

    def test_file_serve_unauthorized(self):
        url = BASE_URL + TestPdfUpload.upload["url"]
        r = requests.get(url)
        assert r.status_code == 401


# ---------------- Reports with PDF metadata ----------------
class TestReportWithPdf:
    created_id = None

    def test_create_report_with_pdf_fields(self, admin_token):
        up = TestPdfUpload.upload
        assert up, "needs pdf upload from previous test"
        payload = {
            "title": "TEST_P1_Report_Pdf",
            "body": "<p>monthly</p>",
            "period": "2026-02",
            "status": "published",
            "pdf_url": up["url"],
            "pdf_filename": up["filename"],
            "pdf_size": up["size"],
        }
        r = requests.post(f"{API}/reports", headers=_auth(admin_token), json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["pdf_url"] == up["url"]
        assert data["pdf_filename"] == up["filename"]
        assert data["pdf_size"] == up["size"]
        TestReportWithPdf.created_id = data["id"]

    def test_get_report_returns_pdf_fields(self, admin_token):
        r = requests.get(f"{API}/reports/{TestReportWithPdf.created_id}", headers=_bearer(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data.get("pdf_url")
        assert data.get("pdf_filename")
        assert isinstance(data.get("pdf_size"), int)

    def test_cleanup_report(self, admin_token):
        r = requests.delete(f"{API}/reports/{TestReportWithPdf.created_id}", headers=_bearer(admin_token))
        assert r.status_code == 200


# ---------------- Digest dispatch does not error ----------------
class TestDigestDispatch:
    def test_publish_research_returns_200(self, admin_token):
        r = requests.post(f"{API}/research",
                          headers=_auth(admin_token),
                          json={"title": "TEST_P1_Digest_R", "body": "<p>hi</p>", "status": "published"})
        assert r.status_code == 200
        rid = r.json()["id"]
        requests.delete(f"{API}/research/{rid}", headers=_bearer(admin_token))

    def test_publish_education_returns_200(self, admin_token):
        r = requests.post(f"{API}/education",
                          headers=_auth(admin_token),
                          json={"title": "TEST_P1_Digest_E", "body": "<p>hi</p>",
                                "track": "Foundations", "week_count": 1, "status": "published"})
        assert r.status_code == 200
        eid = r.json()["id"]
        requests.delete(f"{API}/education/{eid}", headers=_bearer(admin_token))

    def test_publish_report_returns_200(self, admin_token):
        r = requests.post(f"{API}/reports",
                          headers=_auth(admin_token),
                          json={"title": "TEST_P1_Digest_Rep", "body": "<p>hi</p>",
                                "period": "2026-03", "status": "published"})
        assert r.status_code == 200
        rid = r.json()["id"]
        requests.delete(f"{API}/reports/{rid}", headers=_bearer(admin_token))
