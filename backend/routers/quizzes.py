"""Secure Quiz Engine and server-side course-progress routes."""

from __future__ import annotations

import random
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from quiz_domain import (
    COURSE_CATALOG,
    QuizRuleError,
    completion_result,
    course_gate_locked,
    course_definition,
    grade_answer,
    next_attempt_number,
    next_question,
    slugify_course,
    validate_question_payload,
)


router = APIRouter(prefix="/api", tags=["quizzes"])
_random = random.SystemRandom()


class LessonProgressIn(BaseModel):
    completed: bool = True


class LessonProgressSyncIn(BaseModel):
    lesson_ids: list[str] = Field(default_factory=list, max_length=500)


class QuizAnswerIn(BaseModel):
    question_id: str = Field(min_length=1, max_length=100)
    selected_option_id: str = Field(min_length=1, max_length=100)


class QuizOptionAdminIn(BaseModel):
    id: Optional[str] = None
    option_text: str = Field(min_length=1, max_length=500)
    position: int = Field(default=0, ge=0, le=20)
    is_correct: bool = False


class QuizQuestionAdminIn(BaseModel):
    id: Optional[str] = None
    question_text: str = Field(min_length=1, max_length=1000)
    explanation: str = Field(min_length=1, max_length=2000)
    difficulty: Literal["fundamental", "intermediate", "application"] = "fundamental"
    position: int = Field(default=0, ge=0, le=100)
    is_active: bool = True
    options: list[QuizOptionAdminIn] = Field(min_length=4, max_length=4)


class QuizAdminIn(BaseModel):
    course_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    passing_score: int = Field(default=80, ge=1, le=100)
    is_active: bool = True
    questions: list[QuizQuestionAdminIn] = Field(default_factory=list, max_length=100)


def _course_title(course_id: str) -> str:
    course = course_definition(course_id)
    return course["title"] if course else course_id.replace("-", " ").title()


async def course_is_locked(db, user_id: str, course_id: str) -> bool:
    """A course is gated while any earlier active course evaluation remains unpassed."""
    course = course_definition(course_id)
    if not course or course["position"] <= 0:
        return False
    earlier_ids = [earlier["id"] for earlier in COURSE_CATALOG[: course["position"]]]
    active_quizzes = await db.quizzes.find(
        {"course_id": {"$in": earlier_ids}, "is_active": True}, {"course_id": 1}
    ).to_list(len(earlier_ids))
    progress_docs = await db.course_progress.find(
        {"user_id": user_id, "course_id": {"$in": earlier_ids}, "completed": True},
        {"course_id": 1},
    ).to_list(len(earlier_ids))
    return course_gate_locked(
        course_id,
        {quiz["course_id"] for quiz in active_quizzes},
        {progress["course_id"] for progress in progress_docs},
    )


def _public_quiz(quiz: dict | None, question_count: int = 0) -> dict | None:
    if not quiz:
        return None
    return {
        "id": quiz["_id"],
        "course_id": quiz["course_id"],
        "course_title": quiz.get("course_title") or _course_title(quiz["course_id"]),
        "title": quiz["title"],
        "description": quiz.get("description", ""),
        "passing_score": quiz.get("passing_score", 80),
        "is_active": bool(quiz.get("is_active")),
        "question_count": question_count,
    }


async def _active_quiz(db, course_id: str) -> dict | None:
    return await db.quizzes.find_one({"course_id": slugify_course(course_id), "is_active": True})


async def _published_lessons(db, course_id: str) -> list[dict]:
    course = course_definition(course_id)
    title = course["title"] if course else _course_title(course_id)
    aliases = [title]
    if course_id == "fundamentos":
        aliases.append("Foundations")
    return await db.education_modules.find(
        {"status": "published", "track": {"$in": aliases}},
        {"_id": 1},
    ).to_list(500)


async def _refresh_course_progress(db, now_utc, user_id: str, course_id: str) -> dict:
    course_id = slugify_course(course_id)
    lessons = await _published_lessons(db, course_id)
    lesson_ids = {str(lesson["_id"]) for lesson in lessons}
    progress = await db.course_progress.find_one({"user_id": user_id, "course_id": course_id}) or {}
    completed_ids = set(progress.get("completed_lesson_ids") or []) & lesson_ids
    content_completed = bool(lesson_ids) and completed_ids == lesson_ids
    quiz = await _active_quiz(db, course_id)
    recorded_quiz_passed = bool(progress.get("quiz_passed"))
    effective_quiz_passed = recorded_quiz_passed if quiz else True
    completed = content_completed and effective_quiz_passed
    updates = {
        "course_title": _course_title(course_id),
        "completed_lesson_ids": sorted(completed_ids),
        "total_lessons": len(lesson_ids),
        "completed_lessons": len(completed_ids),
        "content_completed": content_completed,
        # Never pre-approve a future quiz merely because this course has none today.
        "quiz_passed": recorded_quiz_passed,
        "completed": completed,
        "updated_at": now_utc(),
    }
    await db.course_progress.update_one(
        {"user_id": user_id, "course_id": course_id},
        {
            "$set": updates,
            "$setOnInsert": {
                "user_id": user_id,
                "course_id": course_id,
                "created_at": now_utc(),
            },
        },
        upsert=True,
    )
    return {
        **progress,
        **updates,
        "quiz_passed": effective_quiz_passed,
        "user_id": user_id,
        "course_id": course_id,
    }


async def _best_attempt(db, user_id: str, quiz_id: str) -> dict | None:
    return await db.quiz_attempts.find_one(
        {"user_id": user_id, "quiz_id": quiz_id, "status": "completed"},
        sort=[("score", -1), ("completed_at", 1)],
    )


async def _attempt_response(db, attempt: dict) -> dict:
    answered = await db.quiz_attempt_answers.count_documents({"attempt_id": attempt["_id"]})
    snapshots = attempt.get("question_snapshots") or []
    question = next_question(snapshots, answered) if attempt.get("status") == "in_progress" else None
    response = {
        "id": attempt["_id"],
        "quiz_id": attempt["quiz_id"],
        "course_id": attempt["course_id"],
        "quiz_title": attempt.get("quiz_title", "Evaluación"),
        "course_title": attempt.get("course_title", _course_title(attempt["course_id"])),
        "passing_score": attempt.get("passing_score", 80),
        "attempt_number": attempt["attempt_number"],
        "status": attempt["status"],
        "answered_questions": answered,
        "total_questions": attempt["total_questions"],
        "question_number": answered + 1 if question else None,
        "question": question,
        "started_at": attempt.get("started_at"),
    }
    if attempt.get("status") == "completed":
        response.update(
            {
                "score": attempt["score"],
                "correct_answers": attempt["correct_answers"],
                "incorrect_answers": attempt["total_questions"] - attempt["correct_answers"],
                "passed": attempt["passed"],
                "completed_at": attempt.get("completed_at"),
            }
        )
    return response


async def _quiz_status(db, now_utc, current_user: dict, course_id: str) -> dict:
    course_id = slugify_course(course_id)
    course = course_definition(course_id)
    if not course:
        raise HTTPException(404, "Curso no encontrado.")
    user_id = current_user["id"]
    progress = await _refresh_course_progress(db, now_utc, user_id, course_id)
    quiz = await _active_quiz(db, course_id)
    question_count = 0
    best = None
    active_attempt = None
    if quiz:
        question_count = await db.quiz_questions.count_documents({"quiz_id": quiz["_id"], "is_active": True})
        best = await _best_attempt(db, user_id, quiz["_id"])
        active_attempt = await db.quiz_attempts.find_one(
            {"user_id": user_id, "quiz_id": quiz["_id"], "status": "in_progress"},
            {"_id": 1},
        )
    locked = False if current_user.get("role") == "admin" else await course_is_locked(db, user_id, course_id)
    return {
        "course": course,
        "locked": locked,
        "content_completed": progress["content_completed"],
        "quiz_passed": bool(progress["quiz_passed"]),
        "completed": bool(progress["completed"]),
        "completed_lessons": progress["completed_lessons"],
        "total_lessons": progress["total_lessons"],
        "quiz": _public_quiz(quiz, question_count),
        "active_attempt_id": active_attempt["_id"] if active_attempt else None,
        "attempt_count": await db.quiz_attempts.count_documents({"user_id": user_id, "quiz_id": quiz["_id"], "status": "completed"}) if quiz else 0,
        "best_score": best.get("score") if best else None,
    }


async def _question_snapshots(db, quiz_id: str) -> list[dict]:
    questions = await db.quiz_questions.find(
        {"quiz_id": quiz_id, "is_active": True}
    ).sort("position", 1).to_list(100)
    if len(questions) != 10:
        raise HTTPException(409, "Este quiz debe tener exactamente 10 preguntas activas antes de iniciarse.")
    snapshots = []
    for question in questions:
        options = await db.quiz_options.find(
            {"question_id": question["_id"], "archived": {"$ne": True}}
        ).sort("position", 1).to_list(20)
        if len(options) != 4 or sum(bool(option.get("is_correct")) for option in options) != 1:
            raise HTTPException(409, "El quiz tiene una pregunta con opciones incompletas.")
        shuffled_options = list(options)
        _random.shuffle(shuffled_options)
        snapshots.append(
            {
                "id": question["_id"],
                "question_text": question["question_text"],
                "explanation": question["explanation"],
                "difficulty": question["difficulty"],
                "position": question["position"],
                "correct_option_id": next(option["_id"] for option in options if option.get("is_correct")),
                "options": [
                    {
                        "id": option["_id"],
                        "option_text": option["option_text"],
                        "position": option["position"],
                    }
                    for option in shuffled_options
                ],
            }
        )
    _random.shuffle(snapshots)
    return snapshots


def _validate_admin_quiz(payload: QuizAdminIn) -> None:
    active_questions = [question for question in payload.questions if question.is_active]
    if payload.is_active and len(active_questions) != 10:
        raise HTTPException(422, "Un quiz activo debe tener exactamente 10 preguntas activas.")
    try:
        for question in payload.questions:
            validate_question_payload(question.model_dump())
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


async def _replace_questions(db, now_utc, new_id, quiz_id: str, questions: list[QuizQuestionAdminIn]) -> None:
    previous = await db.quiz_questions.find({"quiz_id": quiz_id}).to_list(500)
    previous_by_id = {question["_id"]: question for question in previous}
    retained_question_ids: set[str] = set()
    now = now_utc()
    # Positions are uniquely indexed per quiz. Move existing rows out of the
    # final range first so reordering cannot collide midway through the update.
    for temporary_position, question_id in enumerate(previous_by_id, start=1000):
        await db.quiz_questions.update_one(
            {"_id": question_id}, {"$set": {"position": temporary_position}}
        )
    for question_position, item in enumerate(questions):
        question_id = item.id if item.id in previous_by_id else new_id()
        retained_question_ids.add(question_id)
        question_fields = {
            "quiz_id": quiz_id,
            "question_text": item.question_text.strip(),
            "explanation": item.explanation.strip(),
            "difficulty": item.difficulty,
            "position": question_position,
            "is_active": item.is_active,
            "archived": False,
            "updated_at": now,
        }
        if question_id in previous_by_id:
            await db.quiz_questions.update_one({"_id": question_id}, {"$set": question_fields})
        else:
            await db.quiz_questions.insert_one({"_id": question_id, "created_at": now, **question_fields})

        previous_options = await db.quiz_options.find({"question_id": question_id}).to_list(50)
        previous_options_by_id = {option["_id"]: option for option in previous_options}
        retained_option_ids: set[str] = set()
        # The same two-phase move is required by the per-question position index.
        for temporary_position, option_id in enumerate(previous_options_by_id, start=100):
            await db.quiz_options.update_one(
                {"_id": option_id}, {"$set": {"position": temporary_position}}
            )
        for option_position, option in enumerate(item.options):
            option_id = option.id if option.id in previous_options_by_id else new_id()
            retained_option_ids.add(option_id)
            option_fields = {
                "question_id": question_id,
                "option_text": option.option_text.strip(),
                "position": option_position,
                "is_correct": option.is_correct,
                "archived": False,
                "updated_at": now,
            }
            if option_id in previous_options_by_id:
                await db.quiz_options.update_one({"_id": option_id}, {"$set": option_fields})
            else:
                await db.quiz_options.insert_one({"_id": option_id, "created_at": now, **option_fields})

        removed_option_ids = set(previous_options_by_id) - retained_option_ids
        for option_id in removed_option_ids:
            referenced = await db.quiz_attempt_answers.find_one({"selected_option_id": option_id}, {"_id": 1})
            if referenced:
                await db.quiz_options.update_one(
                    {"_id": option_id}, {"$set": {"archived": True, "updated_at": now}}
                )
            else:
                await db.quiz_options.delete_one({"_id": option_id})

    removed_question_ids = set(previous_by_id) - retained_question_ids
    for question_id in removed_question_ids:
        referenced = await db.quiz_attempt_answers.find_one({"question_id": question_id}, {"_id": 1})
        if referenced:
            await db.quiz_questions.update_one(
                {"_id": question_id},
                {"$set": {"is_active": False, "archived": True, "updated_at": now}},
            )
        else:
            await db.quiz_options.delete_many({"question_id": question_id})
            await db.quiz_questions.delete_one({"_id": question_id})


async def _admin_quiz(db, quiz: dict) -> dict:
    questions = await db.quiz_questions.find(
        {"quiz_id": quiz["_id"], "archived": {"$ne": True}}
    ).sort("position", 1).to_list(100)
    output_questions = []
    for question in questions:
        options = await db.quiz_options.find(
            {"question_id": question["_id"], "archived": {"$ne": True}}
        ).sort("position", 1).to_list(20)
        output_questions.append(
            {
                "id": question["_id"],
                "question_text": question["question_text"],
                "explanation": question["explanation"],
                "difficulty": question["difficulty"],
                "position": question["position"],
                "is_active": question.get("is_active", True),
                "options": [
                    {
                        "id": option["_id"],
                        "option_text": option["option_text"],
                        "position": option["position"],
                        "is_correct": bool(option.get("is_correct")),
                    }
                    for option in options
                ],
            }
        )
    return {**_public_quiz(quiz, len(questions)), "questions": output_questions, "version": quiz.get("version", 1)}


def register_quiz_routes(*, db, require_member, require_admin, now_utc, new_id):
    @router.get("/progress/courses")
    async def course_progress(current_user: dict = Depends(require_member)):
        results = []
        for course in COURSE_CATALOG:
            status = await _quiz_status(db, now_utc, current_user, course["id"])
            progress = await db.course_progress.find_one(
                {"user_id": current_user["id"], "course_id": course["id"]}
            ) or {}
            results.append({**status, "completed_lesson_ids": progress.get("completed_lesson_ids", [])})
        return results

    @router.post("/progress/lessons/sync")
    async def sync_lesson_progress(payload: LessonProgressSyncIn, current_user: dict = Depends(require_member)):
        unique_ids = list(dict.fromkeys(payload.lesson_ids))
        if unique_ids:
            query = {"_id": {"$in": unique_ids}}
            if current_user.get("role") != "admin":
                query["status"] = "published"
            lessons = await db.education_modules.find(query, {"_id": 1, "track": 1}).to_list(500)
            grouped: dict[str, list[str]] = {}
            for lesson in lessons:
                course_id = slugify_course(lesson.get("track"))
                grouped.setdefault(course_id, []).append(str(lesson["_id"]))
            for course_id, lesson_ids in grouped.items():
                await db.course_progress.update_one(
                    {"user_id": current_user["id"], "course_id": course_id},
                    {
                        "$addToSet": {"completed_lesson_ids": {"$each": lesson_ids}},
                        "$setOnInsert": {
                            "user_id": current_user["id"],
                            "course_id": course_id,
                            "created_at": now_utc(),
                        },
                    },
                    upsert=True,
                )
        return await course_progress(current_user)

    @router.post("/progress/lessons/{lesson_id}")
    async def set_lesson_progress(
        lesson_id: str,
        payload: LessonProgressIn,
        current_user: dict = Depends(require_member),
    ):
        lesson_query = {"_id": lesson_id}
        if current_user.get("role") != "admin":
            lesson_query["status"] = "published"
        lesson = await db.education_modules.find_one(lesson_query, {"_id": 1, "track": 1})
        if not lesson:
            raise HTTPException(404, "Lección no encontrada.")
        course_id = slugify_course(lesson.get("track"))
        update = {"$setOnInsert": {"user_id": current_user["id"], "course_id": course_id, "created_at": now_utc()}}
        if payload.completed:
            update["$addToSet"] = {"completed_lesson_ids": lesson_id}
        else:
            update["$pull"] = {"completed_lesson_ids": lesson_id}
        await db.course_progress.update_one(
            {"user_id": current_user["id"], "course_id": course_id},
            update,
            upsert=True,
        )
        return await _quiz_status(db, now_utc, current_user, course_id)

    @router.get("/courses/{course_id}/quiz-status")
    async def quiz_status(course_id: str, current_user: dict = Depends(require_member)):
        return await _quiz_status(db, now_utc, current_user, course_id)

    @router.post("/quizzes/{quiz_id}/start")
    async def start_quiz(quiz_id: str, current_user: dict = Depends(require_member)):
        quiz = await db.quizzes.find_one({"_id": quiz_id, "is_active": True})
        if not quiz:
            raise HTTPException(404, "Quiz no encontrado.")
        status = await _quiz_status(db, now_utc, current_user, quiz["course_id"])
        if status["locked"]:
            raise HTTPException(403, "Debes aprobar la evaluación del curso anterior.")
        if current_user.get("role") != "admin" and not status["content_completed"]:
            raise HTTPException(409, "Completa primero todas las lecciones de este curso.")
        existing = await db.quiz_attempts.find_one(
            {"user_id": current_user["id"], "quiz_id": quiz_id, "status": "in_progress"}
        )
        if existing:
            return await _attempt_response(db, existing)
        snapshots = await _question_snapshots(db, quiz_id)
        completed_attempts = await db.quiz_attempts.count_documents(
            {"user_id": current_user["id"], "quiz_id": quiz_id, "status": "completed"}
        )
        attempt = {
            "_id": new_id(),
            "user_id": current_user["id"],
            "quiz_id": quiz_id,
            "course_id": quiz["course_id"],
            "course_title": quiz.get("course_title") or _course_title(quiz["course_id"]),
            "quiz_title": quiz["title"],
            "quiz_version": quiz.get("version", 1),
            "passing_score": quiz.get("passing_score", 80),
            "question_snapshots": snapshots,
            "total_questions": len(snapshots),
            "attempt_number": next_attempt_number(completed_attempts),
            "status": "in_progress",
            "started_at": now_utc(),
            "completed_at": None,
        }
        try:
            await db.quiz_attempts.insert_one(attempt)
        except DuplicateKeyError:
            existing = await db.quiz_attempts.find_one(
                {"user_id": current_user["id"], "quiz_id": quiz_id, "status": "in_progress"}
            )
            if not existing:
                raise HTTPException(409, "No se pudo iniciar un nuevo intento. Recarga la página.")
            attempt = existing
        return await _attempt_response(db, attempt)

    @router.get("/quiz-attempts/{attempt_id}")
    async def get_attempt(attempt_id: str, current_user: dict = Depends(require_member)):
        attempt = await db.quiz_attempts.find_one({"_id": attempt_id, "user_id": current_user["id"]})
        if not attempt:
            raise HTTPException(404, "Intento no encontrado.")
        response = await _attempt_response(db, attempt)
        if attempt.get("status") == "completed":
            best = await _best_attempt(db, current_user["id"], attempt["quiz_id"])
            response["best_score"] = best.get("score") if best else attempt.get("score")
        return response

    @router.post("/quiz-attempts/{attempt_id}/answer")
    async def answer_question(
        attempt_id: str,
        payload: QuizAnswerIn,
        current_user: dict = Depends(require_member),
    ):
        attempt = await db.quiz_attempts.find_one(
            {"_id": attempt_id, "user_id": current_user["id"], "status": "in_progress"}
        )
        if not attempt:
            raise HTTPException(404, "Intento activo no encontrado.")
        answered = await db.quiz_attempt_answers.count_documents({"attempt_id": attempt_id})
        snapshots = attempt.get("question_snapshots") or []
        if answered >= len(snapshots):
            raise HTTPException(409, "Todas las preguntas ya fueron respondidas.")
        question = snapshots[answered]
        try:
            graded = grade_answer(question, payload.question_id, payload.selected_option_id)
        except QuizRuleError as exc:
            raise HTTPException(422, str(exc)) from exc
        is_correct = graded["correct"]
        answer = {
            "_id": new_id(),
            "attempt_id": attempt_id,
            "user_id": current_user["id"],
            "quiz_id": attempt["quiz_id"],
            "course_id": attempt["course_id"],
            "question_id": question["id"],
            "selected_option_id": payload.selected_option_id,
            "is_correct": is_correct,
            "answered_at": now_utc(),
        }
        try:
            await db.quiz_attempt_answers.insert_one(answer)
        except DuplicateKeyError as exc:
            raise HTTPException(409, "Esta pregunta ya fue respondida.") from exc
        return {
            **graded,
            "answered_questions": answered + 1,
            "total_questions": attempt["total_questions"],
            "has_next": answered + 1 < attempt["total_questions"],
        }

    @router.post("/quiz-attempts/{attempt_id}/complete")
    async def complete_quiz(attempt_id: str, current_user: dict = Depends(require_member)):
        attempt = await db.quiz_attempts.find_one({"_id": attempt_id, "user_id": current_user["id"]})
        if not attempt:
            raise HTTPException(404, "Intento no encontrado.")
        if attempt.get("status") == "completed":
            response = await _attempt_response(db, attempt)
            best = await _best_attempt(db, current_user["id"], attempt["quiz_id"])
            response["best_score"] = best.get("score") if best else attempt.get("score")
            return response
        total = attempt["total_questions"]
        answered = await db.quiz_attempt_answers.count_documents({"attempt_id": attempt_id})
        if answered != total:
            raise HTTPException(409, "Responde todas las preguntas antes de finalizar.")
        answer_docs = await db.quiz_attempt_answers.find(
            {"attempt_id": attempt_id}, {"is_correct": 1}
        ).to_list(total)
        try:
            calculated = completion_result(
                [bool(answer.get("is_correct")) for answer in answer_docs],
                total,
                attempt.get("passing_score", 80),
            )
        except QuizRuleError as exc:
            raise HTTPException(409, str(exc)) from exc
        correct = calculated["correct_answers"]
        score = calculated["score"]
        passed = calculated["passed"]
        completed_at = now_utc()
        result = await db.quiz_attempts.update_one(
            {"_id": attempt_id, "user_id": current_user["id"], "status": "in_progress"},
            {
                "$set": {
                    "status": "completed",
                    "score": score,
                    "correct_answers": correct,
                    "passed": passed,
                    "completed_at": completed_at,
                },
                "$unset": {"question_snapshots": ""},
            },
        )
        if result.modified_count == 0:
            completed = await db.quiz_attempts.find_one({"_id": attempt_id, "user_id": current_user["id"]})
            return await _attempt_response(db, completed)
        if passed:
            progress = await _refresh_course_progress(db, now_utc, current_user["id"], attempt["course_id"])
            await db.course_progress.update_one(
                {"user_id": current_user["id"], "course_id": attempt["course_id"]},
                {
                    "$set": {
                        "quiz_passed": True,
                        "completed": bool(progress["content_completed"]),
                        "completed_at": completed_at if progress["content_completed"] else None,
                        "updated_at": completed_at,
                    }
                },
            )
        completed = {**attempt, "status": "completed", "score": score, "correct_answers": correct, "passed": passed, "completed_at": completed_at}
        response = await _attempt_response(db, completed)
        best = await _best_attempt(db, current_user["id"], attempt["quiz_id"])
        response["best_score"] = best.get("score") if best else score
        return response

    @router.get("/admin/quizzes")
    async def list_admin_quizzes(current_user: dict = Depends(require_admin)):
        quizzes = await db.quizzes.find({}).sort("course_id", 1).to_list(100)
        return [await _admin_quiz(db, quiz) for quiz in quizzes]

    @router.get("/admin/quiz-qa-integrity")
    async def quiz_qa_integrity(current_user: dict = Depends(require_admin)):
        """Temporary aggregate-only production QA probe; removed after validation."""
        quizzes = await db.quizzes.find({}, {"_id": 1, "course_id": 1}).to_list(1000)
        questions = await db.quiz_questions.find({}, {"_id": 1, "quiz_id": 1}).to_list(10000)
        options = await db.quiz_options.find({}, {"_id": 1, "question_id": 1}).to_list(50000)
        attempts = await db.quiz_attempts.find({}).to_list(50000)
        answers = await db.quiz_attempt_answers.find({}).to_list(250000)
        progress = await db.course_progress.find({}).to_list(50000)

        quiz_ids = {item["_id"] for item in quizzes}
        question_ids = {item["_id"] for item in questions}
        option_ids = {item["_id"] for item in options}
        attempt_ids = {item["_id"] for item in attempts}

        active_keys = [(item.get("user_id"), item.get("quiz_id")) for item in attempts if item.get("status") == "in_progress"]
        answer_keys = [(item.get("attempt_id"), item.get("question_id")) for item in answers]

        attempt_numbers: dict[tuple[str, str], list[int]] = {}
        best_scores: dict[tuple[str, str], int] = {}
        quiz_course = {item["_id"]: item.get("course_id") for item in quizzes}
        for item in attempts:
            key = (item.get("user_id"), item.get("quiz_id"))
            attempt_numbers.setdefault(key, []).append(int(item.get("attempt_number") or 0))
            if item.get("status") == "completed" and item.get("score") is not None:
                best_scores[key] = max(best_scores.get(key, -1), int(item["score"]))

        progress_by_key = {(item.get("user_id"), item.get("course_id")): item for item in progress}
        best_score_mismatches = 0
        for (user_id, quiz_id), best_score in best_scores.items():
            item = progress_by_key.get((user_id, quiz_course.get(quiz_id)))
            if not item or int(item.get("best_score") if item.get("best_score") is not None else -1) != best_score:
                best_score_mismatches += 1

        qa_emails = {
            "hamptoncrest.quiz.qa+pass-20260905@example.com",
            "hamptoncrest.quiz.qa+retry-20260905@example.com",
        }
        qa_users = await db.users.find({"email": {"$in": list(qa_emails)}}, {"_id": 1, "email": 1}).to_list(10)
        qa_user_ids = {str(item["_id"]): item["email"] for item in qa_users}
        qa_summary = []
        for user_id, email in qa_user_ids.items():
            user_attempts = [item for item in attempts if item.get("user_id") == user_id]
            user_progress = [item for item in progress if item.get("user_id") == user_id]
            qa_summary.append({
                "account": email.split("+")[-1].split("@")[0],
                "attempts": [
                    {
                        "attempt_number": item.get("attempt_number"),
                        "status": item.get("status"),
                        "score": item.get("score"),
                        "passed": item.get("passed"),
                    }
                    for item in sorted(user_attempts, key=lambda value: value.get("attempt_number", 0))
                ],
                "progress": [
                    {
                        "course_id": item.get("course_id"),
                        "content_completed": item.get("content_completed"),
                        "quiz_passed": item.get("quiz_passed"),
                        "completed": item.get("completed"),
                        "best_score": item.get("best_score"),
                    }
                    for item in user_progress
                ],
            })

        return {
            "counts": {
                "quizzes": len(quizzes),
                "quiz_questions": len(questions),
                "quiz_options": len(options),
                "quiz_attempts": len(attempts),
                "quiz_attempt_answers": len(answers),
                "course_progress": len(progress),
            },
            "integrity": {
                "duplicate_active_attempt_groups": len(active_keys) - len(set(active_keys)),
                "duplicate_attempt_answer_groups": len(answer_keys) - len(set(answer_keys)),
                "attempt_number_sequence_gaps": sum(
                    1 for values in attempt_numbers.values() if sorted(values) != list(range(1, len(values) + 1))
                ),
                "best_score_mismatches": best_score_mismatches,
                "orphan_questions": sum(1 for item in questions if item.get("quiz_id") not in quiz_ids),
                "orphan_options": sum(1 for item in options if item.get("question_id") not in question_ids),
                "orphan_attempts": sum(1 for item in attempts if item.get("quiz_id") not in quiz_ids),
                "orphan_answers_attempt": sum(1 for item in answers if item.get("attempt_id") not in attempt_ids),
                "orphan_answers_question": sum(1 for item in answers if item.get("question_id") not in question_ids),
                "orphan_answers_option": sum(1 for item in answers if item.get("selected_option_id") not in option_ids),
            },
            "qa_accounts": qa_summary,
        }

    @router.post("/admin/quizzes")
    async def create_admin_quiz(payload: QuizAdminIn, current_user: dict = Depends(require_admin)):
        _validate_admin_quiz(payload)
        course_id = slugify_course(payload.course_id)
        if not course_definition(course_id):
            raise HTTPException(422, "Selecciona un curso válido.")
        quiz_id = new_id()
        now = now_utc()
        quiz = {
            "_id": quiz_id,
            "course_id": course_id,
            "course_title": _course_title(course_id),
            "title": payload.title.strip(),
            "description": payload.description.strip(),
            "passing_score": payload.passing_score,
            "is_active": payload.is_active,
            "version": 1,
            "created_at": now,
            "updated_at": now,
        }
        try:
            await db.quizzes.insert_one(quiz)
        except DuplicateKeyError as exc:
            raise HTTPException(409, "Este curso ya tiene un quiz asociado.") from exc
        await _replace_questions(db, now_utc, new_id, quiz_id, payload.questions)
        return await _admin_quiz(db, quiz)

    @router.put("/admin/quizzes/{quiz_id}")
    async def update_admin_quiz(
        quiz_id: str,
        payload: QuizAdminIn,
        current_user: dict = Depends(require_admin),
    ):
        _validate_admin_quiz(payload)
        existing = await db.quizzes.find_one({"_id": quiz_id})
        if not existing:
            raise HTTPException(404, "Quiz no encontrado.")
        course_id = slugify_course(payload.course_id)
        now = now_utc()
        update = {
            "course_id": course_id,
            "course_title": _course_title(course_id),
            "title": payload.title.strip(),
            "description": payload.description.strip(),
            "passing_score": payload.passing_score,
            "is_active": payload.is_active,
            "version": existing.get("version", 1) + 1,
            "updated_at": now,
        }
        try:
            await db.quizzes.update_one({"_id": quiz_id}, {"$set": update})
        except DuplicateKeyError as exc:
            raise HTTPException(409, "Este curso ya tiene otro quiz asociado.") from exc
        await _replace_questions(db, now_utc, new_id, quiz_id, payload.questions)
        return await _admin_quiz(db, {**existing, **update})

    return router
    grade_answer,
    next_question,
