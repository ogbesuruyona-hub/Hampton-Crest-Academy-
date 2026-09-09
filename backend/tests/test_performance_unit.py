"""Isolated regressions for dashboard aggregation, pagination and admin RBAC."""

import asyncio
import re
import sys
from copy import deepcopy
from pathlib import Path

import pytest
from fastapi import HTTPException, Response

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import server  # noqa: E402
from routers import quizzes as quiz_routes  # noqa: E402


class FakeCursor:
    def __init__(self, documents):
        self.documents = [deepcopy(document) for document in documents]

    def sort(self, spec, direction=None):
        pairs = spec if isinstance(spec, list) else [(spec, direction)]
        for key, order in reversed(pairs):
            self.documents.sort(key=lambda item: item.get(key, 0), reverse=order < 0)
        return self

    def skip(self, amount):
        self.documents = self.documents[amount:]
        return self

    def limit(self, amount):
        self.documents = self.documents[:amount]
        return self

    async def to_list(self, amount):
        return self.documents[:amount]


class FakeCollection:
    def __init__(self, documents=()):
        self.documents = list(documents)

    async def count_documents(self, query):
        return len(self._matching(query))

    def find(self, query, projection=None):
        documents = self._matching(query)
        if projection:
            documents = [
                {key: value for key, value in document.items() if key == "_id" or projection.get(key)}
                for document in documents
            ]
        return FakeCursor(documents)

    def _matching(self, query):
        def matches(document, criteria):
            for key, expected in criteria.items():
                if key == "$nor" and any(matches(document, option) for option in expected):
                    return False
                if key == "$or" and not any(matches(document, option) for option in expected):
                    return False
                if key.startswith("$"):
                    continue
                actual = document.get(key)
                if isinstance(expected, dict):
                    if "$in" in expected and actual not in expected["$in"]:
                        return False
                    if "$ne" in expected and actual == expected["$ne"]:
                        return False
                    if "$exists" in expected and (key in document) != expected["$exists"]:
                        return False
                    if "$regex" in expected:
                        flags = re.IGNORECASE if "i" in expected.get("$options", "") else 0
                        if not re.search(expected["$regex"], str(actual or ""), flags):
                            return False
                elif actual != expected:
                    return False
            return True

        return [document for document in self.documents if matches(document, query)]


class FakeDB:
    def __init__(self):
        published = lambda name, index: {"_id": f"{name}-{index}", "title": f"{name} {index}", "status": "published", "created_at": index}
        self.books = FakeCollection([published("book", index) for index in range(8)])
        self.research_notes = FakeCollection([published("research", index) for index in range(3)])
        self.education_modules = FakeCollection([
            {**published("lesson", 1), "order_index": 1, "track": "Fundamentos"},
            {**published("Introducción", 0), "order_index": 0},
        ])
        self.monthly_reports = FakeCollection([{**published("report", 1), "period": "2026-09"}])
        self.companies = FakeCollection([{"_id": "company-1", "ticker": "HCC"}])


def test_dashboard_summary_is_bounded_and_aggregated(monkeypatch):
    monkeypatch.setattr(server, "db", FakeDB())
    result = asyncio.run(server.dashboard_summary(current_user={"id": "member-1", "role": "member"}))
    assert result["counts"]["books"] == 8
    assert result["counts"]["education"] == 1
    assert result["education_lessons"][0]["course_id"] == "fundamentos"
    assert result["education_lessons"][0]["is_course_intro"] is False
    assert len(result["latest_books"]) == 4
    assert result["latest_report"]["title"] == "report 1"


def test_startup_does_not_run_database_setup_by_default(monkeypatch):
    calls = []
    monkeypatch.delenv("RUN_DB_SETUP_ON_STARTUP", raising=False)
    monkeypatch.setattr(server, "ensure_database_configured", lambda: calls.append("configured"))

    async def unexpected_setup():
        raise AssertionError("release setup must not run in application startup")

    monkeypatch.setattr(server, "runtime_bootstrap", unexpected_setup)
    asyncio.run(server.on_startup())
    assert calls == ["configured"]


def test_foundations_includes_legacy_lessons_but_not_course_introduction():
    database = type("EducationDB", (), {
        "education_modules": FakeCollection([
            {"_id": "lesson-legacy", "title": "Capítulo 1", "status": "published", "track": "Práctica Avanzada"},
            {"_id": "intro-legacy", "title": "Introducción", "status": "published"},
            {"_id": "future-course", "title": "Macro", "status": "published", "course_id": "macro-y-ciclos-de-capital"},
        ]),
    })()

    lessons = asyncio.run(quiz_routes._published_lessons(database, "fundamentos"))

    assert [lesson["_id"] for lesson in lessons] == ["lesson-legacy"]


def test_books_pagination_and_total_header(monkeypatch):
    monkeypatch.setattr(server, "db", FakeDB())
    response = Response()
    result = asyncio.run(server.list_books(
        response=response,
        current_user={"id": "member-1", "role": "member"},
        status=None,
        category=None,
        q=None,
        page=2,
        page_size=3,
    ))
    assert len(result) == 3
    assert response.headers["x-total-count"] == "8"


def test_member_cannot_use_admin_dependency():
    with pytest.raises(HTTPException) as denied:
        asyncio.run(server.require_admin({"id": "member-1", "role": "member"}))
    assert denied.value.status_code == 403


def test_admin_requires_a_session_that_completed_two_factor_authentication():
    admin = {
        "id": "admin-1",
        "role": "admin",
        "totp_enabled": True,
        "_auth_aal": 1,
    }
    with pytest.raises(HTTPException) as denied:
        asyncio.run(server.require_admin(admin))
    assert denied.value.status_code == 403
    assert denied.value.detail == "admin_2fa_verification_required"

    elevated = {**admin, "_auth_aal": 2}
    assert asyncio.run(server.require_admin(elevated)) == elevated


def test_access_tokens_distinguish_default_and_two_factor_sessions(monkeypatch):
    secret = "unit-test-secret-with-at-least-32-characters"
    monkeypatch.setenv("JWT_SECRET", secret)
    default_token = server.create_access_token("user-1", "member@example.com")
    elevated_token = server.create_access_token("admin-1", "admin@example.com", aal=2)

    default_claims = server.jwt.decode(default_token, secret, algorithms=[server.JWT_ALGORITHM])
    elevated_claims = server.jwt.decode(elevated_token, secret, algorithms=[server.JWT_ALGORITHM])
    assert default_claims["aal"] == 1
    assert elevated_claims["aal"] == 2


@pytest.mark.parametrize(
    "user,allowed",
    [
        ({"id": "expired", "role": "member", "membership_status": "expired"}, False),
        ({"id": "active", "role": "member", "membership_status": "active"}, True),
        ({"id": "admin", "role": "admin", "membership_status": "expired"}, True),
    ],
)
def test_require_member_enforces_active_membership(user, allowed):
    if allowed:
        assert asyncio.run(server.require_member(user)) == user
    else:
        with pytest.raises(HTTPException) as denied:
            asyncio.run(server.require_member(user))
        assert denied.value.status_code == 403
        assert denied.value.detail == "membership_inactive"


def test_get_current_user_without_session_is_unauthorized(monkeypatch):
    monkeypatch.setattr(server, "ensure_database_configured", lambda: None)
    request = type("AnonymousRequest", (), {"cookies": {}})()
    with pytest.raises(HTTPException) as denied:
        asyncio.run(server.get_current_user(request=request, credentials=None))
    assert denied.value.status_code == 401


def test_every_premium_route_uses_require_member_dependency():
    premium_routes = {
        ("GET", "/api/research"), ("GET", "/api/research/{content_id}"),
        ("GET", "/api/education"), ("GET", "/api/education/{content_id}"),
        ("GET", "/api/education/{content_id}/open"),
        ("GET", "/api/reports"), ("GET", "/api/reports/{content_id}"),
        ("GET", "/api/reports/{content_id}/open"),
        ("GET", "/api/companies"), ("GET", "/api/companies/{company_id}"),
        ("GET", "/api/books"), ("GET", "/api/books/{content_id}"),
        ("GET", "/api/books/{content_id}/open"),
        ("GET", "/api/dashboard-summary"), ("GET", "/api/bookmarks"),
        ("GET", "/api/bookmarks/check"), ("POST", "/api/bookmarks"),
        ("DELETE", "/api/bookmarks"),
        ("GET", "/api/files/{path:path}"),
        ("GET", "/api/search"),
        ("POST", "/api/chat"), ("GET", "/api/chat/history"),
        ("DELETE", "/api/chat/history"),
        ("POST", "/api/valuation"), ("GET", "/api/valuation/history"),
        ("GET", "/api/progress/courses"), ("POST", "/api/progress/lessons/sync"),
        ("POST", "/api/progress/lessons/{lesson_id}"),
        ("GET", "/api/courses/{course_id}/quiz-status"),
        ("POST", "/api/quizzes/{quiz_id}/start"),
        ("GET", "/api/quiz-attempts/{attempt_id}"),
        ("POST", "/api/quiz-attempts/{attempt_id}/answer"),
        ("POST", "/api/quiz-attempts/{attempt_id}/complete"),
    }
    actual = {}
    for route in server.app.routes:
        for method in getattr(route, "methods", set()):
            key = (method, getattr(route, "path", ""))
            if key in premium_routes:
                actual[key] = {dependency.call for dependency in route.dependant.dependencies}
    assert set(actual) == premium_routes
    assert all(server.require_member in dependencies for dependencies in actual.values())


def test_every_administrative_route_uses_require_admin_dependency():
    admin_routes = {
        ("GET", "/api/directory"),
        ("POST", "/api/research"), ("PUT", "/api/research/{content_id}"),
        ("DELETE", "/api/research/{content_id}"),
        ("POST", "/api/education/uploads/sign"), ("POST", "/api/education"),
        ("POST", "/api/education/modules"), ("PUT", "/api/education/{content_id}"),
        ("DELETE", "/api/education/{content_id}"),
        ("POST", "/api/reports/uploads/sign"), ("POST", "/api/reports"),
        ("PUT", "/api/reports/{content_id}"), ("DELETE", "/api/reports/{content_id}"),
        ("POST", "/api/companies"), ("PUT", "/api/companies/{company_id}"),
        ("DELETE", "/api/companies/{company_id}"),
        ("POST", "/api/companies/{company_id}/memos"),
        ("DELETE", "/api/companies/{company_id}/memos/{memo_id}"),
        ("POST", "/api/books/uploads/sign"), ("POST", "/api/books/metadata/inspect"),
        ("POST", "/api/books"), ("PUT", "/api/books/{content_id}"),
        ("DELETE", "/api/books/{content_id}"),
        ("POST", "/api/uploads/image/sign"), ("POST", "/api/uploads/image"),
        ("POST", "/api/uploads/report-pdf"),
        ("GET", "/api/admin/members"), ("PUT", "/api/admin/members/{user_id}"),
        ("POST", "/api/admin/members/{user_id}/revoke"),
        ("POST", "/api/admin/members/{user_id}/resend-invite"),
        ("POST", "/api/admin/members/{user_id}/invite-link"),
        ("POST", "/api/admin/email/test"),
        ("GET", "/api/admin/quizzes"), ("POST", "/api/admin/quizzes"),
        ("PUT", "/api/admin/quizzes/{quiz_id}"),
    }
    actual = {}
    for route in server.app.routes:
        for method in getattr(route, "methods", set()):
            key = (method, getattr(route, "path", ""))
            if key in admin_routes:
                actual[key] = {dependency.call for dependency in route.dependant.dependencies}
    assert set(actual) == admin_routes
    assert all(server.require_admin in dependencies for dependencies in actual.values())


def test_bookmarks_are_loaded_in_batches_and_keep_order(monkeypatch):
    class CountingCollection(FakeCollection):
        def __init__(self, documents=()):
            super().__init__(documents)
            self.find_calls = 0

        def find(self, query, projection=None):
            self.find_calls += 1
            return super().find(query, projection)

    bookmarks = CountingCollection([
        {"_id": "bm-1", "user_id": "member-1", "content_type": "books", "content_id": "book-2", "created_at": 2},
        {"_id": "bm-2", "user_id": "member-1", "content_type": "books", "content_id": "book-1", "created_at": 1},
        {"_id": "bm-3", "user_id": "member-1", "content_type": "research", "content_id": "research-1", "created_at": 0},
    ])
    books = CountingCollection([
        {"_id": "book-1", "title": "One", "status": "published"},
        {"_id": "book-2", "title": "Two", "status": "published"},
    ])
    research = CountingCollection([{"_id": "research-1", "title": "Research", "status": "published"}])
    class BookmarkDB:
        def __init__(self):
            self.bookmarks = bookmarks
            self.books = books
            self.research_notes = research

        def __getitem__(self, name):
            return getattr(self, name)

    fake_db = BookmarkDB()
    monkeypatch.setattr(server, "db", fake_db)

    result = asyncio.run(server.list_bookmarks(current_user={"id": "member-1", "role": "member"}))

    assert [item["content"]["id"] for item in result] == ["book-2", "book-1", "research-1"]
    assert books.find_calls == 1
    assert research.find_calls == 1


def test_directory_is_paginated_and_reports_total(monkeypatch):
    users = FakeCollection([
        {"_id": f"user-{index}", "name": f"Member {index:02d}", "email": f"m{index}@example.com", "role": "admin"}
        for index in range(31)
    ])
    monkeypatch.setattr(server, "db", type("DirectoryDB", (), {"users": users})())
    response = Response()
    result = asyncio.run(server.member_directory(
        response=response,
        current_user={"id": "admin", "role": "admin"},
        q=None,
        page=2,
        page_size=25,
    ))
    assert len(result) == 6
    assert response.headers["x-total-count"] == "31"


def test_member_summary_headers_are_global_not_page_local(monkeypatch):
    class MembersCollection:
        async def count_documents(self, query):
            if query == {}:
                return 80
            if query == {"role": "admin"}:
                return 3
            if "$or" in query:
                return 62
            return 15

        def find(self, query):
            return FakeCursor([])

    fake_db = type("MemberDB", (), {"users": MembersCollection()})()
    monkeypatch.setattr(server, "db", fake_db)
    response = Response()
    result = asyncio.run(server.admin_list_members(
        response=response,
        current_user={"id": "admin-1", "role": "admin"},
        q=None,
        status=None,
        page=2,
        page_size=25,
    ))

    assert result == []
    assert response.headers["x-total-count"] == "80"
    assert response.headers["x-member-active-count"] == "62"
    assert response.headers["x-member-inactive-count"] == "15"
    assert response.headers["x-member-admin-count"] == "3"
