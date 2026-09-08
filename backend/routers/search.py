"""Hampton Crest Academy — Search router.

First example of the routes/* modular structure. Other domains (auth, content,
members, billing, uploads) will progressively migrate to this layout.
"""
from __future__ import annotations

import asyncio
import re
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix="/api", tags=["search"])


def register_search_routes(*, db, require_member, serialize_doc):
    """Bind shared dependencies (db, auth, serializer) into the router.

    server.py keeps owning the singletons; this module only owns the route logic.
    """

    @router.get("/search")
    async def global_search(
        q: str = Query(..., min_length=1, max_length=200),
        limit: int = Query(8, ge=1, le=30),
        current_user: dict = Depends(require_member),
    ):
        """Global search across books, research, education, reports, companies."""
        regex = {"$regex": re.escape(q.strip()), "$options": "i"}
        is_admin = current_user.get("role") == "admin"
        status_filter: dict = {} if is_admin else {"status": "published"}

        async def search_collection(coll: str, fields: list[str], extra: dict | None = None):
            or_clauses = [{f: regex} for f in fields]
            query: dict = {"$or": or_clauses}
            query.update(status_filter)
            if extra:
                query.update(extra)
            docs = await db[coll].find(query).limit(limit).to_list(limit)
            return [serialize_doc(d) for d in docs]

        async def search_companies():
            company_query: dict = {"$or": [
                {"name": regex},
                {"ticker": regex},
                {"sector": regex},
                {"thesis_summary": regex},
            ]}
            if not is_admin:
                company_query["status"] = {"$in": ["covered", "watching"]}
            docs = await db.companies.find(company_query).limit(limit).to_list(limit)
            return [serialize_doc(d) for d in docs]

        books, research, education, reports, companies = await asyncio.gather(
            search_collection("books", ["title", "author", "description", "category"]),
            search_collection("research_notes", ["title", "summary", "body", "tags"]),
            search_collection("education_modules", ["title", "summary", "body", "track"]),
            search_collection("monthly_reports", ["title", "summary", "body", "period"]),
            search_companies(),
        )

        total = len(books) + len(research) + len(education) + len(reports) + len(companies)
        return {
            "query": q,
            "total": total,
            "books": books,
            "research": research,
            "education": education,
            "reports": reports,
            "companies": companies,
        }

    return router
