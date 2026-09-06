"""Publish the existing Academy education library as one Fundamentos course."""

from __future__ import annotations

import re


MIGRATION_ID = "education_single_course_v1"
INTRODUCTION_PATTERN = re.compile(r"^\s*introducci[oó]n(?:\s|$)", re.IGNORECASE)


def education_content_fields(title: str, now, published_at=None) -> dict:
    """Return the canonical fields for one existing education resource."""
    return {
        "status": "published",
        "published_at": published_at or now,
        "course_id": "fundamentos",
        "track": "Fundamentos",
        "is_course_intro": bool(INTRODUCTION_PATTERN.search(title or "")),
        "updated_at": now,
    }


async def publish_existing_education_as_fundamentos(db, now_utc) -> None:
    """Normalize only the resources present when this one-time migration runs."""
    if await db.app_migrations.find_one({"_id": MIGRATION_ID}, {"_id": 1}):
        return

    documents = await db.education_modules.find({}, {"title": 1, "published_at": 1}).to_list(500)
    if not documents:
        return

    now = now_utc()
    for document in documents:
        fields = education_content_fields(
            document.get("title", ""),
            now,
            document.get("published_at"),
        )
        await db.education_modules.update_one(
            {"_id": document["_id"]},
            {"$set": fields},
        )

    await db.app_migrations.update_one(
        {"_id": MIGRATION_ID},
        {"$set": {"completed_at": now, "updated_documents": len(documents)}},
        upsert=True,
    )
