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
