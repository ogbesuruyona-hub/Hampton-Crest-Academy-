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

## P0 Complete (2026-05-24)
- **Content models**: research_notes, education_modules, monthly_reports, companies, bookmarks — all in MongoDB with status/draft gating, indexes, search & filters
- **Admin authoring (admin role only)**: inline "New …" buttons on each list page open a Dialog editor. Plain-textarea body. Category (single) + tags (multi). Reports require YYYY-MM period.
- **Companies**: ticker (unique, 409 on duplicate), name, sector, status (covered/watching/exited), thesis summary + body, dynamic key_metrics list, embedded memo feed (admin can add/delete memos)
- **Detail views**: long-form reading layout for research/education/reports; rich detail page for companies with metrics side panel + memo feed
- **Universal bookmarks**: `/api/bookmarks` works for all 4 content types; `/saved` page with type filters
- **Dashboard**: live KPI counts, latest research feed, latest report card
- **Role gating**: admins see drafts and admin controls; members only see published items and cannot bookmark drafts
- Tests: 55/55 backend pytest (16 auth regression + 39 content/bookmark), all critical frontend flows green

## Prioritized Backlog
### P1 — Next session
- File/PDF upload for reports (object storage)
- Rich-text editor (TipTap) for analyst notes, replacing plain textarea
- Email digests for new monthly reports (Resend or SendGrid)
- 2FA + brute-force lockout

### P2
- Stripe-powered membership renewals (subscription + gated checkout)
- Member directory + private discussion
- Calendar integration for live sessions
- Analyst commentary feed across all content (timeline view)

### P3 / nice-to-haves
- Full-text search across content
- Public marketing landing page
- Mobile app shell (PWA)

## Test Credentials
See `/app/memory/test_credentials.md`
