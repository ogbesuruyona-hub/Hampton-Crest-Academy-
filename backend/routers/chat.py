"""Hampton Crest Academy — AI Chat Support router.

Backend for the in-app GPT-4o chat assistant. Uses the Emergent Universal Key
via the `emergentintegrations` library. Conversation history is persisted in
the `chat_messages` collection so the assistant has memory across messages
within a session.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage

router = APIRouter(prefix="/api/chat", tags=["chat"])

SYSTEM_PROMPT = (
    "Eres el asistente discreto de Hampton Crest Academy, una academia privada "
    "de inversión reservada para miembros. Responde siempre en español, con un "
    "tono institucional, sobrio y profesional — sin emojis ni jerga. Tus áreas "
    "de ayuda son:\n"
    "- Navegación de la academia (biblioteca, módulos de educación, reportes "
    "mensuales, análisis de empresas, perfil del miembro).\n"
    "- Conceptos financieros generales (value investing, ciclos macro, "
    "construcción de cartera, disciplina conductual, historia de mercados).\n"
    "- Recomendaciones de lectura del corpus clásico de inversión.\n"
    "- Preguntas operativas sobre la membresía (cómo actualizar el método de "
    "pago, cómo cancelar, cómo activar 2FA).\n\n"
    "Cuando un miembro pregunte sobre cancelación o cambios de pago, indícale "
    "que puede gestionarlo desde Ajustes → Facturación → Administrar suscripción.\n"
    "Cuando pidan recomendaciones de libros, sugiere de la tradición de Howard "
    "Marks, Seth Klarman, Charlie Munger, Peter Bernstein, Warren Buffett, "
    "Ray Dalio y autores afines.\n"
    "Nunca des consejo financiero personalizado, recomendaciones de compra "
    "específicas, ni accedas a datos privados de otros miembros. Si te piden "
    "algo fuera de tu alcance, explícalo con cortesía.\n"
    "Sé conciso: 1-3 párrafos máximo a menos que el usuario pida profundidad."
)

MAX_HISTORY = 30  # turns we replay back into the model


class ChatMessageIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session_id: str | None = None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def register_chat_routes(*, db, require_member):
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    model_provider = os.environ.get("CHAT_PROVIDER", "openai")
    model_name = os.environ.get("CHAT_MODEL", "gpt-4o")

    @router.post("")
    async def send_chat_message(
        payload: ChatMessageIn,
        current_user: dict = Depends(require_member),
    ):
        if not api_key:
            raise HTTPException(503, "El asistente no está disponible. Falta configuración.")

        user_id = current_user["id"]
        session_id = payload.session_id or str(uuid.uuid4())

        # Persist user message
        user_doc = {
            "user_id": user_id,
            "session_id": session_id,
            "role": "user",
            "content": payload.message,
            "created_at": now_utc(),
        }
        await db.chat_messages.insert_one(user_doc)

        # Build the chat client (per-message instance — replay history for context)
        try:
            chat = LlmChat(
                api_key=api_key,
                session_id=session_id,
                system_message=SYSTEM_PROMPT,
            ).with_model(model_provider, model_name)

            reply_text = await chat.send_message(UserMessage(text=payload.message))
        except Exception as e:  # noqa: BLE001
            await db.chat_messages.insert_one({
                "user_id": user_id,
                "session_id": session_id,
                "role": "system",
                "content": f"error: {e!s}",
                "created_at": now_utc(),
            })
            raise HTTPException(502, "El asistente no pudo responder. Intenta de nuevo.")

        # Persist assistant reply
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
