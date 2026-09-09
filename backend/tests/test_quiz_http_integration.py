"""End-to-end HTTP regression for Quiz Engine using synthetic data only."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import jwt
import pytest
import requests
from bson import ObjectId
from pymongo import MongoClient


BASE_URL = os.environ.get("QUIZ_TEST_BASE_URL", "").rstrip("/")
MONGO_URL = os.environ.get("QUIZ_TEST_MONGO_URL", "")
DB_NAME = os.environ.get("QUIZ_TEST_DB_NAME", "")
JWT_SECRET = os.environ.get("QUIZ_TEST_JWT_SECRET", "")

pytestmark = pytest.mark.skipif(
    not all((BASE_URL, MONGO_URL, DB_NAME, JWT_SECRET)),
    reason="Synthetic Quiz Engine integration environment is not configured",
)


def _token(user_id: ObjectId, email: str) -> str:
    return jwt.encode(
        {
            "sub": str(user_id),
            "email": email,
            "type": "access",
            "aal": 1,
            "iat": datetime.now(timezone.utc),
        },
        JWT_SECRET,
        algorithm="HS256",
    )


def _assert_no_answer_key(value):
    forbidden = {"is_correct", "correct_answer", "correct_option_id", "explanation"}
    if isinstance(value, dict):
        assert forbidden.isdisjoint(value), value
        for child in value.values():
            _assert_no_answer_key(child)
    elif isinstance(value, list):
        for child in value:
            _assert_no_answer_key(child)


@pytest.fixture(scope="module")
def quiz_environment():
    client = MongoClient(MONGO_URL)
    database = client[DB_NAME]
    marker = "quiz-http-integration"
    users = {
        "passing": {
            "_id": ObjectId(),
            "email": "quiz-passing@example.invalid",
            "name": "Quiz Passing Test",
            "role": "member",
            "membership_status": "active",
            "complimentary": True,
        },
        "retrying": {
            "_id": ObjectId(),
            "email": "quiz-retrying@example.invalid",
            "name": "Quiz Retrying Test",
            "role": "member",
            "membership_status": "active",
            "complimentary": True,
        },
        "other": {
            "_id": ObjectId(),
            "email": "quiz-other@example.invalid",
            "name": "Quiz Other Test",
            "role": "member",
            "membership_status": "active",
            "complimentary": True,
        },
    }
    for user in users.values():
        user["test_marker"] = marker
        database.users.insert_one(user)

    lesson_ids = [f"qa-fundamentos-lesson-{position}" for position in range(1, 4)]
    for position, lesson_id in enumerate(lesson_ids, start=1):
        database.education_modules.insert_one(
            {
                "_id": lesson_id,
                "title": f"Leccion QA {position}",
                "course_id": "fundamentos",
                "track": "Fundamentos",
                "status": "published",
                "is_course_intro": False,
                "order": position,
                "test_marker": marker,
            }
        )

    quiz = database.quizzes.find_one({"course_id": "fundamentos", "is_active": True})
    assert quiz, "release_setup must seed the Fundamentos quiz"
    headers = {
        name: {"Authorization": f"Bearer {_token(user['_id'], user['email'])}"}
        for name, user in users.items()
    }
    try:
        yield database, quiz, lesson_ids, headers, users
    finally:
        user_ids = [str(user["_id"]) for user in users.values()]
        database.quiz_attempt_answers.delete_many({"user_id": {"$in": user_ids}})
        database.quiz_attempts.delete_many({"user_id": {"$in": user_ids}})
        database.course_progress.delete_many({"user_id": {"$in": user_ids}})
        database.education_modules.delete_many({"test_marker": marker})
        database.users.delete_many({"test_marker": marker})
        client.close()


def _complete_lessons(lesson_ids, headers):
    for lesson_id in lesson_ids:
        response = requests.post(
            f"{BASE_URL}/api/progress/lessons/{lesson_id}",
            headers=headers,
            json={"completed": True},
            timeout=10,
        )
        assert response.status_code == 200, response.text
    assert response.json()["content_completed"] is True


def _answer_current(database, attempt, headers, *, correctly: bool):
    question = attempt["question"]
    stored_options = list(database.quiz_options.find({"question_id": question["id"]}))
    correct_id = next(option["_id"] for option in stored_options if option["is_correct"])
    if correctly:
        option_id = correct_id
    else:
        option_id = next(option["_id"] for option in stored_options if not option["is_correct"])
    response = requests.post(
        f"{BASE_URL}/api/quiz-attempts/{attempt['id']}/answer",
        headers=headers,
        json={"question_id": question["id"], "selected_option_id": option_id},
        timeout=10,
    )
    assert response.status_code == 200, response.text
    assert response.json()["correct"] is correctly
    assert "explanation" in response.json()
    return response


def _continue_attempt(attempt_id, headers):
    response = requests.get(
        f"{BASE_URL}/api/quiz-attempts/{attempt_id}", headers=headers, timeout=10
    )
    assert response.status_code == 200, response.text
    return response.json()


def _finish_with_score(database, quiz_id, headers, correct_count):
    started = requests.post(
        f"{BASE_URL}/api/quizzes/{quiz_id}/start", headers=headers, timeout=10
    )
    assert started.status_code == 200, started.text
    attempt = started.json()
    _assert_no_answer_key(attempt)
    for position in range(10):
        _answer_current(database, attempt, headers, correctly=position < correct_count)
        if position < 9:
            attempt = _continue_attempt(attempt["id"], headers)
            _assert_no_answer_key(attempt)
    completed = requests.post(
        f"{BASE_URL}/api/quiz-attempts/{attempt['id']}/complete",
        headers=headers,
        # A client-supplied score must be ignored; the API has no score input.
        json={"score": 100, "passed": True},
        timeout=10,
    )
    assert completed.status_code == 200, completed.text
    return completed.json()


def test_quiz_pass_refresh_security_and_unlock(quiz_environment):
    database, quiz, lesson_ids, headers, users = quiz_environment
    _complete_lessons(lesson_ids, headers["passing"])

    before = requests.get(
        f"{BASE_URL}/api/courses/macro-y-ciclos-de-capital/quiz-status",
        headers=headers["passing"],
        timeout=10,
    )
    assert before.status_code == 200
    assert before.json()["locked"] is True

    started = requests.post(
        f"{BASE_URL}/api/quizzes/{quiz['_id']}/start",
        headers=headers["passing"],
        timeout=10,
    )
    assert started.status_code == 200, started.text
    attempt = started.json()
    assert attempt["total_questions"] == 10
    _assert_no_answer_key(attempt)

    first_payload = None
    for position in range(3):
        if position == 0:
            first_payload = {
                "question_id": attempt["question"]["id"],
                "selected_option_id": next(
                    option["_id"]
                    for option in database.quiz_options.find(
                        {"question_id": attempt["question"]["id"], "is_correct": True}
                    )
                ),
            }
        _answer_current(database, attempt, headers["passing"], correctly=True)
        attempt = _continue_attempt(attempt["id"], headers["passing"])

    assert attempt["answered_questions"] == 3
    assert attempt["question_number"] == 4
    resumed = requests.post(
        f"{BASE_URL}/api/quizzes/{quiz['_id']}/start",
        headers=headers["passing"],
        timeout=10,
    )
    assert resumed.status_code == 200
    assert resumed.json()["id"] == attempt["id"]
    assert database.quiz_attempts.count_documents(
        {
            "user_id": str(users["passing"]["_id"]),
            "quiz_id": quiz["_id"],
            "status": "in_progress",
        }
    ) == 1

    duplicate = requests.post(
        f"{BASE_URL}/api/quiz-attempts/{attempt['id']}/answer",
        headers=headers["passing"],
        json=first_payload,
        timeout=10,
    )
    assert duplicate.status_code in {409, 422}

    other_user = requests.get(
        f"{BASE_URL}/api/quiz-attempts/{attempt['id']}",
        headers=headers["other"],
        timeout=10,
    )
    assert other_user.status_code == 404

    for position in range(3, 10):
        _answer_current(database, attempt, headers["passing"], correctly=position < 8)
        if position < 9:
            attempt = _continue_attempt(attempt["id"], headers["passing"])
    completed = requests.post(
        f"{BASE_URL}/api/quiz-attempts/{attempt['id']}/complete",
        headers=headers["passing"],
        json={"score": 0, "passed": False},
        timeout=10,
    )
    assert completed.status_code == 200, completed.text
    result = completed.json()
    assert result["score"] == 80
    assert result["correct_answers"] == 8
    assert result["passed"] is True
    assert result["attempt_number"] == 1

    progress = requests.get(
        f"{BASE_URL}/api/courses/fundamentos/quiz-status",
        headers=headers["passing"],
        timeout=10,
    ).json()
    assert progress["content_completed"] is True
    assert progress["quiz_passed"] is True
    assert progress["completed"] is True
    after = requests.get(
        f"{BASE_URL}/api/courses/macro-y-ciclos-de-capital/quiz-status",
        headers=headers["passing"],
        timeout=10,
    ).json()
    assert after["locked"] is False


def test_quiz_fail_then_retry_preserves_best_score(quiz_environment):
    database, quiz, lesson_ids, headers, _users = quiz_environment
    _complete_lessons(lesson_ids, headers["retrying"])

    failed = _finish_with_score(database, quiz["_id"], headers["retrying"], 7)
    assert failed["score"] == 70
    assert failed["passed"] is False
    assert failed["attempt_number"] == 1
    failed_progress = requests.get(
        f"{BASE_URL}/api/courses/fundamentos/quiz-status",
        headers=headers["retrying"],
        timeout=10,
    ).json()
    assert failed_progress["quiz_passed"] is False
    assert failed_progress["completed"] is False
    assert failed_progress["best_score"] == 70

    passed = _finish_with_score(database, quiz["_id"], headers["retrying"], 8)
    assert passed["score"] == 80
    assert passed["passed"] is True
    assert passed["attempt_number"] == 2
    assert passed["best_score"] == 80
    passed_progress = requests.get(
        f"{BASE_URL}/api/courses/fundamentos/quiz-status",
        headers=headers["retrying"],
        timeout=10,
    ).json()
    assert passed_progress["attempt_count"] == 2
    assert passed_progress["best_score"] == 80
    assert passed_progress["quiz_passed"] is True
    assert passed_progress["completed"] is True
