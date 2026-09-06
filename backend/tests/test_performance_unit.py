"""Isolated regressions for dashboard aggregation, pagination and admin RBAC."""

import asyncio
import sys
from copy import deepcopy
from pathlib import Path

import pytest
from fastapi import HTTPException, Response

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import server  # noqa: E402


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
        return [
            document for document in self.documents
            if all(document.get(key) == value for key, value in query.items())
        ]


class FakeDB:
    def __init__(self):
        published = lambda name, index: {"_id": f"{name}-{index}", "title": f"{name} {index}", "status": "published", "created_at": index}
        self.books = FakeCollection([published("book", index) for index in range(8)])
        self.research_notes = FakeCollection([published("research", index) for index in range(3)])
        self.education_modules = FakeCollection([{**published("lesson", 1), "order_index": 1, "track": "Fundamentos"}])
        self.monthly_reports = FakeCollection([{**published("report", 1), "period": "2026-09"}])
        self.companies = FakeCollection([{"_id": "company-1", "ticker": "HCC"}])


def test_dashboard_summary_is_bounded_and_aggregated(monkeypatch):
    monkeypatch.setattr(server, "db", FakeDB())
    result = asyncio.run(server.dashboard_summary(current_user={"id": "member-1", "role": "member"}))
    assert result["counts"]["books"] == 8
    assert len(result["latest_books"]) == 4
    assert result["latest_report"]["title"] == "report 1"


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
