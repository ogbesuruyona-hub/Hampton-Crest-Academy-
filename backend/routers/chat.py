"""Hampton Crest Academy — AI Chat Support router.

Backend for the in-app chat assistant. The production app must not depend on
private Emergent packages; if an official AI provider is not configured, the
endpoint responds gracefully instead of breaking backend startup.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/chat", tags=["chat"])

MAX_HISTORY = 30


class ChatMessageIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session_id: str | None = None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def register_chat_routes(*, db, require_member):
    @router.post("")
    async def send_chat_message(
        payload: ChatMessageIn,
        current_user: dict = Depends(require_member),
    ):
        user_id = current_user["id"]
        session_id = payload.session_id or str(uuid.uuid4())

        await db.chat_messages.insert_one({
            "user_id": user_id,
            "session_id": session_id,
            "role": "user",
            "content": payload.message,
            "created_at": now_utc(),
        })

        raise HTTPException(
            status_code=503,
            detail=(
                "El asistente de inteligencia artificial está temporalmente no disponible. "
                "La academia continúa funcionando normalmente; intenta nuevamente más tarde."
            ),
        )

    @router.get("/history")
    async def history(
        session_id: str,
        current_user: dict = Depends(require_member),
    ):
        docs = await (
            db.chat_messages
            .find({"user_id": current_user["id"], "session_id": session_id, "role": {"$in": ["user", "assistant"]}})
            .sort("created_at", 1)
            .limit(MAX_HISTORY * 2)
            .to_list(MAX_HISTORY * 2)
        )
        return [
            {
                "id": str(d["_id"]) if isinstance(d.get("_id"), ObjectId) else d.get("_id"),
                "role": d["role"],
                "content": d["content"],
                "created_at": d["created_at"].isoformat() if isinstance(d.get("created_at"), datetime) else d.get("created_at"),
            }
            for d in docs
        ]

    @router.delete("/history")
    async def clear_history(
        session_id: str,
        current_user: dict = Depends(require_member),
    ):
        await db.chat_messages.delete_many({
            "user_id": current_user["id"],
            "session_id": session_id,
        })
        return {"ok": True}

    return router
