"""Isolated tests for the private Supabase book-storage helpers."""

import sys
import types
from pathlib import Path

import pytest
from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

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


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


def test_book_source_requires_upload_or_external_link():
    with pytest.raises(HTTPException) as exc:
        server._validate_book_source(server.BookIn(title="Sin fuente"))
    assert exc.value.status_code == 422


def test_book_source_accepts_private_storage_path():
    payload = server.BookIn(
        title="The Intelligent Investor",
        file_path=f"books/{'a' * 32}.pdf",
        file_name="the-intelligent-investor.pdf",
        file_size=1024,
    )
    server._validate_book_source(payload)


def test_create_upload_returns_only_scoped_token(monkeypatch):
    monkeypatch.setattr(server, "SUPABASE_URL", "https://project-ref.supabase.co")
    monkeypatch.setattr(server, "SUPABASE_SERVICE_ROLE_KEY", "test-service-role")
    monkeypatch.setattr(server, "SUPABASE_BOOKS_BUCKET", "academy-books")
    monkeypatch.setattr(server, "SUPABASE_STORAGE_RESUMABLE_URL", "")

    def fake_post(url, **kwargs):
        assert url.endswith("/object/upload/sign/academy-books/books/test.pdf")
        assert kwargs["headers"]["Authorization"] == "Bearer test-service-role"
        assert kwargs["json"] == {"upsert": True}
        return FakeResponse({"url": "/object/upload/sign/academy-books/books/test.pdf?token=temporary-token"})

    monkeypatch.setattr(server.requests, "post", fake_post)
    result = server._create_supabase_book_upload("books/test.pdf")
    assert result == {
        "path": "books/test.pdf",
        "bucket": "academy-books",
        "token": "temporary-token",
        "upload_url": (
            "https://project-ref.supabase.co/storage/v1/"
            "object/upload/sign/academy-books/books/test.pdf?token=temporary-token"
        ),
        "resumable_url": "https://project-ref.storage.supabase.co/storage/v1/upload/resumable",
    }


def test_create_download_expands_signed_path(monkeypatch):
    monkeypatch.setattr(server, "SUPABASE_URL", "https://project-ref.supabase.co")
    monkeypatch.setattr(server, "SUPABASE_SERVICE_ROLE_KEY", "test-service-role")
    monkeypatch.setattr(server, "SUPABASE_BOOKS_BUCKET", "academy-books")

    def fake_post(url, **kwargs):
        assert kwargs["json"] == {"expiresIn": 300}
        return FakeResponse({"signedURL": "/object/sign/academy-books/books/test.pdf?token=read-token"})

    monkeypatch.setattr(server.requests, "post", fake_post)
    result = server._create_supabase_book_download("books/test.pdf")
    assert result == (
        "https://project-ref.supabase.co/storage/v1/"
        "object/sign/academy-books/books/test.pdf?token=read-token"
    )
