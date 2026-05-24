# Hampton Crest Academy — PRD

## Problem Statement
Premium private investment academy web app for paying members. Luxury institutional finance aesthetic (BlackRock / Bloomberg / Goldman private wealth). Core app structure only — no mock data.

## User Choices
- Auth: JWT email/password
- Palette: Midnight navy with platinum/ivory accents (gold reserved for brand)
- Typography: All-sans (Manrope), refined and tight
- Sidebar: Collapsible on desktop, drawer on mobile
- Brand: Heraldic crest logo (navy + gold)

## Personas
- **Charter Member** — paying member who consumes research, education, and reports.
- **Steward / Admin** — internal team that publishes content (uses same UI today).

## Core Requirements (static)
1. Members-only access (JWT)
2. Premium dark institutional UI (no SaaS / no crypto aesthetic)
3. Left sidebar: Dashboard · Research Library · Investment Education · Monthly Reports · Company Analysis · Saved Resources · Settings
4. Pages: Dashboard, Research Library, Investment Education, Monthly Reports, Company Analysis, Member Profile, Saved Resources, Settings
5. Responsive (mobile drawer + collapsible desktop sidebar)
6. Clean empty-state pattern (no fabricated data)

## What's Been Implemented (2026-05-24)
- FastAPI auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/health`
- Bcrypt password hashing, PyJWT access tokens (24h), Bearer header auth
- Admin seeding on startup (`admin@hamptoncrest.com` / `Hampton#2026`)
- Unique-email Mongo index
- React app: AuthProvider, ProtectedRoute, AppLayout (desktop sidebar + mobile sheet drawer + topbar), 9 routes
- Login screen: split layout, branded panel with architectural backdrop, register/login modes
- All pages with PageHeader + EmptyState pattern, refined typography (Manrope), sparse gold rule dividers
- Institutional dark theme tokens in CSS variables, sharp borders, no purple gradients, no SaaS aesthetic
- data-testid coverage on all interactive elements
- Tests: 16/16 backend pytest, 18/18 frontend Playwright

## Prioritized Backlog
### P0 — Next session
- Content models (research notes, education modules, monthly reports, companies, saved bookmarks) with admin authoring endpoints
- Member roles + paid-tier gating

### P1
- File/PDF upload for reports (object storage)
- Email notifications for new monthly reports
- Rich-text editor for analyst notes
- Search across content
- 2FA + brute-force lockout (currently deferred per MVP)

### P2
- Member directory + private discussion
- Payment integration (Stripe) for membership renewals
- Analyst commentary feed on individual companies
- Calendar integration for live sessions

## Test Credentials
See `/app/memory/test_credentials.md`
