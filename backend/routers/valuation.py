from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/valuation", tags=["valuation"])


class ValuationIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)


def register_valuation_routes(*, db, require_member):
    @router.post("")
    async def run_valuation(payload: ValuationIn, current_user: dict = Depends(require_member)):
        ticker = payload.ticker.strip().upper()
        await db.valuations.insert_one({
            "user_id": current_user["id"],
            "ticker": ticker,
            "status": "unavailable",
            "created_at": datetime.now(timezone.utc),
        })
        raise HTTPException(
            status_code=503,
            detail="Esta función está temporalmente no disponible.",
        )

    @router.get("/history")
    async def valuation_history(current_user: dict = Depends(require_member), limit: int = 20):
        docs = await (
            db.valuations.find({"user_id": current_user["id"]})
            .sort("created_at", -1)
            .limit(limit)
            .to_list(limit)
        )
        return [
            {
                "ticker": d.get("ticker"),
                "name": d.get("name"),
                "price": d.get("price"),
                "rating": d.get("rating"),
                "verdict": d.get("verdict"),
                "score_total": d.get("score_total"),
                "status": d.get("status"),
                "created_at": d["created_at"].isoformat() if hasattr(d.get("created_at"), "isoformat") else d.get("created_at"),
            }
            for d in docs
        ]

    return router
