from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, Annotated, List

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, BeforeValidator, ConfigDict


# ---------------- Setup ----------------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRES_MINUTES = 60 * 24  # 24h

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Hampton Crest Academy API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CONTENT_COLLECTIONS = {
    "research": "research_notes",
    "education": "education_modules",
    "reports": "monthly_reports",
    "companies": "companies",
}


# ---------------- Helpers ----------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_EXPIRES_MINUTES),
        "iat": now_utc(),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def _serialize_value(v):
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, ObjectId):
        return str(v)
    return v


def serialize_doc(doc: Optional[dict]) -> Optional[dict]:
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["id"] = str(v)
            continue
        if isinstance(v, list):
            out[k] = [
                {ik: _serialize_value(iv) for ik, iv in item.items()} if isinstance(item, dict) else _serialize_value(item)
                for item in v
            ]
        else:
            out[k] = _serialize_value(v)
    out.pop("password_hash", None)
    return out


def serialize_user(doc: dict) -> dict:
    out = serialize_doc(doc) or {}
    return out


def _validate_object_id(v):
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str):
        return v
    raise ValueError("Invalid ObjectId")


PyObjectId = Annotated[str, BeforeValidator(_validate_object_id)]

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    token: Optional[str] = None
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return serialize_user(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return current_user


# ---------------- Auth models & routes ----------------
class UserPublic(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: PyObjectId = Field(validation_alias="_id")
    email: EmailStr
    name: str
    role: str = "member"
    created_at: Optional[datetime] = None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


@api_router.get("/")
async def root():
    return {"service": "Hampton Crest Academy", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "ok", "time": now_utc().isoformat()}


@api_router.post("/auth/register", response_model=AuthResponse)
async def register(payload: RegisterRequest):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}) is not None:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name.strip(),
        "role": "member",
        "created_at": now_utc(),
    }
    result = await db.users.insert_one(doc)
    user_id = str(result.inserted_id)
    token = create_access_token(user_id, email)
    user_doc = {**doc, "_id": result.inserted_id}
    return AuthResponse(access_token=token, user=UserPublic(**serialize_user(user_doc)))


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(str(user["_id"]), email)
    return AuthResponse(access_token=token, user=UserPublic(**serialize_user(user)))


@api_router.get("/auth/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    return UserPublic(**current_user)


@api_router.post("/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return {"ok": True}


# ---------------- Content models ----------------
class ResearchIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    summary: Optional[str] = ""
    body: str = ""
    category: Optional[str] = None
    tags: List[str] = []
    status: str = Field(default="draft", pattern="^(draft|published)$")


class EducationIn(ResearchIn):
    track: Optional[str] = None
    week_count: Optional[int] = None
    order_index: int = 0


class ReportIn(ResearchIn):
    period: str = Field(pattern="^\\d{4}-(0[1-9]|1[0-2])$")  # YYYY-MM


class KeyMetric(BaseModel):
    label: str
    value: str


class CompanyIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=12)
    name: str = Field(min_length=1, max_length=200)
    sector: Optional[str] = None
    status: str = Field(default="covered", pattern="^(covered|watching|exited)$")
    thesis_summary: Optional[str] = ""
    thesis_body: str = ""
    key_metrics: List[KeyMetric] = []
    tags: List[str] = []


class MemoIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)


class BookmarkIn(BaseModel):
    content_type: str = Field(pattern="^(research|education|reports|companies)$")
    content_id: str


# ---------------- Content helpers ----------------
def _author_stub(user: dict) -> dict:
    return {"author_id": user.get("id") or user.get("_id"), "author_name": user.get("name", "")}


def _published_filter(current_user: dict, status: Optional[str]) -> dict:
    """Members only see published content; admins can filter or see all."""
    if current_user.get("role") == "admin":
        return {"status": status} if status else {}
    return {"status": "published"}


def _apply_search(query: dict, q: Optional[str], fields: List[str]):
    if q:
        regex = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{f: regex} for f in fields]


async def _list_generic(collection: str, current_user: dict, status, category, tag, q, search_fields, sort_field="created_at"):
    query = _published_filter(current_user, status)
    if category:
        query["category"] = category
    if tag:
        query["tags"] = tag
    _apply_search(query, q, search_fields)
    cursor = db[collection].find(query).sort(sort_field, -1).limit(200)
    docs = await cursor.to_list(200)
    return [serialize_doc(d) for d in docs]


async def _get_or_404(collection: str, content_id: str, current_user: dict):
    doc = await db[collection].find_one({"_id": content_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if current_user.get("role") != "admin" and doc.get("status") != "published":
        raise HTTPException(status_code=404, detail="Not found")
    return doc


def _build_content_doc(payload_dict: dict, user: dict) -> dict:
    is_published = payload_dict.get("status") == "published"
    return {
        "_id": new_id(),
        **payload_dict,
        **_author_stub(user),
        "created_at": now_utc(),
        "updated_at": now_utc(),
        "published_at": now_utc() if is_published else None,
    }


def _patch_update(update: dict, payload_dict: dict, existing: dict) -> dict:
    update.update(payload_dict)
    update["updated_at"] = now_utc()
    new_status = payload_dict.get("status", existing.get("status"))
    if new_status == "published" and not existing.get("published_at"):
        update["published_at"] = now_utc()
    return update


# ---------------- Research ----------------
@api_router.get("/research")
async def list_research(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    q: Optional[str] = None,
):
    return await _list_generic("research_notes", current_user, status, category, tag, q, ["title", "summary", "body"])


@api_router.get("/research/{content_id}")
async def get_research(content_id: str, current_user: dict = Depends(get_current_user)):
    doc = await _get_or_404("research_notes", content_id, current_user)
    return serialize_doc(doc)


@api_router.post("/research")
async def create_research(payload: ResearchIn, current_user: dict = Depends(require_admin)):
    doc = _build_content_doc(payload.model_dump(), current_user)
    await db.research_notes.insert_one(doc)
    return serialize_doc(doc)


@api_router.put("/research/{content_id}")
async def update_research(content_id: str, payload: ResearchIn, current_user: dict = Depends(require_admin)):
    existing = await db.research_notes.find_one({"_id": content_id})
    if not existing:
        raise HTTPException(404, "Not found")
    update = _patch_update({}, payload.model_dump(), existing)
    await db.research_notes.update_one({"_id": content_id}, {"$set": update})
    return serialize_doc({**existing, **update})


@api_router.delete("/research/{content_id}")
async def delete_research(content_id: str, current_user: dict = Depends(require_admin)):
    await db.research_notes.delete_one({"_id": content_id})
    return {"ok": True}


# ---------------- Education ----------------
@api_router.get("/education")
async def list_education(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    q: Optional[str] = None,
):
    query = _published_filter(current_user, status)
    if category:
        query["category"] = category
    if tag:
        query["tags"] = tag
    _apply_search(query, q, ["title", "summary", "body", "track"])
    docs = await db.education_modules.find(query).sort([("order_index", 1), ("created_at", -1)]).limit(200).to_list(200)
    return [serialize_doc(d) for d in docs]


@api_router.get("/education/{content_id}")
async def get_education(content_id: str, current_user: dict = Depends(get_current_user)):
    doc = await _get_or_404("education_modules", content_id, current_user)
    return serialize_doc(doc)


@api_router.post("/education")
async def create_education(payload: EducationIn, current_user: dict = Depends(require_admin)):
    doc = _build_content_doc(payload.model_dump(), current_user)
    await db.education_modules.insert_one(doc)
    return serialize_doc(doc)


@api_router.put("/education/{content_id}")
async def update_education(content_id: str, payload: EducationIn, current_user: dict = Depends(require_admin)):
    existing = await db.education_modules.find_one({"_id": content_id})
    if not existing:
        raise HTTPException(404, "Not found")
    update = _patch_update({}, payload.model_dump(), existing)
    await db.education_modules.update_one({"_id": content_id}, {"$set": update})
    return serialize_doc({**existing, **update})


@api_router.delete("/education/{content_id}")
async def delete_education(content_id: str, current_user: dict = Depends(require_admin)):
    await db.education_modules.delete_one({"_id": content_id})
    return {"ok": True}


# ---------------- Monthly reports ----------------
@api_router.get("/reports")
async def list_reports(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    year: Optional[str] = None,
    q: Optional[str] = None,
):
    query = _published_filter(current_user, status)
    if year:
        query["period"] = {"$regex": f"^{re.escape(year)}-"}
    _apply_search(query, q, ["title", "summary", "body"])
    docs = await db.monthly_reports.find(query).sort([("period", -1), ("created_at", -1)]).limit(200).to_list(200)
    return [serialize_doc(d) for d in docs]


@api_router.get("/reports/{content_id}")
async def get_report(content_id: str, current_user: dict = Depends(get_current_user)):
    doc = await _get_or_404("monthly_reports", content_id, current_user)
    return serialize_doc(doc)


@api_router.post("/reports")
async def create_report(payload: ReportIn, current_user: dict = Depends(require_admin)):
    doc = _build_content_doc(payload.model_dump(), current_user)
    await db.monthly_reports.insert_one(doc)
    return serialize_doc(doc)


@api_router.put("/reports/{content_id}")
async def update_report(content_id: str, payload: ReportIn, current_user: dict = Depends(require_admin)):
    existing = await db.monthly_reports.find_one({"_id": content_id})
    if not existing:
        raise HTTPException(404, "Not found")
    update = _patch_update({}, payload.model_dump(), existing)
    await db.monthly_reports.update_one({"_id": content_id}, {"$set": update})
    return serialize_doc({**existing, **update})


@api_router.delete("/reports/{content_id}")
async def delete_report(content_id: str, current_user: dict = Depends(require_admin)):
    await db.monthly_reports.delete_one({"_id": content_id})
    return {"ok": True}


# ---------------- Companies ----------------
@api_router.get("/companies")
async def list_companies(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    sector: Optional[str] = None,
    q: Optional[str] = None,
):
    query: dict = {}
    if current_user.get("role") != "admin":
        # for companies, "status" is covered/watching/exited (not draft/published)
        # all are visible to members
        pass
    if status:
        query["status"] = status
    if sector:
        query["sector"] = sector
    _apply_search(query, q, ["ticker", "name", "thesis_summary"])
    docs = await db.companies.find(query).sort("ticker", 1).limit(500).to_list(500)
    # Hide memos in list response (keep response light)
    cleaned = []
    for d in docs:
        s = serialize_doc(d)
        if s and "memos" in s:
            s["memo_count"] = len(s["memos"])
            s.pop("memos", None)
        cleaned.append(s)
    return cleaned


@api_router.get("/companies/{company_id}")
async def get_company(company_id: str, current_user: dict = Depends(get_current_user)):
    doc = await db.companies.find_one({"_id": company_id})
    if not doc:
        raise HTTPException(404, "Not found")
    return serialize_doc(doc)


@api_router.post("/companies")
async def create_company(payload: CompanyIn, current_user: dict = Depends(require_admin)):
    data = payload.model_dump()
    data["ticker"] = data["ticker"].upper().strip()
    doc = {
        "_id": new_id(),
        **data,
        "memos": [],
        **_author_stub(current_user),
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.companies.insert_one(doc)
    return serialize_doc(doc)


@api_router.put("/companies/{company_id}")
async def update_company(company_id: str, payload: CompanyIn, current_user: dict = Depends(require_admin)):
    existing = await db.companies.find_one({"_id": company_id})
    if not existing:
        raise HTTPException(404, "Not found")
    data = payload.model_dump()
    data["ticker"] = data["ticker"].upper().strip()
    data["updated_at"] = now_utc()
    await db.companies.update_one({"_id": company_id}, {"$set": data})
    return serialize_doc({**existing, **data})


@api_router.delete("/companies/{company_id}")
async def delete_company(company_id: str, current_user: dict = Depends(require_admin)):
    await db.companies.delete_one({"_id": company_id})
    return {"ok": True}


@api_router.post("/companies/{company_id}/memos")
async def add_company_memo(company_id: str, payload: MemoIn, current_user: dict = Depends(require_admin)):
    memo = {
        "id": new_id(),
        "title": payload.title.strip(),
        "body": payload.body.strip(),
        **_author_stub(current_user),
        "created_at": now_utc(),
    }
    result = await db.companies.update_one(
        {"_id": company_id},
        {"$push": {"memos": {"$each": [memo], "$position": 0}}, "$set": {"updated_at": now_utc()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Company not found")
    return {**memo, "created_at": memo["created_at"].isoformat()}


@api_router.delete("/companies/{company_id}/memos/{memo_id}")
async def delete_company_memo(company_id: str, memo_id: str, current_user: dict = Depends(require_admin)):
    result = await db.companies.update_one(
        {"_id": company_id},
        {"$pull": {"memos": {"id": memo_id}}, "$set": {"updated_at": now_utc()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Company not found")
    return {"ok": True}


# ---------------- Bookmarks ----------------
@api_router.get("/bookmarks")
async def list_bookmarks(current_user: dict = Depends(get_current_user)):
    bms = await db.bookmarks.find({"user_id": current_user["id"]}).sort("created_at", -1).limit(500).to_list(500)
    result = []
    for bm in bms:
        coll = CONTENT_COLLECTIONS.get(bm["content_type"])
        if not coll:
            continue
        item = await db[coll].find_one({"_id": bm["content_id"]})
        if not item:
            # orphan — skip
            continue
        if current_user.get("role") != "admin" and bm["content_type"] != "companies" and item.get("status") != "published":
            continue
        result.append({
            "bookmark_id": str(bm["_id"]),
            "content_type": bm["content_type"],
            "saved_at": bm["created_at"].isoformat() if isinstance(bm["created_at"], datetime) else bm["created_at"],
            "content": serialize_doc(item),
        })
    return result


@api_router.get("/bookmarks/check")
async def check_bookmark(
    content_type: str = Query(..., pattern="^(research|education|reports|companies)$"),
    content_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    bm = await db.bookmarks.find_one({
        "user_id": current_user["id"],
        "content_type": content_type,
        "content_id": content_id,
    })
    return {"bookmarked": bm is not None}


@api_router.post("/bookmarks")
async def add_bookmark(payload: BookmarkIn, current_user: dict = Depends(get_current_user)):
    coll = CONTENT_COLLECTIONS[payload.content_type]
    if not await db[coll].find_one({"_id": payload.content_id}):
        raise HTTPException(404, "Content not found")
    existing = await db.bookmarks.find_one({
        "user_id": current_user["id"],
        "content_type": payload.content_type,
        "content_id": payload.content_id,
    })
    if existing:
        return {"bookmarked": True}
    await db.bookmarks.insert_one({
        "_id": new_id(),
        "user_id": current_user["id"],
        "content_type": payload.content_type,
        "content_id": payload.content_id,
        "created_at": now_utc(),
    })
    return {"bookmarked": True}


@api_router.delete("/bookmarks")
async def remove_bookmark(
    content_type: str = Query(..., pattern="^(research|education|reports|companies)$"),
    content_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    await db.bookmarks.delete_one({
        "user_id": current_user["id"],
        "content_type": content_type,
        "content_id": content_id,
    })
    return {"bookmarked": False}


# ---------------- Lifecycle ----------------
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@hamptoncrest.com").lower().strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Hampton#2026")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Hampton Crest Admin",
            "role": "admin",
            "created_at": now_utc(),
        })
        logger.info("Seeded admin user %s", admin_email)
    else:
        if not verify_password(admin_password, existing.get("password_hash", "")):
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"password_hash": hash_password(admin_password)}},
            )
            logger.info("Updated admin password for %s", admin_email)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.research_notes.create_index([("status", 1), ("created_at", -1)])
    await db.education_modules.create_index([("status", 1), ("order_index", 1)])
    await db.monthly_reports.create_index([("period", -1)])
    await db.companies.create_index("ticker", unique=True)
    await db.bookmarks.create_index([("user_id", 1), ("content_type", 1), ("content_id", 1)], unique=True)
    await seed_admin()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ---------------- App wiring ----------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
