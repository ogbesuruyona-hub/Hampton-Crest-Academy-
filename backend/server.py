from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import re
import io
import base64
import asyncio
import hashlib
import secrets
import json
import ipaddress
import socket
from datetime import datetime, timezone, timedelta
from typing import Optional, Annotated, List
from urllib.parse import urljoin, urlparse

import bcrypt
import jwt
import pyotp
import qrcode
import requests
import resend
import stripe
from bs4 import BeautifulSoup
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from fastapi import (
    FastAPI, APIRouter, HTTPException, Depends, Request, Query,
    UploadFile, File, BackgroundTasks, Response,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, BeforeValidator, ConfigDict


# ---------------- Setup ----------------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRES_MINUTES = 60  # 1h
PENDING_2FA_TOKEN_EXPIRES_MINUTES = 5
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
PDF_MAX_BYTES = 25 * 1024 * 1024  # 25 MB
IMAGE_MAX_BYTES = 5 * 1024 * 1024  # 5 MB

mongo_url = os.environ.get("MONGO_URL", "").strip()
db_name = os.environ.get("DB_NAME", "").strip()
client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000) if mongo_url else None
db = client[db_name] if client is not None and db_name else None

app = FastAPI(title="Hampton Crest Academy API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CONTENT_COLLECTIONS = {
    "research": "research_notes",
    "education": "education_modules",
    "reports": "monthly_reports",
    "companies": "companies",
    "books": "books",
}

# Resend init
resend.api_key = os.environ.get("RESEND_API_KEY", "")

# Stripe init
stripe.api_key = os.environ.get("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
FRAMER_URL = os.environ.get("FRAMER_URL", "")
PAYMENT_LINK_URL = os.environ.get("PAYMENT_LINK_URL", "")
MEMBERSHIP_PRICE_DISPLAY = os.environ.get("MEMBERSHIP_PRICE_DISPLAY", "").strip()
MEMBERSHIP_BILLING_INTERVAL = os.environ.get("MEMBERSHIP_BILLING_INTERVAL", "").strip()
SUPPORT_EMAIL = os.environ.get("SUPPORT_EMAIL", "members@investorhamptoncrest.com").strip()
OPS_ALERT_EMAIL = os.environ.get("OPS_ALERT_EMAIL", "").strip()
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() != "false"
ALLOW_PUBLIC_REGISTRATION = os.environ.get("ALLOW_PUBLIC_REGISTRATION", "false").lower() == "true"
try:
    PAYMENT_GRACE_DAYS = max(0, min(30, int(os.environ.get("PAYMENT_GRACE_DAYS", "5"))))
except ValueError:
    PAYMENT_GRACE_DAYS = 5
INVITE_TOKEN_TTL_DAYS = 7
MEMBERSHIP_PENDING = "pending"
MEMBERSHIP_ACTIVE = "active"
MEMBERSHIP_PAST_DUE = "past_due"
MEMBERSHIP_CANCELED = "canceled"
MEMBERSHIP_EXPIRED = "expired"
MEMBERSHIP_STATES = {
    MEMBERSHIP_PENDING,
    MEMBERSHIP_ACTIVE,
    MEMBERSHIP_PAST_DUE,
    MEMBERSHIP_CANCELED,
    MEMBERSHIP_EXPIRED,
}

# Object storage config
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = os.environ.get("APP_NAME", "hampton-crest")
_storage_key: Optional[str] = None
_runtime_bootstrap_done = False
_runtime_bootstrap_error: Optional[str] = None
_runtime_bootstrap_lock = asyncio.Lock()


# ---------------- Helpers: time/ids ----------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Mongo BSON datetimes come back tz-naive; coerce to UTC for safe comparisons."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def new_id() -> str:
    return uuid.uuid4().hex


def ensure_database_configured():
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not configured. Set MONGO_URL and DB_NAME.",
        )


# ---------------- Helpers: passwords / JWT ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (TypeError, ValueError):
        return False


def get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET", "")
    if len(secret) < 32:
        raise RuntimeError("JWT_SECRET must contain at least 32 characters")
    return secret


def create_access_token(user_id: str, email: str) -> str:
    return jwt.encode(
        {
            "sub": user_id, "email": email, "type": "access",
            "iat": now_utc(),
            "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_EXPIRES_MINUTES),
        },
        get_jwt_secret(), algorithm=JWT_ALGORITHM,
    )


def create_pending_2fa_token(user_id: str, email: str) -> str:
    return jwt.encode(
        {
            "sub": user_id, "email": email, "type": "2fa_pending",
            "iat": now_utc(),
            "exp": now_utc() + timedelta(minutes=PENDING_2FA_TOKEN_EXPIRES_MINUTES),
        },
        get_jwt_secret(), algorithm=JWT_ALGORITHM,
    )


def set_auth_cookies(response: Response, token: str):
    csrf_token = secrets.token_urlsafe(32)
    cookie_options = {
        "secure": COOKIE_SECURE,
        "samesite": "lax",
        "path": "/",
        "max_age": ACCESS_TOKEN_EXPIRES_MINUTES * 60,
    }
    response.set_cookie("hc_access_token", token, httponly=True, **cookie_options)
    response.set_cookie("hc_csrf_token", csrf_token, httponly=False, **cookie_options)


def clear_auth_cookies(response: Response):
    response.delete_cookie("hc_access_token", path="/", secure=COOKIE_SECURE, samesite="lax")
    response.delete_cookie("hc_csrf_token", path="/", secure=COOKIE_SECURE, samesite="lax")


# ---------------- Helpers: serialization ----------------
def _serialize_value(v):
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, ObjectId):
        return str(v)
    return v


_REDACTED_KEYS = {"password_hash", "totp_secret", "totp_secret_pending", "backup_codes_hashed"}


def serialize_doc(doc: Optional[dict]) -> Optional[dict]:
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k in _REDACTED_KEYS:
            continue
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
    return out


def serialize_user(doc: dict) -> dict:
    out = serialize_doc(doc) or {}
    if doc:
        out["has_access"] = has_access(doc)
        out["requires_2fa_setup"] = doc.get("role") == "admin" and not bool(doc.get("totp_enabled"))
    return out


# ---------------- Auth dependencies ----------------
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
    ensure_database_configured()
    token: Optional[str] = None
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials
    if not token:
        token = request.cookies.get("hc_access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user = await refresh_membership_state(user)
        return serialize_user(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    if not current_user.get("totp_enabled"):
        raise HTTPException(status_code=403, detail="admin_2fa_required")
    return current_user


# ---------------- Helpers: brute-force ----------------
def _attempts_id(request: Request, email: str) -> str:
    # Email-only key (the previous IP+email key was unreliable behind ingress proxies)
    return f"login:{email.lower().strip()}"


async def check_lockout(request: Request, email: str):
    rec = await db.login_attempts.find_one({"_id": _attempts_id(request, email)})
    if not rec:
        return
    locked_until = ensure_utc(rec.get("locked_until"))
    if locked_until and locked_until > now_utc():
        remaining = int((locked_until - now_utc()).total_seconds() // 60) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {remaining} minute(s).",
        )


async def record_failure(request: Request, email: str):
    ident = _attempts_id(request, email)
    rec = await db.login_attempts.find_one({"_id": ident})
    attempts = (rec.get("attempts") if rec else 0) + 1
    update = {"attempts": attempts, "last_attempt": now_utc()}
    if attempts >= MAX_FAILED_ATTEMPTS:
        update["locked_until"] = now_utc() + timedelta(minutes=LOCKOUT_MINUTES)
    await db.login_attempts.update_one({"_id": ident}, {"$set": update}, upsert=True)


async def clear_attempts(request: Request, email: str):
    await db.login_attempts.delete_one({"_id": _attempts_id(request, email)})


def _request_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    return request.headers.get("x-real-ip", "").strip() or forwarded or (request.client.host if request.client else "unknown")


async def check_api_rate_limit(request: Request, scope: str, *, limit: int, window_seconds: int):
    window = int(now_utc().timestamp()) // window_seconds
    ip_digest = hashlib.sha256(_request_ip(request).encode("utf-8")).hexdigest()[:24]
    ident = f"{scope}:{ip_digest}:{window}"
    expires_at = now_utc() + timedelta(seconds=window_seconds * 2)
    await db.api_rate_limits.update_one(
        {"_id": ident},
        {
            "$inc": {"count": 1},
            "$setOnInsert": {"scope": scope, "expires_at": expires_at, "created_at": now_utc()},
        },
        upsert=True,
    )
    record = await db.api_rate_limits.find_one({"_id": ident}, {"count": 1}) or {}
    if int(record.get("count", 0)) > limit:
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")


# ---------------- Helpers: 2FA ----------------
def _hash_backup_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _generate_backup_codes(n: int = 10) -> List[str]:
    return [f"{secrets.token_hex(4)}-{secrets.token_hex(4)}" for _ in range(n)]


def _build_totp_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="Hampton Crest Academy")


def _qr_png_base64(uri: str) -> str:
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _verify_totp_or_backup(user: dict, code: str) -> bool:
    code = (code or "").strip().replace(" ", "")
    secret = user.get("totp_secret")
    if secret and pyotp.TOTP(secret).verify(code, valid_window=1):
        return True
    hashed = _hash_backup_code(code)
    backup = user.get("backup_codes_hashed") or []
    if hashed in backup:
        # consume the code
        return True
    return False


async def _consume_backup_code_if_used(user_id: str, code: str):
    hashed = _hash_backup_code((code or "").strip().replace(" ", ""))
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$pull": {"backup_codes_hashed": hashed}})


# ---------------- Helpers: storage ----------------
def _init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not key:
        logger.warning("EMERGENT_LLM_KEY not set; object storage disabled")
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": key}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        logger.info("Object storage initialised")
        return _storage_key
    except Exception as e:
        logger.error("Storage init failed: %s", e)
        return None


def _put_object_sync(path: str, data: bytes, content_type: str) -> dict:
    key = _init_storage()
    if not key:
        raise RuntimeError("Storage not initialised")
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    r.raise_for_status()
    return r.json()


def _get_object_sync(path: str) -> tuple[bytes, str]:
    key = _init_storage()
    if not key:
        raise RuntimeError("Storage not initialised")
    r = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    return await asyncio.to_thread(_put_object_sync, path, data, content_type)


async def get_object(path: str) -> tuple[bytes, str]:
    return await asyncio.to_thread(_get_object_sync, path)


# ---------------- Helpers: email ----------------
DEFAULT_PUBLIC_URL = "https://academy.hamptoncrestcapital.com"
PUBLIC_URL = os.environ.get("APP_PUBLIC_URL", "").strip().rstrip("/") or DEFAULT_PUBLIC_URL


def _digest_html(*, title: str, summary: str, category: Optional[str], content_type_label: str, link: str) -> str:
    summary_html = (summary or "").replace("<", "&lt;").replace(">", "&gt;")
    cat_html = f'<span style="color:#9aa4b6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">{category}</span>' if category else ""
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#050914;font-family:Helvetica,Arial,sans-serif;color:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050914;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0c1222;border:1px solid #212a3f;">
        <tr><td style="padding:32px 36px 8px 36px;text-align:left;">
          <div style="color:#d4af37;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;font-weight:600;">Hampton Crest</div>
          <div style="color:#5b667a;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;margin-top:2px;">Academy</div>
        </td></tr>
        <tr><td style="padding:24px 36px 0 36px;">
          <div style="height:1px;background:linear-gradient(to right,transparent,#d4af37,transparent);opacity:0.6;"></div>
        </td></tr>
        <tr><td style="padding:28px 36px 8px 36px;">
          <div style="color:#9aa4b6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:12px;">{content_type_label}</div>
          {cat_html}
          <h1 style="margin:8px 0 16px 0;color:#f4f6f8;font-size:24px;line-height:1.2;font-weight:500;letter-spacing:-0.01em;">{title}</h1>
          <p style="color:#9aa4b6;font-size:14px;line-height:1.6;margin:0 0 24px 0;">{summary_html or 'A new piece has been added to the Hampton Crest members suite.'}</p>
        </td></tr>
        <tr><td style="padding:0 36px 36px 36px;">
          <a href="{link}" style="display:inline-block;background:#e2e8f0;color:#050914;text-decoration:none;padding:12px 24px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;">Read on Hampton Crest</a>
        </td></tr>
        <tr><td style="padding:0 36px 36px 36px;border-top:1px solid #212a3f;">
          <p style="color:#5b667a;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;margin:24px 0 0 0;">Confidential · For Members Only</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def _send_email_sync(to: str, subject: str, html: str) -> Optional[dict]:
    if os.environ.get("EMAILS_ENABLED", "false").lower() != "true":
        logger.info("[email:disabled] to=%s subject=%s (EMAILS_ENABLED=false)", to, subject)
        return None
    if not resend.api_key:
        logger.info("[email:dry-run] to=%s subject=%s (no RESEND_API_KEY)", to, subject)
        return None
    sender_email = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    sender_name = os.environ.get("SENDER_NAME", "Hampton Crest Academy")
    params = {
        "from": f"{sender_name} <{sender_email}>",
        "to": [to],
        "subject": subject,
        "html": html,
    }
    try:
        logger.info(
            "[email:send-attempt] to=%s subject=%s sender=%s",
            to,
            subject,
            sender_email,
        )
        response = resend.Emails.send(params)
        logger.info("[email:resend-response] to=%s subject=%s response=%s", to, subject, response)
        return response
    except Exception as e:
        logger.exception("Resend send failed for %s: %s", to, e)
        return None


async def send_email(to: str, subject: str, html: str):
    return await asyncio.to_thread(_send_email_sync, to, subject, html)


async def _digest_recipients() -> List[str]:
    # All members opted-in (default True). Exclude admins to avoid noise unless they opt-in explicitly.
    cursor = db.users.find({"email_digest_opt_in": {"$ne": False}}, {"email": 1, "role": 1})
    out = []
    async for u in cursor:
        out.append(u["email"])
    return out


async def dispatch_content_digest(*, content_type: str, item: dict):
    """Fire-and-forget digest for newly-published content."""
    try:
        labels = {
            "research": "New Research Note",
            "education": "New Education Module",
            "reports": "New Monthly Report",
        }
        label = labels.get(content_type)
        if not label:
            return
        title = item.get("title", "Untitled")
        summary = item.get("summary", "") or ""
        category = item.get("category") or item.get("track") or None
        link = f"{PUBLIC_URL}/{content_type}/{item.get('id') or item.get('_id')}" if PUBLIC_URL else "#"
        subject = f"{label}: {title}"
        html = _digest_html(
            title=title, summary=summary, category=category,
            content_type_label=label, link=link,
        )
        recipients = await _digest_recipients()
        for r in recipients:
            await send_email(r, subject, html)
    except Exception as e:
        logger.error("digest dispatch failed: %s", e)


# ---------------- Auth models ----------------
class UserPublic(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: PyObjectId = Field(validation_alias="_id")
    email: EmailStr
    name: str
    role: str = "member"
    created_at: Optional[datetime] = None
    totp_enabled: bool = False
    email_digest_opt_in: bool = True
    membership_status: str = MEMBERSHIP_PENDING
    subscription_status: Optional[str] = None
    complimentary: bool = False
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    last_payment_status: Optional[str] = None
    last_payment_at: Optional[datetime] = None
    payment_failure_at: Optional[datetime] = None
    grace_period_end: Optional[datetime] = None
    next_payment_attempt: Optional[datetime] = None
    payment_attempt_count: int = 0
    membership_inactive_reason: Optional[str] = None
    has_access: bool = False
    requires_2fa_setup: bool = False
    phone: Optional[str] = None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserPublic] = None
    requires_2fa: bool = False
    temp_token: Optional[str] = None


class TwoFAVerify(BaseModel):
    temp_token: str
    code: str


class TwoFAVerifySetup(BaseModel):
    code: str


class TwoFADisable(BaseModel):
    password: str
    code: str


class EmailPrefsIn(BaseModel):
    email_digest_opt_in: bool


class ProfileUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=40)


# ---------------- Routes: root/health ----------------
@api_router.get("/")
async def root():
    return {"service": "Hampton Crest Academy", "status": "ok"}


@api_router.get("/health")
async def health():
    if db is None:
        raise HTTPException(status_code=503, detail="service_unavailable")
    try:
        await db.command("ping")
        if not _runtime_bootstrap_done:
            await runtime_bootstrap()
    except Exception:
        logger.exception("health check failed")
        raise HTTPException(status_code=503, detail="service_unavailable")
    if _runtime_bootstrap_error:
        raise HTTPException(status_code=503, detail="service_unavailable")
    return {"status": "ok", "time": now_utc().isoformat()}


# ---------------- Routes: auth ----------------
@api_router.post("/auth/register", response_model=AuthResponse)
async def register(payload: RegisterRequest, response: Response, request: Request):
    if not ALLOW_PUBLIC_REGISTRATION:
        raise HTTPException(status_code=404, detail="Not found")
    await check_api_rate_limit(request, "register", limit=5, window_seconds=3600)
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}) is not None:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name.strip(),
        "role": "member",
        "created_at": now_utc(),
        "totp_enabled": False,
        "email_digest_opt_in": True,
        "membership_status": MEMBERSHIP_PENDING,
        "subscription_status": MEMBERSHIP_PENDING,
        "complimentary": False,
    }
    result = await db.users.insert_one(doc)
    token = create_access_token(str(result.inserted_id), email)
    set_auth_cookies(response, token)
    return AuthResponse(
        access_token=token,
        user=UserPublic(**serialize_user({**doc, "_id": result.inserted_id})),
    )


def _normalise_membership_status(status: Optional[str]) -> str:
    if status == "inactive":
        return MEMBERSHIP_EXPIRED
    if status in MEMBERSHIP_STATES:
        return status
    return MEMBERSHIP_PENDING


def _period_is_current(user_doc: dict) -> bool:
    period_end = ensure_utc(user_doc.get("current_period_end"))
    return bool(period_end and period_end >= now_utc())


def _grace_is_current(user_doc: dict) -> bool:
    grace_end = ensure_utc(user_doc.get("grace_period_end"))
    return bool(grace_end and grace_end >= now_utc())


def has_access(user_doc: dict) -> bool:
    """Admin always; members need active paid access or complimentary access."""
    if user_doc.get("role") == "admin":
        return True
    if user_doc.get("complimentary"):
        return True
    status = _normalise_membership_status(user_doc.get("membership_status"))
    if status == MEMBERSHIP_ACTIVE:
        period_end = ensure_utc(user_doc.get("current_period_end"))
        return period_end is None or period_end >= now_utc()
    if status == MEMBERSHIP_PAST_DUE:
        return _grace_is_current(user_doc)
    if status == MEMBERSHIP_CANCELED:
        return _period_is_current(user_doc)
    return False


async def refresh_membership_state(user_doc: dict) -> dict:
    """Expire paid access once a non-renewed billing period has elapsed."""
    if not user_doc or user_doc.get("role") == "admin" or user_doc.get("complimentary"):
        return user_doc
    status = _normalise_membership_status(user_doc.get("membership_status"))
    period_end = ensure_utc(user_doc.get("current_period_end"))
    if status == MEMBERSHIP_PAST_DUE and not user_doc.get("grace_period_end"):
        # Backfill accounts created before explicit grace periods were introduced.
        failure_at = ensure_utc(user_doc.get("payment_failure_at")) or ensure_utc(user_doc.get("last_payment_at")) or now_utc()
        grace_updates = {
            "payment_failure_at": failure_at,
            "grace_period_end": failure_at + timedelta(days=PAYMENT_GRACE_DAYS),
            "updated_at": now_utc(),
        }
        await db.users.update_one({"_id": user_doc["_id"]}, {"$set": grace_updates})
        user_doc = {**user_doc, **grace_updates}
    deadline = ensure_utc(user_doc.get("grace_period_end")) if status == MEMBERSHIP_PAST_DUE else period_end
    if status in {MEMBERSHIP_ACTIVE, MEMBERSHIP_PAST_DUE, MEMBERSHIP_CANCELED} and deadline and deadline < now_utc():
        subscription_id = user_doc.get("stripe_subscription_id")
        subscription = await _retrieve_subscription_snapshot(subscription_id) if subscription_id else None
        authoritative_status = (subscription or {}).get("status")
        authoritative_start, authoritative_end = _subscription_dates(subscription, user_doc)
        if authoritative_status in ("active", "trialing") and (
            authoritative_end is None or authoritative_end >= now_utc()
        ):
            await _restore_paid_membership(user_doc, subscription)
            restored = {
                **user_doc,
                "membership_status": MEMBERSHIP_ACTIVE,
                "subscription_status": authoritative_status,
                "current_period_start": authoritative_start,
                "current_period_end": authoritative_end,
                "last_payment_status": "paid",
                "membership_inactive_reason": None,
            }
            for field in ("payment_failure_at", "grace_period_end", "next_payment_attempt", "payment_failure_notified_at"):
                restored.pop(field, None)
            return restored
        updates = {
            "membership_status": MEMBERSHIP_EXPIRED,
            "subscription_status": MEMBERSHIP_EXPIRED,
            "membership_inactive_reason": "grace_period_ended" if status == MEMBERSHIP_PAST_DUE else "period_ended",
            "updated_at": now_utc(),
        }
        await db.users.update_one({"_id": user_doc["_id"]}, {"$set": updates})
        return {**user_doc, **updates}
    if user_doc.get("membership_status") == "inactive":
        user_doc = {**user_doc, "membership_status": MEMBERSHIP_EXPIRED}
    return user_doc


async def require_member(current_user: dict = Depends(get_current_user)) -> dict:
    if not has_access(current_user):
        raise HTTPException(403, "membership_inactive")
    return current_user


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginRequest, request: Request, response: Response):
    ensure_database_configured()
    await runtime_bootstrap()
    email = payload.email.lower().strip()
    await check_api_rate_limit(request, "login", limit=20, window_seconds=900)
    await check_lockout(request, email)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        await record_failure(request, email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await clear_attempts(request, email)
    user = await refresh_membership_state(user)
    if user.get("totp_enabled"):
        temp = create_pending_2fa_token(str(user["_id"]), email)
        return AuthResponse(requires_2fa=True, temp_token=temp)
    token = create_access_token(str(user["_id"]), email)
    set_auth_cookies(response, token)
    return AuthResponse(access_token=token, user=UserPublic(**serialize_user(user)))


@api_router.post("/auth/2fa/verify", response_model=AuthResponse)
async def two_fa_verify(payload: TwoFAVerify, response: Response, request: Request):
    await check_api_rate_limit(request, "two-factor", limit=12, window_seconds=600)
    try:
        decoded = jwt.decode(payload.temp_token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if decoded.get("type") != "2fa_pending":
            raise HTTPException(401, "Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Code expired. Please sign in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"_id": ObjectId(decoded["sub"])})
    if not user or not user.get("totp_enabled"):
        raise HTTPException(401, "Invalid state")
    user = await refresh_membership_state(user)
    if not _verify_totp_or_backup(user, payload.code):
        raise HTTPException(401, "Invalid 2FA code")
    await _consume_backup_code_if_used(decoded["sub"], payload.code)
    token = create_access_token(str(user["_id"]), user["email"])
    set_auth_cookies(response, token)
    return AuthResponse(access_token=token, user=UserPublic(**serialize_user(user)))


@api_router.get("/auth/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    return UserPublic(**current_user)


@api_router.post("/auth/logout")
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@api_router.get("/auth/2fa/status")
async def two_fa_status(current_user: dict = Depends(get_current_user)):
    raw = await db.users.find_one({"_id": ObjectId(current_user["id"])}) or {}
    enabled = bool(raw.get("totp_enabled"))
    return {
        "enabled": enabled,
        "backup_codes_remaining": len(raw.get("backup_codes_hashed") or []) if enabled else 0,
    }


@api_router.post("/auth/2fa/setup")
async def two_fa_setup(current_user: dict = Depends(get_current_user)):
    if current_user.get("totp_enabled"):
        raise HTTPException(400, "2FA already enabled. Disable first to regenerate.")
    secret = pyotp.random_base32()
    uri = _build_totp_uri(secret, current_user["email"])
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": {"totp_secret_pending": secret}},
    )
    return {"secret": secret, "uri": uri, "qr_png_base64": _qr_png_base64(uri)}


@api_router.post("/auth/2fa/verify-setup")
async def two_fa_verify_setup(payload: TwoFAVerifySetup, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    pending = (user or {}).get("totp_secret_pending")
    if not pending:
        raise HTTPException(400, "No pending 2FA setup. Call /auth/2fa/setup first.")
    if not pyotp.TOTP(pending).verify((payload.code or "").strip(), valid_window=1):
        raise HTTPException(401, "Invalid code")
    backup_codes = _generate_backup_codes()
    hashed = [_hash_backup_code(c) for c in backup_codes]
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {
            "$set": {
                "totp_secret": pending,
                "totp_enabled": True,
                "backup_codes_hashed": hashed,
            },
            "$unset": {"totp_secret_pending": ""},
        },
    )
    return {"enabled": True, "backup_codes": backup_codes}


@api_router.post("/auth/2fa/disable")
async def two_fa_disable(payload: TwoFADisable, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") == "admin":
        raise HTTPException(403, "admin_2fa_required")
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    if not user or not user.get("totp_enabled"):
        raise HTTPException(400, "2FA is not enabled")
    if not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid password")
    if not _verify_totp_or_backup(user, payload.code):
        raise HTTPException(401, "Invalid 2FA code")
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {
            "$set": {"totp_enabled": False},
            "$unset": {"totp_secret": "", "totp_secret_pending": "", "backup_codes_hashed": ""},
        },
    )
    return {"enabled": False}


@api_router.put("/auth/email-preferences", response_model=UserPublic)
async def update_email_prefs(payload: EmailPrefsIn, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": {"email_digest_opt_in": payload.email_digest_opt_in}},
    )
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    return UserPublic(**serialize_user(user))


@api_router.put("/auth/profile", response_model=UserPublic)
async def update_profile(payload: ProfileUpdateIn, current_user: dict = Depends(get_current_user)):
    updates: dict = {"updated_at": now_utc()}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.phone is not None:
        phone = payload.phone.strip()
        updates["phone"] = phone or None
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": updates},
    )
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    return UserPublic(**serialize_user(user))


# ---------------- Routes: member directory ----------------
@api_router.get("/directory")
async def member_directory(
    current_user: dict = Depends(require_admin),
    q: Optional[str] = None,
):
    """Admin-only roster. Returns minimal contact info (name, email, phone)."""
    query: dict = {
        "$or": [
            {"role": "admin"},
            {"complimentary": True},
            {"membership_status": MEMBERSHIP_ACTIVE},
            {
                "$and": [
                    {"membership_status": {"$in": [MEMBERSHIP_PAST_DUE, MEMBERSHIP_CANCELED]}},
                    {"current_period_end": {"$gte": now_utc()}},
                ],
            },
        ],
    }
    if q:
        regex = {"$regex": re.escape(q), "$options": "i"}
        query = {"$and": [query, {"$or": [{"name": regex}, {"email": regex}, {"phone": regex}]}]}
    docs = await db.users.find(
        query,
        {"name": 1, "email": 1, "phone": 1, "role": 1},
    ).sort("name", 1).limit(500).to_list(500)
    return [
        {
            "id": str(d["_id"]),
            "name": d.get("name", ""),
            "email": d.get("email", ""),
            "phone": d.get("phone") or None,
            "role": d.get("role", "member"),
        }
        for d in docs
    ]


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
    cover_url: Optional[str] = None
    estimated_duration_minutes: Optional[int] = Field(default=15, ge=5, le=45)


class ReportIn(ResearchIn):
    period: str = Field(pattern="^\\d{4}-(0[1-9]|1[0-2])$")
    pdf_url: Optional[str] = None
    pdf_filename: Optional[str] = None
    pdf_size: Optional[int] = None


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
    content_type: str = Field(pattern="^(research|education|reports|companies|books)$")
    content_id: str


class BookIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    author: str = Field(default="", max_length=200)
    cover_url: Optional[str] = None
    description: Optional[str] = ""
    category: Optional[str] = None
    external_url: str = Field(min_length=1, max_length=2000)
    status: str = Field(default="published", pattern="^(draft|published)$")


class BookMetadataIn(BaseModel):
    url: str = Field(min_length=8, max_length=2000)


# ---------------- Content helpers ----------------
def _author_stub(user: dict) -> dict:
    return {"author_id": user.get("id") or user.get("_id"), "author_name": user.get("name", "")}


def _published_filter(current_user: dict, status: Optional[str]) -> dict:
    if current_user.get("role") == "admin":
        return {"status": status} if status else {}
    return {"status": "published"}


def _apply_search(query: dict, q: Optional[str], fields: List[str]):
    if q:
        regex = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{f: regex} for f in fields]


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


def _patch_update(payload_dict: dict, existing: dict) -> dict:
    update = dict(payload_dict)
    update["updated_at"] = now_utc()
    new_status = payload_dict.get("status", existing.get("status"))
    if new_status == "published" and not existing.get("published_at"):
        update["published_at"] = now_utc()
    return update


def _validate_public_metadata_url(value: str) -> str:
    parsed = urlparse((value or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Use a public HTTP or HTTPS link")
    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise ValueError("The link host could not be resolved") from exc
    resolved = {item[4][0].split("%", 1)[0] for item in addresses}
    if not resolved or any(not ipaddress.ip_address(address).is_global for address in resolved):
        raise ValueError("Private or local links are not allowed")
    return parsed.geturl()


def _fetch_book_metadata_page(value: str) -> tuple[str, bytes, str]:
    current_url = value
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; HamptonCrestAcademy/1.0; +https://academy.hamptoncrestcapital.com)",
        "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.8,*/*;q=0.2",
    }
    for _ in range(4):
        current_url = _validate_public_metadata_url(current_url)
        response = requests.get(current_url, headers=headers, timeout=(5, 12), stream=True, allow_redirects=False)
        if response.status_code in {301, 302, 303, 307, 308}:
            location = response.headers.get("Location")
            response.close()
            if not location:
                raise ValueError("The source returned an invalid redirect")
            current_url = urljoin(current_url, location)
            continue
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
        chunks = []
        size = 0
        for chunk in response.iter_content(64 * 1024):
            size += len(chunk)
            if size > 2 * 1024 * 1024:
                response.close()
                raise ValueError("The source page is too large to inspect")
            chunks.append(chunk)
        response.close()
        return current_url, b"".join(chunks), content_type
    raise ValueError("The source redirected too many times")


def _json_ld_candidates(value):
    if isinstance(value, list):
        for item in value:
            yield from _json_ld_candidates(item)
    elif isinstance(value, dict):
        yield value
        if "@graph" in value:
            yield from _json_ld_candidates(value["@graph"])


def _metadata_text(soup: BeautifulSoup, *keys: str) -> str:
    for key in keys:
        tag = soup.find("meta", attrs={"property": key}) or soup.find("meta", attrs={"name": key})
        if tag and tag.get("content"):
            return str(tag["content"]).strip()
    return ""


def _author_text(value) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        return str(value.get("name") or "").strip()
    if isinstance(value, list):
        names = [name for name in (_author_text(item) for item in value) if name]
        return ", ".join(names)
    return ""


def _image_text(value) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list) and value:
        return _image_text(value[0])
    if isinstance(value, dict):
        return str(value.get("url") or value.get("contentUrl") or "").strip()
    return ""


def _suggest_book_category(*values: str) -> Optional[str]:
    haystack = " ".join(value or "" for value in values).lower()
    categories = [
        ("Finanzas Conductuales", ("behavioral", "behavioural", "psychology", "psicolog", "conductual")),
        ("Value Investing", ("value investing", "valoración", "valuation", "intrinsic value")),
        ("Macro y Ciclos", ("macro", "economic cycle", "business cycle", "ciclo económico")),
        ("Historia de los Mercados", ("market history", "financial history", "historia", "crash")),
        ("Estrategia y Modelos Mentales", ("strategy", "mental model", "decision", "estrategia")),
        ("Fundadores y Operadores", ("founder", "entrepreneur", "operator", "leadership", "biography")),
        ("Clásicos de inversión", ("investing", "investment", "inversión", "stock market")),
    ]
    for category, keywords in categories:
        if any(keyword in haystack for keyword in keywords):
            return category
    return None


def _extract_book_metadata(source_url: str, data: bytes, content_type: str) -> dict:
    parsed = urlparse(source_url)
    filename = parsed.path.rsplit("/", 1)[-1]
    fallback_title = re.sub(r"[-_]+", " ", filename.rsplit(".", 1)[0]).strip().title()
    if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
        return {
            "title": fallback_title,
            "author": "",
            "description": "",
            "cover_url": "",
            "category": None,
            "source_type": "PDF",
            "resolved_url": source_url,
        }
    if content_type not in {"text/html", "application/xhtml+xml", ""}:
        raise ValueError("The link does not point to a readable web page")

    soup = BeautifulSoup(data, "html.parser")
    structured = None
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            decoded = json.loads(script.string or script.get_text() or "")
        except (TypeError, json.JSONDecodeError):
            continue
        for candidate in _json_ld_candidates(decoded):
            raw_type = candidate.get("@type", "")
            types = raw_type if isinstance(raw_type, list) else [raw_type]
            if any(str(item).lower() in {"book", "product", "creativework"} for item in types):
                structured = candidate
                if any(str(item).lower() == "book" for item in types):
                    break
        if structured and str(structured.get("@type", "")).lower() == "book":
            break

    structured = structured or {}
    page_title = soup.title.get_text(" ", strip=True) if soup.title else ""
    title = str(structured.get("name") or structured.get("headline") or "").strip()
    title = title or _metadata_text(soup, "og:title", "twitter:title") or page_title or fallback_title
    author = _author_text(structured.get("author")) or _metadata_text(
        soup, "author", "book:author", "citation_author"
    )
    description = str(structured.get("description") or "").strip() or _metadata_text(
        soup, "og:description", "twitter:description", "description"
    )
    cover_url = _image_text(structured.get("image")) or _metadata_text(soup, "og:image", "twitter:image")
    if cover_url:
        cover_url = urljoin(source_url, cover_url)
    genre = structured.get("genre")
    if isinstance(genre, list):
        genre = " ".join(str(item) for item in genre)
    category = _suggest_book_category(title, author, str(genre or ""), description)
    return {
        "title": title[:200],
        "author": author[:200],
        "description": description[:1000],
        "cover_url": cover_url[:2000],
        "category": category,
        "source_type": "Página web",
        "resolved_url": source_url,
    }


async def _maybe_dispatch(bg: BackgroundTasks, *, content_type: str, before: Optional[dict], after: dict):
    """Fire digest when a piece transitions to published."""
    was_published = bool(before and before.get("status") == "published" and before.get("published_at"))
    is_published_now = after.get("status") == "published"
    if (not was_published) and is_published_now:
        bg.add_task(dispatch_content_digest, content_type=content_type, item=serialize_doc(after))


# ---------------- Routes: research ----------------
@api_router.get("/research")
async def list_research(
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
    _apply_search(query, q, ["title", "summary", "body"])
    docs = await db.research_notes.find(query).sort("created_at", -1).limit(200).to_list(200)
    return [serialize_doc(d) for d in docs]


@api_router.get("/research/{content_id}")
async def get_research(content_id: str, current_user: dict = Depends(get_current_user)):
    return serialize_doc(await _get_or_404("research_notes", content_id, current_user))


@api_router.post("/research")
async def create_research(payload: ResearchIn, bg: BackgroundTasks, current_user: dict = Depends(require_admin)):
    doc = _build_content_doc(payload.model_dump(), current_user)
    await db.research_notes.insert_one(doc)
    await _maybe_dispatch(bg, content_type="research", before=None, after=doc)
    return serialize_doc(doc)


@api_router.put("/research/{content_id}")
async def update_research(content_id: str, payload: ResearchIn, bg: BackgroundTasks, current_user: dict = Depends(require_admin)):
    existing = await db.research_notes.find_one({"_id": content_id})
    if not existing:
        raise HTTPException(404, "Not found")
    update = _patch_update(payload.model_dump(), existing)
    await db.research_notes.update_one({"_id": content_id}, {"$set": update})
    merged = {**existing, **update}
    await _maybe_dispatch(bg, content_type="research", before=existing, after=merged)
    return serialize_doc(merged)


@api_router.delete("/research/{content_id}")
async def delete_research(content_id: str, current_user: dict = Depends(require_admin)):
    await db.research_notes.delete_one({"_id": content_id})
    return {"ok": True}


# ---------------- Routes: education ----------------
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
    return serialize_doc(await _get_or_404("education_modules", content_id, current_user))


@api_router.post("/education")
async def create_education(payload: EducationIn, bg: BackgroundTasks, current_user: dict = Depends(require_admin)):
    doc = _build_content_doc(payload.model_dump(), current_user)
    await db.education_modules.insert_one(doc)
    await _maybe_dispatch(bg, content_type="education", before=None, after=doc)
    return serialize_doc(doc)


@api_router.put("/education/{content_id}")
async def update_education(content_id: str, payload: EducationIn, bg: BackgroundTasks, current_user: dict = Depends(require_admin)):
    existing = await db.education_modules.find_one({"_id": content_id})
    if not existing:
        raise HTTPException(404, "Not found")
    update = _patch_update(payload.model_dump(), existing)
    await db.education_modules.update_one({"_id": content_id}, {"$set": update})
    merged = {**existing, **update}
    await _maybe_dispatch(bg, content_type="education", before=existing, after=merged)
    return serialize_doc(merged)


@api_router.delete("/education/{content_id}")
async def delete_education(content_id: str, current_user: dict = Depends(require_admin)):
    await db.education_modules.delete_one({"_id": content_id})
    return {"ok": True}


# ---------------- Routes: reports ----------------
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
    return serialize_doc(await _get_or_404("monthly_reports", content_id, current_user))


@api_router.post("/reports")
async def create_report(payload: ReportIn, bg: BackgroundTasks, current_user: dict = Depends(require_admin)):
    doc = _build_content_doc(payload.model_dump(), current_user)
    await db.monthly_reports.insert_one(doc)
    await _maybe_dispatch(bg, content_type="reports", before=None, after=doc)
    return serialize_doc(doc)


@api_router.put("/reports/{content_id}")
async def update_report(content_id: str, payload: ReportIn, bg: BackgroundTasks, current_user: dict = Depends(require_admin)):
    existing = await db.monthly_reports.find_one({"_id": content_id})
    if not existing:
        raise HTTPException(404, "Not found")
    update = _patch_update(payload.model_dump(), existing)
    await db.monthly_reports.update_one({"_id": content_id}, {"$set": update})
    merged = {**existing, **update}
    await _maybe_dispatch(bg, content_type="reports", before=existing, after=merged)
    return serialize_doc(merged)


@api_router.delete("/reports/{content_id}")
async def delete_report(content_id: str, current_user: dict = Depends(require_admin)):
    existing = await db.monthly_reports.find_one({"_id": content_id})
    if existing and existing.get("pdf_storage_path"):
        await db.uploads.update_one(
            {"storage_path": existing["pdf_storage_path"]},
            {"$set": {"is_deleted": True}},
        )
    await db.monthly_reports.delete_one({"_id": content_id})
    return {"ok": True}


# ---------------- Routes: companies ----------------
@api_router.get("/companies")
async def list_companies(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    sector: Optional[str] = None,
    q: Optional[str] = None,
):
    query: dict = {}
    if status:
        query["status"] = status
    if sector:
        query["sector"] = sector
    _apply_search(query, q, ["ticker", "name", "thesis_summary"])
    docs = await db.companies.find(query).sort("ticker", 1).limit(500).to_list(500)
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
    try:
        await db.companies.insert_one(doc)
    except Exception as e:
        if "duplicate key" in str(e).lower():
            raise HTTPException(status_code=409, detail=f"Ticker '{data['ticker']}' already exists")
        raise
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


# ---------------- Routes: books (academy library) ----------------
@api_router.post("/books/metadata/inspect")
async def inspect_book_metadata(payload: BookMetadataIn, current_user: dict = Depends(require_admin)):
    try:
        resolved_url, data, content_type = await asyncio.to_thread(_fetch_book_metadata_page, payload.url.strip())
        return await asyncio.to_thread(_extract_book_metadata, resolved_url, data, content_type)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except requests.RequestException as exc:
        logger.info("book metadata fetch failed for %s: %s", payload.url, exc)
        raise HTTPException(422, "The source page could not be read. Enter the book details manually.")


@api_router.get("/books")
async def list_books(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
):
    query = _published_filter(current_user, status)
    if category:
        query["category"] = category
    _apply_search(query, q, ["title", "author", "description"])
    docs = await db.books.find(query).sort([("created_at", -1)]).limit(500).to_list(500)
    return [serialize_doc(d) for d in docs]


@api_router.get("/books/{content_id}")
async def get_book(content_id: str, current_user: dict = Depends(get_current_user)):
    return serialize_doc(await _get_or_404("books", content_id, current_user))


@api_router.post("/books")
async def create_book(payload: BookIn, current_user: dict = Depends(require_admin)):
    doc = _build_content_doc(payload.model_dump(), current_user)
    await db.books.insert_one(doc)
    return serialize_doc(doc)


@api_router.put("/books/{content_id}")
async def update_book(content_id: str, payload: BookIn, current_user: dict = Depends(require_admin)):
    existing = await db.books.find_one({"_id": content_id})
    if not existing:
        raise HTTPException(404, "Not found")
    update = _patch_update(payload.model_dump(), existing)
    await db.books.update_one({"_id": content_id}, {"$set": update})
    return serialize_doc({**existing, **update})


@api_router.delete("/books/{content_id}")
async def delete_book(content_id: str, current_user: dict = Depends(require_admin)):
    await db.books.delete_one({"_id": content_id})
    return {"ok": True}


# ---------------- Routes: search ----------------
# Extracted to routers/search.py — registered after api_router is fully built.


# ---------------- Routes: bookmarks ----------------
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
    content_type: str = Query(..., pattern="^(research|education|reports|companies|books)$"),
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
    item = await db[coll].find_one({"_id": payload.content_id})
    if not item:
        raise HTTPException(404, "Content not found")
    if (
        current_user.get("role") != "admin"
        and payload.content_type != "companies"
        and item.get("status") != "published"
    ):
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
    content_type: str = Query(..., pattern="^(research|education|reports|companies|books)$"),
    content_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    await db.bookmarks.delete_one({
        "user_id": current_user["id"],
        "content_type": content_type,
        "content_id": content_id,
    })
    return {"bookmarked": False}


# ---------------- Routes: PDF upload + file serve ----------------
@api_router.post("/uploads/image")
async def upload_content_image(file: UploadFile = File(...), current_user: dict = Depends(require_admin)):
    """Store a safe raster image for book and education covers."""
    content_type = (file.content_type or "").lower()
    allowed_types = {
        "image/jpeg": ("jpg", lambda value: value.startswith(b"\xff\xd8\xff")),
        "image/png": ("png", lambda value: value.startswith(b"\x89PNG\r\n\x1a\n")),
        "image/webp": ("webp", lambda value: value.startswith(b"RIFF") and value[8:12] == b"WEBP"),
    }
    if content_type not in allowed_types:
        raise HTTPException(400, "Only JPG, PNG, and WebP images are accepted")
    data = await file.read()
    if len(data) > IMAGE_MAX_BYTES:
        raise HTTPException(413, f"Image exceeds {IMAGE_MAX_BYTES // (1024*1024)} MB limit")
    if not data:
        raise HTTPException(400, "Empty file")
    extension, signature_matches = allowed_types[content_type]
    if not signature_matches(data):
        raise HTTPException(400, "Image contents do not match its declared format")

    file_id = new_id()
    path = f"{APP_NAME}/images/{file_id}.{extension}"
    try:
        result = await put_object(path, data, content_type)
    except Exception as e:
        logger.error("image upload failed: %s", e)
        raise HTTPException(503, "Storage unavailable")
    stored_path = result.get("path", path)
    await db.uploads.insert_one({
        "_id": file_id,
        "storage_path": stored_path,
        "original_filename": file.filename or f"{file_id}.{extension}",
        "content_type": content_type,
        "size": len(data),
        "is_deleted": False,
        "uploader_id": current_user["id"],
        "created_at": now_utc(),
    })
    return {
        "id": file_id,
        "url": f"/api/files/{stored_path}",
        "filename": file.filename or f"{file_id}.{extension}",
        "size": len(data),
        "content_type": content_type,
    }


@api_router.post("/uploads/report-pdf")
async def upload_report_pdf(file: UploadFile = File(...), current_user: dict = Depends(require_admin)):
    if file.content_type != "application/pdf" and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted")
    data = await file.read()
    if len(data) > PDF_MAX_BYTES:
        raise HTTPException(413, f"PDF exceeds {PDF_MAX_BYTES // (1024*1024)} MB limit")
    if not data:
        raise HTTPException(400, "Empty file")
    file_id = new_id()
    path = f"{APP_NAME}/reports/{file_id}.pdf"
    try:
        result = await put_object(path, data, "application/pdf")
    except Exception as e:
        logger.error("upload failed: %s", e)
        raise HTTPException(503, "Storage unavailable")
    stored_path = result.get("path", path)
    await db.uploads.insert_one({
        "_id": file_id,
        "storage_path": stored_path,
        "original_filename": file.filename or f"{file_id}.pdf",
        "content_type": "application/pdf",
        "size": len(data),
        "is_deleted": False,
        "uploader_id": current_user["id"],
        "created_at": now_utc(),
    })
    return {
        "id": file_id,
        "url": f"/api/files/{stored_path}",
        "filename": file.filename or f"{file_id}.pdf",
        "size": len(data),
        "content_type": "application/pdf",
    }


@api_router.get("/files/{path:path}")
async def serve_file(
    path: str,
    current_user: dict = Depends(require_member),
):
    record = await db.uploads.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(404, "File not found")
    try:
        data, content_type = await get_object(path)
    except Exception as e:
        logger.error("file fetch failed: %s", e)
        raise HTTPException(503, "Storage unavailable")
    headers = {"Content-Disposition": f'inline; filename="{record.get("original_filename", "file.pdf")}"'}
    return Response(content=data, media_type=record.get("content_type") or content_type, headers=headers)


# ---------------- Stripe / Membership / Invites / Admin ----------------

class AcceptInviteIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class AdminMemberAction(BaseModel):
    complimentary: Optional[bool] = None
    notes: Optional[str] = None


def _welcome_email_html(name: str, link: str) -> str:
    safe_name = (name or "Member").replace("<", "&lt;").replace(">", "&gt;")
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#050914;font-family:Helvetica,Arial,sans-serif;color:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050914;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0c1222;border:1px solid #212a3f;">
        <tr><td style="padding:32px 36px 8px 36px;">
          <div style="color:#d4af37;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;font-weight:600;">Hampton Crest</div>
          <div style="color:#5b667a;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;margin-top:2px;">Academy</div>
        </td></tr>
        <tr><td style="padding:24px 36px 0 36px;">
          <div style="height:1px;background:linear-gradient(to right,transparent,#d4af37,transparent);opacity:0.6;"></div>
        </td></tr>
        <tr><td style="padding:28px 36px 24px 36px;">
          <div style="color:#9aa4b6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:12px;">Welcome, {safe_name}</div>
          <h1 style="margin:0 0 16px 0;color:#f4f6f8;font-size:24px;line-height:1.2;font-weight:500;letter-spacing:-0.01em;">Your charter has been issued.</h1>
          <p style="color:#9aa4b6;font-size:14px;line-height:1.7;margin:0 0 24px 0;">Your subscription is active. Set your password to access the members' suite — research, education, monthly reports, and company coverage.</p>
        </td></tr>
        <tr><td style="padding:0 36px 36px 36px;">
          <a href="{link}" style="display:inline-block;background:#e2e8f0;color:#050914;text-decoration:none;padding:14px 28px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;font-weight:600;">Set my password</a>
          <p style="color:#5b667a;font-size:11px;line-height:1.7;margin:20px 0 0 0;">This invitation link expires in 7 days. If you didn't expect this email, ignore it.</p>
        </td></tr>
        <tr><td style="padding:0 36px 36px 36px;border-top:1px solid #212a3f;">
          <p style="color:#5b667a;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;margin:24px 0 0 0;">Confidential · For Members Only</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


async def _create_invite(user_id: str, email: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.invites.insert_one({
        "_id": token,
        "user_id": user_id,
        "email": email,
        "expires_at": now_utc() + timedelta(days=INVITE_TOKEN_TTL_DAYS),
        "consumed_at": None,
        "created_at": now_utc(),
    })
    return token


async def _send_welcome_email(email: str, name: str, token: str):
    if not PUBLIC_URL:
        logger.warning("APP_PUBLIC_URL unset; welcome email link will be relative")
    link = f"{PUBLIC_URL}/accept-invite?token={token}"
    html = _welcome_email_html(name, link)
    await send_email(email, "Welcome to Hampton Crest Academy", html)


def _password_reset_email_html(name: str, link: str) -> str:
    safe_name = (name or "Member").replace("<", "&lt;").replace(">", "&gt;")
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#050914;font-family:Helvetica,Arial,sans-serif;color:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050914;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0c1222;border:1px solid #212a3f;">
        <tr><td style="padding:32px 36px 8px 36px;">
          <div style="color:#d4af37;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;font-weight:600;">Hampton Crest</div>
          <div style="color:#5b667a;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;margin-top:2px;">Academy</div>
        </td></tr>
        <tr><td style="padding:24px 36px 0 36px;">
          <div style="height:1px;background:linear-gradient(to right,transparent,#d4af37,transparent);opacity:0.6;"></div>
        </td></tr>
        <tr><td style="padding:28px 36px 24px 36px;">
          <div style="color:#9aa4b6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:12px;">Password reset</div>
          <h1 style="margin:0 0 16px 0;color:#f4f6f8;font-size:24px;line-height:1.2;font-weight:500;letter-spacing:-0.01em;">Reset your Hampton Crest password.</h1>
          <p style="color:#9aa4b6;font-size:14px;line-height:1.7;margin:0 0 24px 0;">Hello {safe_name}, use this private link to set a new password for your account.</p>
        </td></tr>
        <tr><td style="padding:0 36px 36px 36px;">
          <a href="{link}" style="display:inline-block;background:#e2e8f0;color:#050914;text-decoration:none;padding:14px 28px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;font-weight:600;">Reset password</a>
          <p style="color:#5b667a;font-size:11px;line-height:1.7;margin:20px 0 0 0;">This link expires in 1 hour. If you did not request it, ignore this email.</p>
        </td></tr>
        <tr><td style="padding:0 36px 36px 36px;border-top:1px solid #212a3f;">
          <p style="color:#5b667a;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;margin:24px 0 0 0;">Confidential · For Members Only</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


async def _create_password_reset(user_id: str, email: str) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = now_utc() + timedelta(hours=1)
    await db.password_resets.insert_one({
        "_id": token,
        "user_id": user_id,
        "email": email,
        "expires_at": expires_at,
        "consumed_at": None,
        "created_at": now_utc(),
    })
    logger.info(
        "[password-reset:token-generated] email=%s user_id=%s token_digest=%s expires_at=%s",
        email,
        user_id,
        hashlib.sha256(token.encode("utf-8")).hexdigest()[:12],
        expires_at.isoformat(),
    )
    return token


async def _send_password_reset_email(email: str, name: str, token: str):
    if not PUBLIC_URL:
        logger.warning("APP_PUBLIC_URL unset; password reset email link will be relative")
    link = f"{PUBLIC_URL}/reset-password?token={token}"
    html = _password_reset_email_html(name, link)
    logger.info("[password-reset:email-attempt] email=%s public_url_configured=%s", email, bool(PUBLIC_URL))
    response = await send_email(email, "Reset your Hampton Crest Academy password", html)
    logger.info("[password-reset:email-response] email=%s response=%s", email, response)
    return response


def _payment_issue_email_html(name: str, portal_link: str, grace_end: Optional[datetime], reason: str) -> str:
    safe_name = (name or "Miembro").replace("<", "&lt;").replace(">", "&gt;")
    deadline = ensure_utc(grace_end)
    deadline_text = deadline.strftime("%d/%m/%Y") if deadline else "lo antes posible"
    reason_text = {
        "payment_action_required": "Stripe necesita una verificación adicional para completar el cobro.",
        "invoice_finalization_failed": "No fue posible finalizar la factura de tu renovación.",
    }.get(reason, "No pudimos procesar el pago de renovación de tu membresía.")
    return f"""<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#071925;font-family:Helvetica,Arial,sans-serif;color:#fffaf0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#071925;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0d2635;border:1px solid #385061;">
        <tr><td style="padding:34px 36px;">
          <div style="color:#e2c56f;font-size:11px;letter-spacing:.28em;text-transform:uppercase;font-weight:700;">Hampton Crest Academy</div>
          <h1 style="margin:22px 0 14px;font-size:26px;line-height:1.2;font-weight:500;">Actualiza tu método de pago</h1>
          <p style="color:#d9e0e4;font-size:14px;line-height:1.7;">Hola {safe_name}. {reason_text}</p>
          <p style="color:#d9e0e4;font-size:14px;line-height:1.7;">Mantendremos tu acceso hasta el <strong>{deadline_text}</strong>. Actualiza tu método de pago para evitar interrupciones.</p>
          <a href="{portal_link}" style="display:inline-block;margin-top:14px;background:#e2c56f;color:#071925;text-decoration:none;padding:14px 24px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;">Actualizar pago</a>
          <p style="color:#92a2ac;font-size:11px;line-height:1.6;margin-top:24px;">Si ya actualizaste tu pago, no necesitas hacer nada. Stripe volverá a intentar el cobro según la configuración de recuperación.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


async def _send_payment_issue_email(user: dict, grace_end: Optional[datetime], reason: str):
    portal_link = f"{PUBLIC_URL}/access-denied?billing=1" if PUBLIC_URL else "/access-denied?billing=1"
    html = _payment_issue_email_html(user.get("name", ""), portal_link, grace_end, reason)
    return await send_email(user["email"], "Acción requerida: actualiza tu método de pago", html)


async def _send_payment_recovered_email(user: dict):
    safe_name = (user.get("name") or "Miembro").replace("<", "&lt;").replace(">", "&gt;")
    html = f"""<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#071925;font-family:Helvetica,Arial,sans-serif;color:#fffaf0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#071925;padding:40px 16px;">
    <tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0d2635;border:1px solid #385061;">
      <tr><td style="padding:34px 36px;">
        <div style="color:#e2c56f;font-size:11px;letter-spacing:.28em;text-transform:uppercase;font-weight:700;">Hampton Crest Academy</div>
        <h1 style="margin:22px 0 14px;font-size:26px;line-height:1.2;font-weight:500;">Tu membresía está activa nuevamente</h1>
        <p style="color:#d9e0e4;font-size:14px;line-height:1.7;">Hola {safe_name}. Stripe confirmó el pago pendiente y restauramos tu acceso completo a la academia.</p>
        <a href="{PUBLIC_URL or '/'}" style="display:inline-block;margin-top:14px;background:#e2c56f;color:#071925;text-decoration:none;padding:14px 24px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;">Entrar a la academia</a>
      </td></tr>
    </table></td></tr>
  </table>
</body></html>"""
    return await send_email(user["email"], "Tu membresía Hampton Crest está activa", html)


async def _activate_or_create_member(
    *,
    email: str,
    name: Optional[str],
    stripe_customer_id: Optional[str],
    stripe_subscription_id: Optional[str],
    current_period_start: Optional[datetime],
    current_period_end: Optional[datetime],
    subscription_status: Optional[str] = MEMBERSHIP_ACTIVE,
    last_payment_status: Optional[str] = "paid",
):
    """Idempotent: activates an existing user (matched by email) or creates a new one with a welcome invite."""
    email = (email or "").lower().strip()
    if not email:
        logger.warning("Stripe event missing customer email; skipping")
        return
    user = await db.users.find_one({"email": email})
    update_fields = {
        "membership_status": MEMBERSHIP_ACTIVE,
        "subscription_status": subscription_status or MEMBERSHIP_ACTIVE,
        "stripe_customer_id": stripe_customer_id,
        "stripe_subscription_id": stripe_subscription_id,
        "current_period_start": current_period_start,
        "current_period_end": current_period_end,
        "last_payment_status": last_payment_status,
        "last_payment_at": now_utc() if last_payment_status else None,
        "updated_at": now_utc(),
    }
    if user is None:
        doc = {
            "email": email,
            "name": (name or email.split("@")[0]).strip()[:120] or email,
            "role": "member",
            "created_at": now_utc(),
            "totp_enabled": False,
            "email_digest_opt_in": True,
            "password_hash": "",  # set later via invite
            "complimentary": False,
            **update_fields,
        }
        result = await db.users.insert_one(doc)
        user_id = str(result.inserted_id)
        token = await _create_invite(user_id, email)
        try:
            await _send_welcome_email(email, doc["name"], token)
        except Exception as e:
            logger.error("welcome email failed: %s", e)
        logger.info("Created new member %s via Stripe", email)
    else:
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {**update_fields, "membership_inactive_reason": None, "payment_attempt_count": 0},
                "$unset": {
                    "payment_failure_at": "",
                    "grace_period_end": "",
                    "next_payment_attempt": "",
                    "payment_failure_notified_at": "",
                },
            },
        )
        if not user.get("password_hash"):
            # First activation but never set password — re-send invite
            token = await _create_invite(str(user["_id"]), email)
            try:
                await _send_welcome_email(email, user.get("name", ""), token)
            except Exception as e:
                logger.error("welcome email failed: %s", e)
        logger.info("Activated existing member %s", email)


async def _mark_subscription_canceled_or_expired(subscription_id: str, status_reason: str = MEMBERSHIP_CANCELED):
    user = await db.users.find_one({"stripe_subscription_id": subscription_id})
    if not user:
        logger.info("No user found for subscription %s", subscription_id)
        return
    period_end = ensure_utc(user.get("current_period_end"))
    delinquent = (
        user.get("last_payment_status") == "failed"
        or _normalise_membership_status(user.get("membership_status")) in {MEMBERSHIP_PAST_DUE, MEMBERSHIP_EXPIRED}
    )
    next_status = (
        MEMBERSHIP_CANCELED
        if not delinquent and period_end and period_end >= now_utc()
        else MEMBERSHIP_EXPIRED
    )
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "membership_status": next_status,
            "subscription_status": status_reason,
            "membership_inactive_reason": status_reason,
            "updated_at": now_utc(),
        }},
    )
    logger.info("Updated %s to %s (reason=%s)", user["email"], next_status, status_reason)


def _ts_to_dt(ts: Optional[int]) -> Optional[datetime]:
    if not ts:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc)


def _membership_from_subscription_status(status: Optional[str], period_end: Optional[datetime]) -> str:
    if status in ("active", "trialing"):
        return MEMBERSHIP_ACTIVE
    if status == "past_due":
        return MEMBERSHIP_PAST_DUE
    if status in ("canceled", "cancelled"):
        return MEMBERSHIP_CANCELED if period_end and period_end >= now_utc() else MEMBERSHIP_EXPIRED
    if status in ("unpaid", "incomplete_expired"):
        return MEMBERSHIP_EXPIRED
    return MEMBERSHIP_PENDING


async def _retrieve_subscription_snapshot(subscription_id: Optional[str]) -> Optional[dict]:
    if not subscription_id or not stripe.api_key:
        return None
    try:
        subscription = await asyncio.to_thread(stripe.Subscription.retrieve, subscription_id)
        return dict(subscription)
    except Exception as exc:
        logger.warning("Could not retrieve subscription %s while syncing billing state: %s", subscription_id, exc)
        return None


def _subscription_dates(subscription: Optional[dict], user: Optional[dict] = None) -> tuple[Optional[datetime], Optional[datetime]]:
    subscription = subscription or {}
    user = user or {}
    return (
        _ts_to_dt(subscription.get("current_period_start")) or ensure_utc(user.get("current_period_start")),
        _ts_to_dt(subscription.get("current_period_end")) or ensure_utc(user.get("current_period_end")),
    )


async def _restore_paid_membership(user: dict, subscription: Optional[dict], paid_at: Optional[datetime] = None):
    was_delinquent = user.get("last_payment_status") == "failed" or _normalise_membership_status(
        user.get("membership_status")
    ) in {MEMBERSHIP_PAST_DUE, MEMBERSHIP_EXPIRED}
    period_start, period_end = _subscription_dates(subscription, user)
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "membership_status": MEMBERSHIP_ACTIVE,
                "subscription_status": (subscription or {}).get("status") or MEMBERSHIP_ACTIVE,
                "current_period_start": period_start,
                "current_period_end": period_end,
                "last_payment_status": "paid",
                "last_payment_at": paid_at or now_utc(),
                "membership_inactive_reason": None,
                "payment_attempt_count": 0,
                "updated_at": now_utc(),
            },
            "$unset": {
                "payment_failure_at": "",
                "grace_period_end": "",
                "next_payment_attempt": "",
                "payment_failure_notified_at": "",
            },
        },
    )
    if was_delinquent:
        await _send_payment_recovered_email(user)


async def _expire_membership(user: dict, *, subscription_status: str, reason: str, subscription: Optional[dict] = None):
    period_start, period_end = _subscription_dates(subscription, user)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "membership_status": MEMBERSHIP_EXPIRED,
            "subscription_status": subscription_status,
            "current_period_start": period_start,
            "current_period_end": period_end,
            "membership_inactive_reason": reason,
            "updated_at": now_utc(),
        }},
    )


async def _record_payment_issue(
    user: dict,
    *,
    subscription: Optional[dict],
    invoice: Optional[dict],
    reason: str,
    occurred_at: datetime,
    force_issue: bool = False,
):
    subscription_status = (subscription or {}).get("status")
    if not force_issue and subscription_status in ("active", "trialing"):
        # A later successful payment may already have restored the subscription.
        await _restore_paid_membership(user, subscription)
        return
    if subscription_status in ("unpaid", "incomplete_expired"):
        await _expire_membership(
            user,
            subscription_status=subscription_status,
            reason=subscription_status,
            subscription=subscription,
        )
        return
    if subscription_status in ("canceled", "cancelled"):
        await _mark_subscription_canceled_or_expired(user.get("stripe_subscription_id"), status_reason=subscription_status)
        return

    previous_failure = ensure_utc(user.get("payment_failure_at"))
    first_failure = previous_failure or occurred_at
    grace_end = first_failure + timedelta(days=PAYMENT_GRACE_DAYS)
    next_attempt = _ts_to_dt((invoice or {}).get("next_payment_attempt"))
    attempt_count = int((invoice or {}).get("attempt_count") or user.get("payment_attempt_count") or 1)
    period_start, period_end = _subscription_dates(subscription, user)
    membership_status = MEMBERSHIP_PAST_DUE if grace_end >= now_utc() else MEMBERSHIP_EXPIRED
    should_notify = not user.get("payment_failure_notified_at")
    updates = {
        "membership_status": membership_status,
        "subscription_status": subscription_status or MEMBERSHIP_PAST_DUE,
        "current_period_start": period_start,
        "current_period_end": period_end,
        "last_payment_status": "failed",
        "last_payment_at": occurred_at,
        "payment_failure_at": first_failure,
        "grace_period_end": grace_end,
        "next_payment_attempt": next_attempt,
        "payment_attempt_count": attempt_count,
        "membership_inactive_reason": reason if membership_status == MEMBERSHIP_PAST_DUE else "grace_period_ended",
        "updated_at": now_utc(),
    }
    await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    if should_notify:
        delivered = await _send_payment_issue_email(user, grace_end, reason)
        if delivered:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"payment_failure_notified_at": now_utc()}},
            )


async def _process_stripe_event(parsed: dict):
    etype = parsed["type"]
    obj = parsed["data"]["object"]
    occurred_at = _ts_to_dt(parsed.get("created")) or now_utc()

    if etype == "checkout.session.completed":
        email = (obj.get("customer_details") or {}).get("email") or obj.get("customer_email")
        name = (obj.get("customer_details") or {}).get("name")
        customer_id = obj.get("customer")
        subscription_id = obj.get("subscription")
        subscription = await _retrieve_subscription_snapshot(subscription_id)
        period_start, period_end = _subscription_dates(subscription)
        if not email and subscription and subscription.get("customer"):
            try:
                customer = await asyncio.to_thread(stripe.Customer.retrieve, subscription["customer"])
                email = customer.get("email")
                name = name or customer.get("name")
            except Exception as exc:
                logger.warning("Could not retrieve Stripe customer for subscription %s: %s", subscription_id, exc)
        await _activate_or_create_member(
            email=email,
            name=name,
            stripe_customer_id=customer_id,
            stripe_subscription_id=subscription_id,
            current_period_start=period_start,
            current_period_end=period_end,
            subscription_status=(subscription or {}).get("status") or MEMBERSHIP_ACTIVE,
            last_payment_status="paid",
        )
        return

    subscription_id = obj.get("subscription") if etype.startswith("invoice.") else obj.get("id")
    if not subscription_id:
        logger.info("Stripe event %s has no subscription; nothing to sync", etype)
        return
    user = await db.users.find_one({"stripe_subscription_id": subscription_id})
    if not user:
        logger.info("No user found for subscription %s", subscription_id)
        return
    subscription = await _retrieve_subscription_snapshot(subscription_id)

    if etype == "customer.subscription.updated":
        authoritative = subscription or obj
        status = authoritative.get("status")
        if status in ("active", "trialing"):
            await _restore_paid_membership(user, authoritative)
        elif status == "past_due":
            await _record_payment_issue(
                user,
                subscription=authoritative,
                invoice=None,
                reason="payment_failed",
                occurred_at=occurred_at,
            )
        elif status in ("unpaid", "incomplete_expired"):
            await _expire_membership(user, subscription_status=status, reason=status, subscription=authoritative)
        elif status in ("canceled", "cancelled"):
            await _mark_subscription_canceled_or_expired(subscription_id, status_reason=status)
        else:
            period_start, period_end = _subscription_dates(authoritative, user)
            await db.users.update_one({"_id": user["_id"]}, {"$set": {
                "membership_status": _membership_from_subscription_status(status, period_end),
                "subscription_status": status,
                "current_period_start": period_start,
                "current_period_end": period_end,
                "membership_inactive_reason": status,
                "updated_at": now_utc(),
            }})
    elif etype == "customer.subscription.deleted":
        await _mark_subscription_canceled_or_expired(subscription_id, status_reason="deleted")
    elif etype in ("invoice.payment_succeeded", "invoice.paid"):
        if subscription and subscription.get("status") not in ("active", "trialing"):
            status = subscription.get("status")
            if status == "past_due":
                await _record_payment_issue(
                    user, subscription=subscription, invoice=obj,
                    reason="payment_failed", occurred_at=occurred_at,
                )
            elif status in ("unpaid", "incomplete_expired"):
                await _expire_membership(user, subscription_status=status, reason=status, subscription=subscription)
            return
        paid_at = _ts_to_dt((obj.get("status_transitions") or {}).get("paid_at")) or occurred_at
        await _restore_paid_membership(user, subscription, paid_at)
    elif etype in ("invoice.payment_failed", "invoice.payment_action_required", "invoice.finalization_failed"):
        reasons = {
            "invoice.payment_failed": "payment_failed",
            "invoice.payment_action_required": "payment_action_required",
            "invoice.finalization_failed": "invoice_finalization_failed",
        }
        await _record_payment_issue(
            user,
            subscription=subscription,
            invoice=obj,
            reason=reasons[etype],
            occurred_at=occurred_at,
            force_issue=etype == "invoice.finalization_failed",
        )
    else:
        logger.info("Unhandled Stripe event type: %s", etype)


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not STRIPE_WEBHOOK_SECRET:
        logger.error("STRIPE_WEBHOOK_SECRET not configured")
        raise HTTPException(503, "Webhook handler not configured")
    try:
        event = stripe.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        logger.warning("Invalid webhook signature: %s", e)
        raise HTTPException(400, "Invalid signature")

    parsed = json.loads(body)
    event_id = parsed["id"]
    existing = await db.stripe_events.find_one({"_id": event_id})
    if existing and existing.get("status") == "processed":
        return {"received": True, "duplicate": True}
    if existing:
        received_at = ensure_utc(existing.get("received_at"))
        if received_at and received_at >= now_utc() - timedelta(minutes=5):
            # Another invocation is still working. A non-2xx response makes Stripe retry later.
            raise HTTPException(409, "Stripe event is already processing")
        await db.stripe_events.delete_one({"_id": event_id})
    try:
        await db.stripe_events.insert_one({
            "_id": event_id,
            "type": parsed["type"],
            "status": "processing",
            "received_at": now_utc(),
        })
    except DuplicateKeyError:
        raise HTTPException(409, "Stripe event is already processing")

    try:
        await _process_stripe_event(parsed)
        await db.stripe_events.update_one(
            {"_id": event_id},
            {"$set": {"status": "processed", "processed_at": now_utc()}},
        )
    except Exception as exc:
        logger.exception("Stripe handler error for event %s: %s", event_id, exc)
        # Remove the idempotency claim so Stripe's next delivery can process the event.
        await db.stripe_events.delete_one({"_id": event_id})
        if OPS_ALERT_EMAIL:
            await send_email(
                OPS_ALERT_EMAIL,
                "Alerta: webhook de Stripe fallido",
                f"<p>El evento <strong>{event_id}</strong> ({parsed.get('type', 'unknown')}) no pudo procesarse. "
                "Stripe recibirá un error y deberá reintentarlo. Revisa los logs de producción.</p>",
            )
        raise HTTPException(500, "Stripe event processing failed")
    return {"received": True}


@api_router.get("/auth/invite/{token}")
async def check_invite(token: str):
    invite = await db.invites.find_one({"_id": token})
    if not invite:
        raise HTTPException(404, "Invite not found")
    if invite.get("consumed_at"):
        raise HTTPException(400, "Invite already used")
    exp = ensure_utc(invite.get("expires_at"))
    if exp and exp < now_utc():
        raise HTTPException(400, "Invite expired")
    return {"email": invite["email"], "valid": True}


@api_router.post("/auth/accept-invite", response_model=AuthResponse)
async def accept_invite(payload: AcceptInviteIn, response: Response, request: Request):
    await check_api_rate_limit(request, "accept-invite", limit=10, window_seconds=3600)
    invite = await db.invites.find_one({"_id": payload.token})
    if not invite or invite.get("consumed_at"):
        raise HTTPException(400, "Invalid or used invite")
    exp = ensure_utc(invite.get("expires_at"))
    if exp and exp < now_utc():
        raise HTTPException(400, "Invite expired")
    user = await db.users.find_one({"_id": ObjectId(invite["user_id"])})
    if not user:
        raise HTTPException(404, "Account not found")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(payload.password), "updated_at": now_utc()}},
    )
    await db.invites.update_one({"_id": payload.token}, {"$set": {"consumed_at": now_utc()}})
    user = await db.users.find_one({"_id": user["_id"]})
    token = create_access_token(str(user["_id"]), user["email"])
    set_auth_cookies(response, token)
    return AuthResponse(access_token=token, user=UserPublic(**serialize_user(user)))


@api_router.post("/auth/password-reset/request")
async def request_password_reset(payload: PasswordResetRequest, request: Request):
    await check_api_rate_limit(request, "password-reset", limit=5, window_seconds=3600)
    email = payload.email.lower().strip()
    logger.info("[password-reset:request] email=%s", email)
    user = await db.users.find_one({"email": email})
    if not user:
        logger.info("[password-reset:user-not-found] email=%s collection=users", email)
        return {
            "ok": True,
            "message": "If an account exists for that email, a reset link has been sent.",
        }

    user_id = str(user["_id"])
    logger.info(
        "[password-reset:user-found] email=%s user_id=%s role=%s membership_status=%s",
        email,
        user_id,
        user.get("role"),
        user.get("membership_status"),
    )
    token = await _create_password_reset(user_id, email)
    logger.info(
        "[password-reset:send-start] email=%s user_id=%s token_digest=%s",
        email,
        user_id,
        hashlib.sha256(token.encode("utf-8")).hexdigest()[:12],
    )
    try:
        response = await _send_password_reset_email(email, user.get("name", ""), token)
        logger.info("[password-reset:send-complete] email=%s user_id=%s response=%s", email, user_id, response)
    except Exception as e:
        logger.exception("password reset email failed for %s: %s", email, e)
    return {
        "ok": True,
        "message": "If an account exists for that email, a reset link has been sent.",
    }


@api_router.get("/auth/password-reset/{token}")
async def check_password_reset(token: str):
    reset = await db.password_resets.find_one({"_id": token})
    if not reset:
        raise HTTPException(404, "Reset link not found")
    if reset.get("consumed_at"):
        raise HTTPException(400, "Reset link already used")
    exp = ensure_utc(reset.get("expires_at"))
    if exp and exp < now_utc():
        raise HTTPException(400, "Reset link expired")
    return {"email": reset["email"], "valid": True}


@api_router.post("/auth/password-reset/confirm")
async def confirm_password_reset(payload: PasswordResetConfirm):
    reset = await db.password_resets.find_one({"_id": payload.token})
    if not reset or reset.get("consumed_at"):
        raise HTTPException(400, "Invalid or used reset link")
    exp = ensure_utc(reset.get("expires_at"))
    if exp and exp < now_utc():
        raise HTTPException(400, "Reset link expired")
    user = await db.users.find_one({"_id": ObjectId(reset["user_id"])})
    if not user:
        raise HTTPException(404, "Account not found")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(payload.password), "updated_at": now_utc()}},
    )
    await db.password_resets.update_one({"_id": payload.token}, {"$set": {"consumed_at": now_utc()}})
    await db.login_attempts.delete_one({"_id": f"login:{reset['email'].lower().strip()}"})
    return {"ok": True}


@api_router.get("/membership/config")
async def membership_config():
    """Public config for the access-denied screen and other UI surfaces."""
    return {
        "framer_url": FRAMER_URL,
        # Never expose a checkout link without the price and cadence beside it.
        "payment_link_url": PAYMENT_LINK_URL if MEMBERSHIP_PRICE_DISPLAY and MEMBERSHIP_BILLING_INTERVAL else "",
        "price_display": MEMBERSHIP_PRICE_DISPLAY,
        "billing_interval": MEMBERSHIP_BILLING_INTERVAL,
        "support_email": SUPPORT_EMAIL,
    }


# ---------------- Admin: members ----------------
@api_router.get("/admin/members")
async def admin_list_members(
    current_user: dict = Depends(require_admin),
    q: Optional[str] = None,
    status: Optional[str] = None,
):
    query: dict = {}
    if status == "active":
        query["$or"] = [
            {"membership_status": MEMBERSHIP_ACTIVE},
            {
                "$and": [
                    {"membership_status": {"$in": [MEMBERSHIP_PAST_DUE, MEMBERSHIP_CANCELED]}},
                    {"current_period_end": {"$gte": now_utc()}},
                ],
            },
            {"complimentary": True},
            {"role": "admin"},
        ]
    elif status == "inactive":
        query["$and"] = [
            {"role": {"$ne": "admin"}},
            {"complimentary": {"$ne": True}},
            {"membership_status": {"$in": [MEMBERSHIP_PENDING, MEMBERSHIP_EXPIRED]}},
        ]
    if q:
        regex = {"$regex": re.escape(q), "$options": "i"}
        existing = query.pop("$and", [])
        existing.append({"$or": [{"email": regex}, {"name": regex}]})
        query["$and"] = existing
    docs = await db.users.find(query).sort("created_at", -1).limit(500).to_list(500)
    refreshed = [await refresh_membership_state(d) for d in docs]
    return [serialize_user(d) for d in refreshed]


@api_router.put("/admin/members/{user_id}")
async def admin_update_member(
    user_id: str,
    payload: AdminMemberAction,
    current_user: dict = Depends(require_admin),
):
    updates = {"updated_at": now_utc()}
    if payload.complimentary is not None:
        updates["complimentary"] = payload.complimentary
    if payload.notes is not None:
        updates["admin_notes"] = payload.notes
    result = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Member not found")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    return serialize_user(user)


@api_router.post("/admin/members/{user_id}/revoke")
async def admin_revoke_member(user_id: str, current_user: dict = Depends(require_admin)):
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "membership_status": MEMBERSHIP_EXPIRED,
            "subscription_status": MEMBERSHIP_CANCELED,
            "complimentary": False,
            "membership_inactive_reason": "admin_revoked",
            "current_period_end": now_utc(),
            "updated_at": now_utc(),
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Member not found")
    return {"ok": True}


@api_router.post("/admin/members/{user_id}/resend-invite")
async def admin_resend_invite(user_id: str, current_user: dict = Depends(require_admin)):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "Member not found")
    token = await _create_invite(str(user["_id"]), user["email"])
    try:
        await _send_welcome_email(user["email"], user.get("name", ""), token)
    except Exception as e:
        logger.error("resend invite failed: %s", e)
    link = f"{PUBLIC_URL}/accept-invite?token={token}" if PUBLIC_URL else f"/accept-invite?token={token}"
    return {
        "ok": True,
        "invite_link": link,
        "email_sent": os.environ.get("EMAILS_ENABLED", "false").lower() == "true",
    }


@api_router.post("/admin/members/{user_id}/invite-link")
async def admin_invite_link(user_id: str, current_user: dict = Depends(require_admin)):
    """Generates a fresh invite token without sending email. Use to share manually."""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "Member not found")
    token = await _create_invite(str(user["_id"]), user["email"])
    link = f"{PUBLIC_URL}/accept-invite?token={token}" if PUBLIC_URL else f"/accept-invite?token={token}"
    return {"invite_link": link, "expires_in_days": INVITE_TOKEN_TTL_DAYS}


# ---------------- Billing portal ----------------
@api_router.post("/billing/portal")
async def billing_portal(current_user: dict = Depends(get_current_user)):
    """Creates a Stripe Customer Portal session for the signed-in member."""
    if not stripe.api_key or stripe.api_key in ("", "sk_REMOVED"):
        raise HTTPException(503, "Billing portal is not configured. Set a real STRIPE_API_KEY.")
    raw = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    customer_id = (raw or {}).get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(400, "No subscription on file for this account.")
    return_path = "/settings" if current_user.get("has_access") else "/access-denied?billing=returned"
    return_url = f"{PUBLIC_URL}{return_path}" if PUBLIC_URL else return_path
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return {"url": session.url}
    except stripe.error.StripeError as e:
        logger.error("Stripe portal create failed: %s", e)
        raise HTTPException(502, "Could not open the billing portal. Please try again.")


# ---------------- Admin: test email ----------------
@api_router.post("/admin/email/test")
async def admin_email_test(current_user: dict = Depends(require_admin)):
    """Sends a small test email to the current admin to verify Resend delivery."""
    subject = "Hampton Crest Academy · Email delivery test"
    html = _digest_html(
        title="Email delivery test",
        summary="If you can read this, Resend is wired up and the verified sender domain is delivering correctly.",
        category="Operations",
        content_type_label="System Test",
        link=PUBLIC_URL or "#",
    )
    result = await send_email(current_user["email"], subject, html)
    return {
        "sent_to": current_user["email"],
        "emails_enabled": os.environ.get("EMAILS_ENABLED", "false").lower() == "true",
        "sender": os.environ.get("SENDER_EMAIL", ""),
        "resend_response": result,
    }


# ---------------- Lifecycle ----------------
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "").lower().strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    force_password_reset = os.environ.get("ADMIN_FORCE_PASSWORD_RESET", "false").lower() == "true"
    if not admin_email or not admin_password:
        logger.warning("Admin bootstrap skipped; set ADMIN_EMAIL and ADMIN_PASSWORD to enable it.")
        return

    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Hampton Crest Admin",
            "role": "admin",
            "created_at": now_utc(),
            "totp_enabled": False,
            "email_digest_opt_in": True,
            "membership_status": MEMBERSHIP_ACTIVE,
            "subscription_status": "admin",
            "complimentary": True,
        })
        logger.info("Seeded admin user %s", admin_email)
    else:
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {
                "name": existing.get("name") or "Hampton Crest Admin",
                "role": "admin",
                "membership_status": MEMBERSHIP_ACTIVE,
                "subscription_status": "admin",
                "complimentary": True,
                "totp_enabled": bool(existing.get("totp_enabled", False)),
                "email_digest_opt_in": existing.get("email_digest_opt_in", True),
                "updated_at": now_utc(),
                **({"password_hash": hash_password(admin_password)} if force_password_reset else {}),
            }},
        )
        if force_password_reset:
            logger.warning("Applied one-time administrator password recovery for %s", admin_email)
        # Existing credentials are unchanged unless ADMIN_FORCE_PASSWORD_RESET is explicitly enabled.


async def seed_test_member():
    """Optionally seed a complimentary test member for non-production review."""
    if os.environ.get("ENABLE_TEST_MEMBER_SEED", "false").lower() != "true":
        logger.info("Test member seed disabled.")
        return

    email = os.environ.get("TEST_MEMBER_EMAIL", "").lower().strip()
    password = os.environ.get("TEST_MEMBER_PASSWORD", "")
    name = os.environ.get("TEST_MEMBER_NAME", "Miembro de Prueba")
    if not email or not password:
        logger.warning("Test member seed skipped; set TEST_MEMBER_EMAIL and TEST_MEMBER_PASSWORD to enable it.")
        return

    existing = await db.users.find_one({"email": email})
    base_fields = {
        "name": name,
        "role": "member",
        "complimentary": True,
        "membership_status": MEMBERSHIP_ACTIVE,
        "subscription_status": "complimentary",
        "email_digest_opt_in": True,
        "totp_enabled": False,
        "updated_at": now_utc(),
    }
    if existing is None:
        await db.users.insert_one({
            "email": email,
            "password_hash": hash_password(password),
            "created_at": now_utc(),
            **base_fields,
        })
        logger.info("Seeded test member %s", email)
    else:
        # Always reset password + complimentary flag so the test account is reliably usable
        await db.users.update_one(
            {"email": email},
            {"$set": {"password_hash": hash_password(password), **base_fields}},
        )
        logger.info("Refreshed test member %s", email)


async def runtime_bootstrap():
    global _runtime_bootstrap_done, _runtime_bootstrap_error
    if _runtime_bootstrap_done:
        return
    async with _runtime_bootstrap_lock:
        if _runtime_bootstrap_done:
            return
        try:
            await _runtime_bootstrap()
            _runtime_bootstrap_error = None
            _runtime_bootstrap_done = True
        except Exception as e:
            _runtime_bootstrap_error = str(e)
            logger.exception("runtime bootstrap failed")


async def _runtime_bootstrap():
    ensure_database_configured()
    await db.users.create_index("email", unique=True)
    await db.research_notes.create_index([("status", 1), ("created_at", -1)])
    await db.education_modules.create_index([("status", 1), ("order_index", 1)])
    await db.monthly_reports.create_index([("period", -1)])
    await db.companies.create_index("ticker", unique=True)
    await db.bookmarks.create_index([("user_id", 1), ("content_type", 1), ("content_id", 1)], unique=True)
    await db.login_attempts.create_index("locked_until", expireAfterSeconds=60 * 60 * 24)
    await db.api_rate_limits.create_index("expires_at", expireAfterSeconds=0)
    await db.invites.create_index("expires_at", expireAfterSeconds=60 * 60 * 24 * 14)
    await db.password_resets.create_index("expires_at", expireAfterSeconds=60 * 60 * 24)
    await db.stripe_events.create_index("received_at", expireAfterSeconds=60 * 60 * 24 * 90)
    await seed_admin()
    await seed_test_member()
    # Init storage but don't fail startup if down
    try:
        await asyncio.to_thread(_init_storage)
    except Exception as e:
        logger.warning("storage init at startup failed: %s", e)


@app.on_event("startup")
async def on_startup():
    await runtime_bootstrap()


@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()


# ---------------- App wiring ----------------
# Register modular routers (see backend/routers/ + ARCHITECTURE.md)
from routers.search import register_search_routes  # noqa: E402
from routers.chat import register_chat_routes  # noqa: E402
from routers.valuation import register_valuation_routes  # noqa: E402

search_router = register_search_routes(
    db=db,
    require_member=require_member,
    serialize_doc=serialize_doc,
)
app.include_router(search_router)

chat_router = register_chat_routes(
    db=db,
    require_member=require_member,
)
app.include_router(chat_router)

valuation_router = register_valuation_routes(
    db=db,
    require_member=require_member,
)
app.include_router(valuation_router)

app.include_router(api_router)


@app.middleware("http")
async def ensure_bootstrap_middleware(request: Request, call_next):
    csrf_exempt = {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/2fa/verify",
        "/api/auth/accept-invite",
        "/api/auth/password-reset/request",
        "/api/auth/password-reset/confirm",
        "/api/webhook/stripe",
    }
    bearer_auth = request.headers.get("authorization", "").lower().startswith("bearer ")
    if (
        request.method not in {"GET", "HEAD", "OPTIONS"}
        and request.url.path.startswith("/api/")
        and request.url.path not in csrf_exempt
        and request.cookies.get("hc_access_token")
        and not bearer_auth
    ):
        cookie_token = request.cookies.get("hc_csrf_token", "")
        header_token = request.headers.get("x-csrf-token", "")
        if not cookie_token or not header_token or not secrets.compare_digest(cookie_token, header_token):
            return JSONResponse(status_code=403, content={"detail": "csrf_validation_failed"})
    if request.url.path not in {"/api/health", "/api/", "/api/membership/config"}:
        await runtime_bootstrap()
        if _runtime_bootstrap_error and not _runtime_bootstrap_done:
            return JSONResponse(
                status_code=503,
                content={"detail": "service_unavailable"},
            )
    return await call_next(request)


configured_origins = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "").split(",") if origin.strip()]
if not configured_origins:
    configured_origins = ["http://localhost:3000", "http://localhost:5173"]
for required_origin in (PUBLIC_URL, DEFAULT_PUBLIC_URL):
    if required_origin not in configured_origins:
        configured_origins.append(required_origin)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=configured_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
)
