"""Hampton Crest Academy - P0 content + bookmark backend tests."""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hampton-crest.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@hamptoncrest.com"
ADMIN_PASSWORD = "Hampton#2026"


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def member():
    email = f"test_member_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass#2026"
    r = requests.post(f"{API}/auth/register", json={"name": "TEST Member", "email": email, "password": password})
    assert r.status_code == 200, f"member register failed: {r.text}"
    return {"email": email, "password": password, "token": r.json()["access_token"], "id": r.json()["user"]["id"]}


# ---------------- Role gating ----------------
class TestRoleGating:
    def test_research_post_member_403(self, member):
        r = requests.post(f"{API}/research", headers=_auth_headers(member["token"]),
                          json={"title": "TEST hack", "body": "x", "status": "published"})
        assert r.status_code == 403

    def test_education_post_member_403(self, member):
        r = requests.post(f"{API}/education", headers=_auth_headers(member["token"]),
                          json={"title": "TEST hack", "body": "x", "status": "published"})
        assert r.status_code == 403

    def test_reports_post_member_403(self, member):
        r = requests.post(f"{API}/reports", headers=_auth_headers(member["token"]),
                          json={"title": "TEST hack", "body": "x", "period": "2026-01", "status": "published"})
        assert r.status_code == 403

    def test_companies_post_member_403(self, member):
        r = requests.post(f"{API}/companies", headers=_auth_headers(member["token"]),
                          json={"ticker": "HACK", "name": "TEST"})
        assert r.status_code == 403


# ---------------- Research CRUD ----------------
class TestResearch:
    created_id = None
    draft_id = None

    def test_create_published(self, admin_token):
        payload = {
            "title": "TEST_Research_Pub",
            "summary": "summary",
            "body": "body text",
            "category": "Macro",
            "tags": ["macro", "test"],
            "status": "published",
        }
        r = requests.post(f"{API}/research", headers=_auth_headers(admin_token), json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["title"] == payload["title"]
        assert data["status"] == "published"
        assert data["published_at"] is not None
        assert data["tags"] == ["macro", "test"]
        TestResearch.created_id = data["id"]

    def test_create_draft(self, admin_token):
        r = requests.post(f"{API}/research", headers=_auth_headers(admin_token),
                          json={"title": "TEST_Research_Draft", "body": "draft body", "status": "draft"})
        assert r.status_code == 200
        TestResearch.draft_id = r.json()["id"]

    def test_member_sees_only_published(self, member):
        r = requests.get(f"{API}/research", headers=_auth_headers(member["token"]))
        assert r.status_code == 200
        ids = [i["id"] for i in r.json()]
        assert TestResearch.created_id in ids
        assert TestResearch.draft_id not in ids

    def test_admin_sees_all(self, admin_token):
        r = requests.get(f"{API}/research", headers=_auth_headers(admin_token))
        ids = [i["id"] for i in r.json()]
        assert TestResearch.created_id in ids
        assert TestResearch.draft_id in ids

    def test_filter_by_category(self, admin_token):
        r = requests.get(f"{API}/research?category=Macro", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        for i in r.json():
            assert i.get("category") == "Macro"

    def test_filter_by_tag(self, admin_token):
        r = requests.get(f"{API}/research?tag=macro", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        assert any(i["id"] == TestResearch.created_id for i in r.json())

    def test_search_q(self, admin_token):
        r = requests.get(f"{API}/research?q=TEST_Research_Pub", headers=_auth_headers(admin_token))
        assert any(i["id"] == TestResearch.created_id for i in r.json())

    def test_member_cannot_get_draft(self, member):
        r = requests.get(f"{API}/research/{TestResearch.draft_id}", headers=_auth_headers(member["token"]))
        assert r.status_code == 404

    def test_get_one(self, admin_token):
        r = requests.get(f"{API}/research/{TestResearch.created_id}", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        assert r.json()["id"] == TestResearch.created_id

    def test_update(self, admin_token):
        r = requests.put(f"{API}/research/{TestResearch.created_id}", headers=_auth_headers(admin_token),
                         json={"title": "TEST_Research_Updated", "body": "new body", "status": "published",
                               "tags": ["macro"], "category": "Macro"})
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Research_Updated"
        # Verify persistence
        r2 = requests.get(f"{API}/research/{TestResearch.created_id}", headers=_auth_headers(admin_token))
        assert r2.json()["title"] == "TEST_Research_Updated"

    def test_delete_and_verify(self, admin_token):
        r = requests.delete(f"{API}/research/{TestResearch.draft_id}", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        r2 = requests.get(f"{API}/research/{TestResearch.draft_id}", headers=_auth_headers(admin_token))
        assert r2.status_code == 404


# ---------------- Education ----------------
class TestEducation:
    created_id = None

    def test_create(self, admin_token):
        r = requests.post(f"{API}/education", headers=_auth_headers(admin_token),
                          json={"title": "TEST_Edu_Module", "body": "lesson", "track": "Foundations",
                                "week_count": 4, "status": "published", "tags": ["intro"]})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["track"] == "Foundations"
        assert data["week_count"] == 4
        TestEducation.created_id = data["id"]

    def test_list_and_get(self, admin_token):
        r = requests.get(f"{API}/education", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        assert any(i["id"] == TestEducation.created_id for i in r.json())

    def test_update(self, admin_token):
        r = requests.put(f"{API}/education/{TestEducation.created_id}", headers=_auth_headers(admin_token),
                         json={"title": "TEST_Edu_Updated", "body": "lesson v2", "track": "Foundations",
                               "week_count": 6, "status": "published"})
        assert r.status_code == 200
        assert r.json()["week_count"] == 6

    def test_delete(self, admin_token):
        r = requests.delete(f"{API}/education/{TestEducation.created_id}", headers=_auth_headers(admin_token))
        assert r.status_code == 200


# ---------------- Reports ----------------
class TestReports:
    created_id = None

    def test_create_invalid_period(self, admin_token):
        r = requests.post(f"{API}/reports", headers=_auth_headers(admin_token),
                          json={"title": "TEST_Bad", "body": "x", "period": "2026/01", "status": "published"})
        assert r.status_code == 422

    def test_create_valid(self, admin_token):
        r = requests.post(f"{API}/reports", headers=_auth_headers(admin_token),
                          json={"title": "TEST_Report_Jan", "body": "monthly", "period": "2026-01",
                                "status": "published"})
        assert r.status_code == 200, r.text
        TestReports.created_id = r.json()["id"]
        assert r.json()["period"] == "2026-01"

    def test_year_filter(self, admin_token):
        r = requests.get(f"{API}/reports?year=2026", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        for i in r.json():
            assert i["period"].startswith("2026-")

    def test_year_filter_no_match(self, admin_token):
        r = requests.get(f"{API}/reports?year=1999", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        assert r.json() == []

    def test_delete(self, admin_token):
        r = requests.delete(f"{API}/reports/{TestReports.created_id}", headers=_auth_headers(admin_token))
        assert r.status_code == 200


# ---------------- Companies ----------------
class TestCompanies:
    created_id = None
    memo_id = None
    ticker = f"TST{uuid.uuid4().hex[:4].upper()}"

    def test_create(self, admin_token):
        r = requests.post(f"{API}/companies", headers=_auth_headers(admin_token), json={
            "ticker": self.ticker.lower(),  # check uppercase normalize
            "name": "TEST Co Inc",
            "sector": "Tech",
            "status": "covered",
            "thesis_summary": "Great",
            "thesis_body": "long thesis",
            "key_metrics": [{"label": "P/E", "value": "20"}, {"label": "Revenue", "value": "10B"}],
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ticker"] == self.ticker  # uppercased
        assert len(data["key_metrics"]) == 2
        TestCompanies.created_id = data["id"]

    def test_duplicate_ticker(self, admin_token):
        r = requests.post(f"{API}/companies", headers=_auth_headers(admin_token), json={
            "ticker": self.ticker, "name": "Dup", "status": "covered"})
        # Mongo unique index should reject - likely 500 (no explicit handler). Accept any non-200.
        assert r.status_code != 200

    def test_member_sees_all_statuses(self, member, admin_token):
        # Create a watching status company
        r = requests.post(f"{API}/companies", headers=_auth_headers(admin_token), json={
            "ticker": f"WTC{uuid.uuid4().hex[:4].upper()}", "name": "TEST Watch",
            "status": "watching", "thesis_body": "x"})
        assert r.status_code == 200
        watch_id = r.json()["id"]
        r2 = requests.get(f"{API}/companies", headers=_auth_headers(member["token"]))
        assert r2.status_code == 200
        ids = [c["id"] for c in r2.json()]
        assert watch_id in ids
        # cleanup
        requests.delete(f"{API}/companies/{watch_id}", headers=_auth_headers(admin_token))

    def test_get_detail(self, admin_token):
        r = requests.get(f"{API}/companies/{TestCompanies.created_id}", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        assert r.json()["ticker"] == self.ticker

    def test_add_memo(self, admin_token):
        r = requests.post(f"{API}/companies/{TestCompanies.created_id}/memos",
                          headers=_auth_headers(admin_token),
                          json={"title": "TEST Memo", "body": "memo body"})
        assert r.status_code == 200, r.text
        TestCompanies.memo_id = r.json()["id"]

    def test_member_cannot_add_memo(self, member):
        r = requests.post(f"{API}/companies/{TestCompanies.created_id}/memos",
                          headers=_auth_headers(member["token"]),
                          json={"title": "X", "body": "X"})
        assert r.status_code == 403

    def test_memo_visible_in_detail(self, admin_token):
        r = requests.get(f"{API}/companies/{TestCompanies.created_id}", headers=_auth_headers(admin_token))
        memos = r.json().get("memos", [])
        assert any(m.get("id") == TestCompanies.memo_id for m in memos)

    def test_delete_memo(self, admin_token):
        r = requests.delete(
            f"{API}/companies/{TestCompanies.created_id}/memos/{TestCompanies.memo_id}",
            headers=_auth_headers(admin_token))
        assert r.status_code == 200
        r2 = requests.get(f"{API}/companies/{TestCompanies.created_id}", headers=_auth_headers(admin_token))
        memos = r2.json().get("memos", [])
        assert not any(m.get("id") == TestCompanies.memo_id for m in memos)


# ---------------- Bookmarks ----------------
class TestBookmarks:
    research_id = None
    draft_id = None

    @pytest.fixture(autouse=True, scope="class")
    def _setup(self, admin_token):
        # Create one published research note + one draft for bookmarking
        r = requests.post(f"{API}/research", headers=_auth_headers(admin_token), json={
            "title": "TEST_BM_Pub", "body": "x", "status": "published"})
        TestBookmarks.research_id = r.json()["id"]
        r2 = requests.post(f"{API}/research", headers=_auth_headers(admin_token), json={
            "title": "TEST_BM_Draft", "body": "x", "status": "draft"})
        TestBookmarks.draft_id = r2.json()["id"]
        yield
        requests.delete(f"{API}/research/{TestBookmarks.research_id}", headers=_auth_headers(admin_token))
        requests.delete(f"{API}/research/{TestBookmarks.draft_id}", headers=_auth_headers(admin_token))

    def test_check_initially_false(self, member):
        r = requests.get(f"{API}/bookmarks/check?content_type=research&content_id={self.research_id}",
                         headers=_auth_headers(member["token"]))
        assert r.status_code == 200
        assert r.json()["bookmarked"] is False

    def test_add_bookmark(self, member):
        r = requests.post(f"{API}/bookmarks", headers=_auth_headers(member["token"]),
                          json={"content_type": "research", "content_id": self.research_id})
        assert r.status_code == 200
        assert r.json()["bookmarked"] is True

    def test_check_now_true(self, member):
        r = requests.get(f"{API}/bookmarks/check?content_type=research&content_id={self.research_id}",
                         headers=_auth_headers(member["token"]))
        assert r.json()["bookmarked"] is True

    def test_duplicate_add_idempotent(self, member):
        r = requests.post(f"{API}/bookmarks", headers=_auth_headers(member["token"]),
                          json={"content_type": "research", "content_id": self.research_id})
        assert r.status_code == 200

    def test_list_hydrated(self, member):
        r = requests.get(f"{API}/bookmarks", headers=_auth_headers(member["token"]))
        assert r.status_code == 200
        items = r.json()
        match = [i for i in items if i["content"]["id"] == self.research_id]
        assert len(match) == 1
        assert match[0]["content"]["title"] == "TEST_BM_Pub"

    def test_member_draft_bookmark_hidden(self, member, admin_token):
        # Admin bookmarks a draft, then we verify member cannot
        # Use a fresh member to attempt to bookmark a draft - should 404
        r = requests.post(f"{API}/bookmarks", headers=_auth_headers(member["token"]),
                          json={"content_type": "research", "content_id": self.draft_id})
        # endpoint requires content exists (any status). check existing find_one (no status gate)
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            # list should NOT include the draft for member
            r2 = requests.get(f"{API}/bookmarks", headers=_auth_headers(member["token"]))
            ids = [i["content"]["id"] for i in r2.json()]
            assert self.draft_id not in ids
            # cleanup
            requests.delete(f"{API}/bookmarks?content_type=research&content_id={self.draft_id}",
                            headers=_auth_headers(member["token"]))

    def test_delete_bookmark(self, member):
        r = requests.delete(f"{API}/bookmarks?content_type=research&content_id={self.research_id}",
                            headers=_auth_headers(member["token"]))
        assert r.status_code == 200
        r2 = requests.get(f"{API}/bookmarks/check?content_type=research&content_id={self.research_id}",
                          headers=_auth_headers(member["token"]))
        assert r2.json()["bookmarked"] is False
