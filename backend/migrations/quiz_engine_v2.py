"""One-time cleanup of the temporary Fundamentos admin QA edits."""

from __future__ import annotations

from migrations.quiz_engine_v1 import DEMO_QUESTIONS, _seed_id


MIGRATION_ID = "quiz_engine_v2_restore_fundamentos_after_qa"


def demo_restore_blueprint() -> list[dict]:
    """Return the canonical demo questions with deterministic persistent IDs."""
    output = []
    for question_position, question in enumerate(DEMO_QUESTIONS):
        question_id = _seed_id(f"fundamentos:q:{question_position}")
        output.append({
            "id": question_id,
            "position": question_position,
            "question_text": question["question_text"],
            "explanation": question["explanation"],
            "difficulty": question["difficulty"],
            "options": [
                {
                    "id": _seed_id(f"fundamentos:q:{question_position}:o:{option_position}"),
                    "position": option_position,
                    "option_text": option_text,
                    "is_correct": is_correct,
                }
                for option_position, (option_text, is_correct) in enumerate(question["options"])
            ],
        })
    return output


async def restore_fundamentos_demo_after_qa(db, now_utc) -> None:
    """Restore only the seeded demo quiz, then record completion permanently."""
    if await db.app_migrations.find_one({"_id": MIGRATION_ID}, {"_id": 1}):
        return

    quiz = await db.quizzes.find_one({"course_id": "fundamentos", "seed_key": "fundamentos-v1"})
    if not quiz:
        return

    now = now_utc()
    blueprint = demo_restore_blueprint()

    # Move records out of their unique position ranges before restoring order.
    for question in blueprint:
        await db.quiz_questions.update_one(
            {"_id": question["id"], "quiz_id": quiz["_id"]},
            {"$set": {"position": 1000 + question["position"]}},
        )
        for option in question["options"]:
            await db.quiz_options.update_one(
                {"_id": option["id"], "question_id": question["id"]},
                {"$set": {"position": 100 + option["position"]}},
            )

    for question in blueprint:
        await db.quiz_questions.update_one(
            {"_id": question["id"], "quiz_id": quiz["_id"]},
            {
                "$set": {
                    "question_text": question["question_text"],
                    "explanation": question["explanation"],
                    "difficulty": question["difficulty"],
                    "position": question["position"],
                    "is_active": True,
                    "updated_at": now,
                },
                "$unset": {"archived": "", "archived_at": ""},
            },
        )
        for option in question["options"]:
            await db.quiz_options.update_one(
                {"_id": option["id"], "question_id": question["id"]},
                {
                    "$set": {
                        "option_text": option["option_text"],
                        "position": option["position"],
                        "is_correct": option["is_correct"],
                        "updated_at": now,
                    },
                    "$unset": {"archived": "", "archived_at": ""},
                },
            )

    await db.quizzes.update_one(
        {"_id": quiz["_id"]},
        {
            "$set": {
                "title": "Evaluación de Fundamentos de Inversión",
                "passing_score": 80,
                "updated_at": now,
            },
            "$inc": {"version": 1},
        },
    )
    await db.app_migrations.update_one(
        {"_id": MIGRATION_ID},
        {"$set": {"completed_at": now}},
        upsert=True,
    )

