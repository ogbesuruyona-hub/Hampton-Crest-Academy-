"""Dependency-light Quiz Engine tests runnable with the Python standard library."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from quiz_domain import (  # noqa: E402
    QuizRuleError,
    attempt_owned_by,
    completion_result,
    course_gate_locked,
    education_course_id,
    grade_answer,
    is_course_introduction,
    next_attempt_number,
    next_question,
    public_question,
)


def question_snapshot() -> dict:
    return {
        "id": "question-1",
        "question_text": "¿Qué representa una acción?",
        "difficulty": "fundamental",
        "position": 0,
        "explanation": "Representa propiedad parcial de una empresa.",
        "correct_option_id": "option-a",
        "options": [
            {"id": "option-a", "option_text": "Propiedad", "position": 0},
            {"id": "option-b", "option_text": "Deuda", "position": 1},
            {"id": "option-c", "option_text": "Efectivo", "position": 2},
            {"id": "option-d", "option_text": "Seguro", "position": 3},
        ],
    }


class QuizDomainTests(unittest.TestCase):
    def test_active_question_never_exposes_answer_or_explanation(self):
        payload = public_question(question_snapshot())
        self.assertNotIn("correct_option_id", payload)
        self.assertNotIn("explanation", payload)
        self.assertTrue(all("is_correct" not in option for option in payload["options"]))

    def test_correct_answer_is_graded_server_side(self):
        result = grade_answer(question_snapshot(), "question-1", "option-a")
        self.assertTrue(result["correct"])
        self.assertEqual(result["correct_option_id"], "option-a")
        self.assertIn("propiedad", result["explanation"].lower())

    def test_incorrect_answer_is_graded_server_side(self):
        result = grade_answer(question_snapshot(), "question-1", "option-b")
        self.assertFalse(result["correct"])

    def test_duplicate_answer_is_rejected(self):
        with self.assertRaises(QuizRuleError):
            grade_answer(question_snapshot(), "question-1", "option-a", already_answered=True)

    def test_question_or_option_outside_attempt_is_rejected(self):
        with self.assertRaises(QuizRuleError):
            grade_answer(question_snapshot(), "another-question", "option-a")
        with self.assertRaises(QuizRuleError):
            grade_answer(question_snapshot(), "question-1", "foreign-option")

    def test_eight_of_ten_passes(self):
        result = completion_result([True] * 8 + [False] * 2, 10, 80)
        self.assertEqual(result["score"], 80)
        self.assertTrue(result["passed"])

    def test_seven_of_ten_fails(self):
        result = completion_result([True] * 7 + [False] * 3, 10, 80)
        self.assertEqual(result["score"], 70)
        self.assertFalse(result["passed"])

    def test_incomplete_attempt_cannot_be_scored_or_manipulated(self):
        with self.assertRaises(QuizRuleError):
            completion_result([True] * 7, 10, 80)
        # The score is derived only from stored correctness values; no client score is accepted.
        self.assertEqual(completion_result([False] * 10, 10, 80)["score"], 0)

    def test_attempt_ownership_is_user_scoped(self):
        attempt = {"user_id": "user-a"}
        self.assertTrue(attempt_owned_by(attempt, "user-a"))
        self.assertFalse(attempt_owned_by(attempt, "user-b"))

    def test_refresh_resumes_at_first_unanswered_question(self):
        snapshots = [question_snapshot(), {**question_snapshot(), "id": "question-2"}]
        self.assertEqual(next_question(snapshots, 1)["id"], "question-2")

    def test_repeated_attempt_increments_attempt_number(self):
        self.assertEqual(next_attempt_number(0), 1)
        self.assertEqual(next_attempt_number(1), 2)

    def test_next_course_unlocks_only_after_required_quiz_passes(self):
        active = {"fundamentos"}
        self.assertTrue(course_gate_locked("macro-y-ciclos-de-capital", active, set()))
        self.assertFalse(course_gate_locked("macro-y-ciclos-de-capital", active, {"fundamentos"}))

    def test_legacy_education_records_stay_in_single_foundations_course(self):
        self.assertEqual(education_course_id({"track": "Práctica Avanzada"}), "fundamentos")
        self.assertEqual(education_course_id({"course_id": "practica-avanzada"}), "practica-avanzada")

    def test_course_introduction_is_not_a_lesson(self):
        self.assertTrue(is_course_introduction({"title": "Introducción"}))
        self.assertTrue(is_course_introduction({"title": "Introducción al curso"}))
        self.assertTrue(is_course_introduction({"title": "Otro título", "is_course_intro": True}))
        self.assertFalse(is_course_introduction({"title": "Capítulo 1"}))


if __name__ == "__main__":
    unittest.main()
