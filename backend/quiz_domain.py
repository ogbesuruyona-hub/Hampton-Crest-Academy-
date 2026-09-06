"""Pure course and quiz-domain helpers shared by routes, migrations, and tests."""

from __future__ import annotations

import re
import unicodedata


COURSE_CATALOG = [
    {"id": "fundamentos", "title": "Fundamentos", "position": 0},
    {"id": "macro-y-ciclos-de-capital", "title": "Macro y Ciclos de Capital", "position": 1},
    {"id": "construccion-de-cartera", "title": "Construcción de Cartera", "position": 2},
    {"id": "disciplina-conductual", "title": "Disciplina Conductual", "position": 3},
    {"id": "practica-avanzada", "title": "Práctica Avanzada", "position": 4},
]

DEFAULT_EDUCATION_COURSE_ID = "fundamentos"


def slugify_course(value: str | None) -> str:
    normalized = unicodedata.normalize("NFKD", (value or "").strip().lower())
    ascii_value = "".join(char for char in normalized if not unicodedata.combining(char))
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    if slug == "foundations":
        return "fundamentos"
    return slug or "ruta-general"


def education_course_id(document: dict | None) -> str:
    """Resolve the explicit course for a lesson, keeping legacy records together.

    Older Academy content only stored ``track``. The existing production records
    are all chapters of the first investment course, so records without the new
    field intentionally remain in Fundamentos instead of becoming separate
    courses.
    """
    document = document or {}
    return slugify_course(document.get("course_id") or DEFAULT_EDUCATION_COURSE_ID)


def is_course_introduction(document: dict | None) -> bool:
    """Return whether a resource introduces a course and is not a lesson."""
    document = document or {}
    if document.get("is_course_intro") is True:
        return True
    title_slug = slugify_course(document.get("title"))
    return title_slug == "introduccion" or title_slug.startswith("introduccion-")


def course_definition(course_id: str) -> dict | None:
    normalized = slugify_course(course_id)
    return next((course for course in COURSE_CATALOG if course["id"] == normalized), None)


def previous_course(course_id: str) -> dict | None:
    course = course_definition(course_id)
    if not course or course["position"] <= 0:
        return None
    return COURSE_CATALOG[course["position"] - 1]


def course_gate_locked(course_id: str, active_quiz_course_ids: set[str], completed_course_ids: set[str]) -> bool:
    course = course_definition(course_id)
    if not course:
        return False
    required = {
        earlier["id"]
        for earlier in COURSE_CATALOG[: course["position"]]
        if earlier["id"] in active_quiz_course_ids
    }
    return not required.issubset(completed_course_ids)


def calculate_score(correct_answers: int, total_questions: int) -> int:
    if total_questions <= 0:
        return 0
    return round((correct_answers / total_questions) * 100)


def score_passed(score: int, passing_score: int = 80) -> bool:
    return score >= passing_score


def next_attempt_number(completed_attempt_count: int) -> int:
    return max(0, completed_attempt_count) + 1


class QuizRuleError(ValueError):
    """Raised when a quiz state transition violates a business invariant."""


def attempt_owned_by(attempt: dict | None, user_id: str) -> bool:
    return bool(attempt and attempt.get("user_id") == user_id)


def next_question(snapshots: list[dict], answered_count: int) -> dict | None:
    if answered_count < 0 or answered_count >= len(snapshots):
        return None
    return public_question(snapshots[answered_count])


def grade_answer(
    snapshot: dict,
    question_id: str,
    selected_option_id: str,
    *,
    already_answered: bool = False,
) -> dict:
    if already_answered:
        raise QuizRuleError("Esta pregunta ya fue respondida.")
    if question_id != snapshot.get("id"):
        raise QuizRuleError("Esta pregunta no corresponde al paso actual del intento.")
    option_ids = {option["id"] for option in snapshot.get("options", [])}
    if selected_option_id not in option_ids:
        raise QuizRuleError("La opción seleccionada no pertenece a esta pregunta.")
    correct_option_id = snapshot["correct_option_id"]
    return {
        "correct": selected_option_id == correct_option_id,
        "question_id": question_id,
        "selected_option_id": selected_option_id,
        "correct_option_id": correct_option_id,
        "explanation": snapshot["explanation"],
    }


def completion_result(answer_correctness: list[bool], total_questions: int, passing_score: int = 80) -> dict:
    if len(answer_correctness) != total_questions:
        raise QuizRuleError("Responde todas las preguntas antes de finalizar.")
    correct_answers = sum(bool(value) for value in answer_correctness)
    score = calculate_score(correct_answers, total_questions)
    return {
        "score": score,
        "correct_answers": correct_answers,
        "incorrect_answers": total_questions - correct_answers,
        "total_questions": total_questions,
        "passed": score_passed(score, passing_score),
    }


def validate_question_payload(question: dict) -> None:
    options = question.get("options") or []
    if len(options) != 4:
        raise ValueError("Cada pregunta debe tener exactamente cuatro opciones.")
    if sum(bool(option.get("is_correct")) for option in options) != 1:
        raise ValueError("Cada pregunta debe tener exactamente una respuesta correcta.")


def public_question(snapshot: dict | None) -> dict | None:
    if not snapshot:
        return None
    return {
        "id": snapshot["id"],
        "question_text": snapshot["question_text"],
        "difficulty": snapshot["difficulty"],
        "position": snapshot["position"],
        "options": [
            {
                "id": option["id"],
                "option_text": option["option_text"],
                "position": option["position"],
            }
            for option in snapshot.get("options", [])
        ],
    }
