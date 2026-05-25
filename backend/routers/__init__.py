"""Hampton Crest Academy — Router package.

Each module here owns the route logic for a single domain. server.py wires
shared dependencies (the Mongo client, auth helpers, serializers) into each
router via a `register_*_routes(...)` factory function.

Current modules:
- `search.py` — global full-text search across books/research/education/reports/companies

Planned (P3 backlog):
- `auth.py` — login / register / 2FA / password reset / brute-force lockout
- `content.py` — CRUD for research, education, reports, companies, books, bookmarks
- `members.py` — directory, profile, admin members roster
- `billing.py` — Stripe webhook + customer portal
- `uploads.py` — PDF upload + signed file delivery
"""
