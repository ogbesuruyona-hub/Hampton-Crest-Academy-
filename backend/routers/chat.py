"""Hampton Crest Academy - AI Chat Support router."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/chat", tags=["chat"])

SYSTEM_PROMPT = (
    "Eres el asistente discreto de Hampton Crest Academy, una academia privada "
    "de inversión reservada para miembros. Responde siempre en español, con un "
    "tono institucional, sobrio y profesional. No uses emojis ni jerga. Tus áreas "
    "de ayuda son navegación de la academia, conceptos financieros generales, "
    "recomendaciones de lectura y preguntas operativas sobre la membresía. "
    "Nunca des consejo financiero personalizado ni recomendaciones específicas de compra. "
    "Sé conciso: 1-3 párrafos máximo a menos que el usuario pida profundidad."
)

MAX_HISTORY = 30
UNAVAILABLE_MESSAGE = (
    "El chat con IA está temporalmente no disponible. El equipo de Hampton Crest "
    "está revisando la configuración del asistente. Mientras tanto, puedes usar "
    "la biblioteca, las rutas de educación, los reportes y el análisis de compañías."
)


class ChatMessageIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session_id: str | None = None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _public_message(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]) if isinstance(doc.get("_id"), ObjectId) else doc.get("_id"),
        "role": doc["role"],
        "content": doc["content"],
        "created_at": doc["created_at"].isoformat() if isinstance(doc.get("created_at"), datetime) else doc.get("created_at"),
    }


def register_chat_routes(*, db, require_member):
    api_key = os.environ.get("OPENAI_API_KEY", "")
    model_name = os.environ.get("CHAT_MODEL", "gpt-4o")
    client = AsyncOpenAI(api_key=api_key) if api_key else None

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

        if client is None:
            assistant_doc = {
                "user_id": user_id,
                "session_id": session_id,
                "role": "assistant",
                "content": UNAVAILABLE_MESSAGE,
                "created_at": now_utc(),
            }
            await db.chat_messages.insert_one(assistant_doc)
            return {
                "session_id": session_id,
                "reply": UNAVAILABLE_MESSAGE,
                "created_at": assistant_doc["created_at"].isoformat(),
            }

        history_docs = await (
            db.chat_messages
            .find({"user_id": user_id, "session_id": session_id, "role": {"$in": ["user", "assistant"]}})
            .sort("created_at", -1)
            .limit(MAX_HISTORY * 2)
            .to_list(MAX_HISTORY * 2)
        )
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for doc in reversed(history_docs):
            messages.append({"role": doc["role"], "content": doc["content"]})

        try:
            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0.4,
            )
            reply_text = response.choices[0].message.content or UNAVAILABLE_MESSAGE
        except Exception as e:  # noqa: BLE001
            await db.chat_messages.insert_one({
                "user_id": user_id,
                "session_id": session_id,
                "role": "system",
                "content": f"error: {e!s}",
                "created_at": now_utc(),
            })
            raise HTTPException(502, "El asistente no pudo responder. Intenta de nuevo.")

        assistant_doc = {
            "user_id": user_id,
            "session_id": session_id,
            "role": "assistant",
            "content": reply_text,
            "created_at": now_utc(),
        }
        await db.chat_messages.insert_one(assistant_doc)

        return {
            "session_id": session_id,
            "reply": reply_text,
            "created_at": assistant_doc["created_at"].isoformat(),
        }

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
        return [_public_message(d) for d in docs]

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
