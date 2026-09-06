"""Regression tests for stable Quiz Engine admin edits."""

from __future__ import annotations

import sys
import types
import unittest
from datetime import datetime, timezone
from importlib.util import find_spec
from pathlib import Path
from types import SimpleNamespace


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

if find_spec("fastapi") is None:
    fastapi = types.ModuleType("fastapi")
    fastapi.APIRouter = lambda *args, **kwargs: object()
    fastapi.Depends = lambda dependency: dependency
    fastapi.HTTPException = type("HTTPException", (Exception,), {})
    sys.modules["fastapi"] = fastapi
if find_spec("pydantic") is None:
    pydantic = types.ModuleType("pydantic")
    pydantic.BaseModel = object
    pydantic.Field = lambda default=None, **kwargs: default
    sys.modules["pydantic"] = pydantic
if find_spec("pymongo") is None:
    pymongo = types.ModuleType("pymongo")
    pymongo_errors = types.ModuleType("pymongo.errors")
    pymongo_errors.DuplicateKeyError = type("DuplicateKeyError", (Exception,), {})
    pymongo.errors = pymongo_errors
    sys.modules["pymongo"] = pymongo
    sys.modules["pymongo.errors"] = pymongo_errors

from routers.quizzes import _replace_questions  # noqa: E402


def _matches(document: dict, query: dict) -> bool:
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict) and "$ne" in expected:
            if actual == expected["$ne"]:
                return False
        elif actual != expected:
            return False
    return True


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, key, direction):
        self.documents.sort(key=lambda item: item.get(key, 0), reverse=direction < 0)
        return self

    async def to_list(self, _limit):
        return [dict(document) for document in self.documents]


class FakeCollection:
    def __init__(self, documents=()):
        self.documents = {document["_id"]: dict(document) for document in documents}
        self.updates = []

    def find(self, query, _projection=None):
        return FakeCursor([document for document in self.documents.values() if _matches(document, query)])

    async def find_one(self, query, _projection=None):
        return next((dict(document) for document in self.documents.values() if _matches(document, query)), None)

    async def insert_one(self, document):
        self.documents[document["_id"]] = dict(document)

    async def update_one(self, query, update):
        document = next(document for document in self.documents.values() if _matches(document, query))
        self.updates.append((document["_id"], dict(update.get("$set", {}))))
        document.update(update.get("$set", {}))

    async def delete_one(self, query):
        match = next((key for key, document in self.documents.items() if _matches(document, query)), None)
        if match is not None:
            del self.documents[match]

    async def delete_many(self, query):
        matches = [key for key, document in self.documents.items() if _matches(document, query)]
        for key in matches:
            del self.documents[key]


class FakeDb:
    def __init__(self):
        self.quiz_questions = FakeCollection(
            [
                {"_id": "q1", "quiz_id": "quiz", "question_text": "Old one"},
                {"_id": "q2", "quiz_id": "quiz", "question_text": "Historical"},
            ]
        )
        self.quiz_options = FakeCollection(
            [
                {"_id": "q1-a", "question_id": "q1", "option_text": "A"},
                {"_id": "q1-b", "question_id": "q1", "option_text": "B"},
                {"_id": "q1-c", "question_id": "q1", "option_text": "C"},
                {"_id": "q1-d", "question_id": "q1", "option_text": "D"},
                {"_id": "q2-a", "question_id": "q2", "option_text": "Historical answer"},
            ]
        )
        self.quiz_attempt_answers = FakeCollection(
            [{"_id": "answer", "question_id": "q2", "selected_option_id": "q2-a"}]
        )


class QuizAdminPersistenceTests(unittest.IsolatedAsyncioTestCase):
    async def test_admin_edit_preserves_ids_and_archives_answered_removed_question(self):
        db = FakeDb()
        question = SimpleNamespace(
            id="q1",
            question_text="Updated one",
            explanation="Updated explanation",
            difficulty="intermediate",
            is_active=True,
            options=[
                SimpleNamespace(id="q1-b", option_text="B updated", is_correct=True),
                SimpleNamespace(id="q1-a", option_text="A updated", is_correct=False),
                SimpleNamespace(id="q1-c", option_text="C updated", is_correct=False),
                SimpleNamespace(id="q1-d", option_text="D updated", is_correct=False),
            ],
        )

        await _replace_questions(
            db,
            lambda: datetime(2026, 9, 5, tzinfo=timezone.utc),
            lambda: "new-id",
            "quiz",
            [question],
        )

        self.assertEqual(db.quiz_questions.documents["q1"]["question_text"], "Updated one")
        self.assertEqual(db.quiz_options.documents["q1-b"]["position"], 0)
        self.assertTrue(db.quiz_options.documents["q1-b"]["is_correct"])
        self.assertIn(("q1", {"position": 1000}), db.quiz_questions.updates)
        self.assertTrue(
            any(item_id == "q1-b" and fields.get("position", 0) >= 100 for item_id, fields in db.quiz_options.updates)
        )
        self.assertTrue(db.quiz_questions.documents["q2"]["archived"])
        self.assertIn("q2-a", db.quiz_options.documents)
        answer = db.quiz_attempt_answers.documents["answer"]
        self.assertIn(answer["question_id"], db.quiz_questions.documents)
        self.assertIn(answer["selected_option_id"], db.quiz_options.documents)


if __name__ == "__main__":
    unittest.main()
