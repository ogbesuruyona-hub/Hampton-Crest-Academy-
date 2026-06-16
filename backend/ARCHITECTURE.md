# Hampton Crest Academy - Backend Architecture

## Current Layout

```text
backend/
├── server.py              # Main FastAPI app, models, helpers, all legacy routes
├── routers/
│   ├── __init__.py
│   └── search.py          # Extracted: global search across collections
├── scripts/
│   └── cleanup_test_users.py
├── tests/
│   ├── test_auth.py       # Auth + 2FA + lockout
│   └── test_p2.py         # Stripe webhook + gating + invites
├── requirements.txt
└── .env
```

## Configuration Notes

- Payment CTAs are configured through `PAYMENT_LINK_URL` on the backend and exposed publicly by `GET /api/membership/config`.
- Stripe secrets such as `STRIPE_API_KEY` and `STRIPE_WEBHOOK_SECRET` must stay only in backend environment variables.
- Admin bootstrap is environment-driven only. Set both `ADMIN_EMAIL` and `ADMIN_PASSWORD` to create or refresh an admin account.
- Test member seeding is disabled by default. It only runs when `ENABLE_TEST_MEMBER_SEED=true` and `TEST_MEMBER_EMAIL` plus `TEST_MEMBER_PASSWORD` are set.
- Demo/test users can be cleaned manually with `backend/scripts/cleanup_test_users.py`; no users are deleted during app startup.

## Modularization Strategy (P3 backlog)

`server.py` has grown to a large monolith. Goal: split into single-responsibility
modules without breaking the existing API contract or tests.

### Pattern: dependency-injected routers

Each `routers/<domain>.py` exports a `register_<domain>_routes(*, db, deps...)`
factory. `server.py` keeps owning the singletons (`db`, `stripe.api_key`, JWT
helpers, seeders) and calls each factory at startup time.

Example (`routers/search.py` already follows this):

```python
# server.py
from routers.search import register_search_routes
register_search_routes(db=db, require_member=require_member, serialize_doc=serialize_doc)
app.include_router(search_router)
```

### Suggested split order

1. **search** - done; pure read-side, easiest to extract
2. **uploads** - PDF endpoints are self-contained
3. **billing** - Stripe webhook + portal; no other routes depend on its internals
4. **members** - directory + profile + admin members roster
5. **content** - research / education / reports / companies / books / bookmarks
6. **auth** - touches everything via dependencies; extract only after all the above

For each step, run `pytest backend/tests/` and the testing agent before moving on.

### Shared helpers stay in `server.py` for now

- `db` (Mongo client)
- `now_utc()`, `serialize_user()`, `serialize_doc()`
- `hash_password()`, `verify_password()`, JWT encode/decode
- `get_current_user`, `require_admin`, `require_member` dependencies
- Bootstrap helpers (`seed_admin`, `seed_test_member`)

When all routes have moved out, this file can shrink to configuration, app
construction, CORS, and startup hooks.

## Why not refactor it all now?

The current monolithic `server.py` works and has an established test suite.
Refactoring it as a single change is high-risk for zero user-visible gain. The
pattern above lets us extract one router per session, validate with tests, and
arrive at the target structure incrementally.
