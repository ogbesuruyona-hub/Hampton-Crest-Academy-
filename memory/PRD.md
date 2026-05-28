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

## P1 Complete (2026-05-24)
- **PDF uploads on Monthly Reports** via Emergent object storage — admin-only POST `/api/uploads/report-pdf`, 25 MB cap, PDF-only validation; authenticated `/api/files/{path}` serve (Bearer or `?auth=token` for browser links); soft-delete on report removal
- **TipTap rich-text editor** for research/education/reports body + company thesis body + company memo body (bold/italic/strike, H2/H3, lists, blockquote, code block, links, undo/redo). HTML output is rendered via DOMPurify-sanitised `<RichContent>` on detail views
- **Resend email digests** (HTML institutional template with logo, gold rule, CTA) on every new published content (research/education/reports) via FastAPI BackgroundTasks; opt-in toggle on Settings (default ON); per-user `email_digest_opt_in` field
- **TOTP 2FA** (optional, opt-in): setup with QR + manual key + 10 backup codes; verify-setup, login challenge with `temp_token`, backup-code support; disable requires password + valid code; `/auth/2fa/status` reads raw doc; Settings UI shows security state
- **Brute-force lockout**: 5 failed attempts → 15-min lockout, email-only key (proxy-safe), `ensure_utc()` helper normalises Mongo-returned naive datetimes
- Tests: **82/82 backend pytest passing** (16 auth + 39 content/bookmark + 27 P1); full frontend E2E (2FA enable → login challenge → backup codes → disable; TipTap body persisted as HTML; PDF upload + report detail render)

## P2 In Progress / Complete (2026-05-24 → 2026-05-25)
- **Stripe webhook automation**: `POST /api/webhook/stripe` verifies signature, idempotency via `stripe_events` collection, handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- **Membership model**: `users.membership_status` (active/inactive), `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`, `complimentary` flag; `has_access(user)` = admin OR complimentary OR active
- **Access gating**: login (and 2FA verify) return `403 membership_inactive` for users without access; frontend redirects to `/access-denied`
- **Invite flow**: on first Stripe activation, backend creates user + invite token, sends "Set your password" email via Resend (welcome template). `/api/auth/invite/{token}` validates, `/api/auth/accept-invite` consumes token and issues access_token
- **Admin members panel** (`/admin/members`): list with status filter + search, mark complimentary, revoke access (sets inactive), resend invite. KPIs for active / inactive / admin counts.
- **Access Denied page** (`/access-denied`): institutional dark, CTA to Framer (`FRAMER_URL` from env)
- **Accept Invite page** (`/accept-invite?token=...`): password + confirm, auto-login on success
- **Sidebar**: new admin-only "Steward → Members" section visible only to `role=admin`
- **Member Directory** (2026-05-25): `GET /api/directory` (active members + admin, gated by `require_member`, `q` search on name/email/phone). Frontend `/directory` lists every active member with mailto + tel links.
- **Profile editing** (2026-05-25): `PUT /api/auth/profile` lets a member update `name` and `phone`. `UserPublic` exposes `phone`. MemberProfile page has Edit/Save/Cancel.
- **Resend verified domain** (2026-05-25): `SENDER_EMAIL=members@investorhamptoncrest.com`, `EMAILS_ENABLED=true`. Verified end-to-end via `POST /api/admin/email/test` (Resend id returned, 200 OK).
- **Stripe Customer Portal** (2026-05-25): `POST /api/billing/portal` creates a Stripe billing_portal.Session and returns `{url}`. Settings has "Billing → Membership" panel with `Manage Subscription` button (disabled for admin/complimentary). LIVE key configured (`acct_1TQqoJA2p7IG5Aco`); user activated the portal config in Stripe dashboard.

## 2026-05-25 — Library + Branding + Session UX
- **Logo branding**: removed image logo from Sidebar and Login (desktop + mobile). Brand is now text-only ("HAMPTON CREST / ACADEMY") so it sits cleanly on the navy background without the off-color square.
- **Login UX**: form has `autoComplete="off"`; email/password/name fields are explicitly cleared after every submit attempt (success or failure). Combined with React state being re-initialised when Login remounts on logout, credentials never persist across a sign-out.

## 2026-05-25 — Edit control, test member, Spanish UI
- **Books Library** (`/api/books` CRUD): opens externally in new tab, bookmarks extended to support books, transparent crest logo restored with `mix-blend-mode: screen` on navy.
- **Inline edit/delete on all content cards**: `ContentCard` renders pencil/trash icons for admins on Research, Education, Reports, Companies. Books already had inline actions. Confirmation modal in Spanish.
- **Test member seeded automatically**: `seed_test_member()` runs at backend startup → creates/refreshes `prueba@hamptoncrest.com` / `Prueba#2026` with `complimentary=true, membership_status=active`. Admins can log in as this account to review the member-side experience.
- **Full Spanish UI**: every user-facing string translated across Sidebar, Topbar, Login, Dashboard, Library, Education, Reports, Companies, Saved Resources, Settings, Member Profile, Member Directory, Admin Members, Access Denied, Accept Invite, Content Editor, Status Badge, Two-Factor dialogs, Empty State; dates now use `toLocaleDateString("es-ES")`. `CONTENT_TYPES` singulars/plurals + research/library/sector/track categories all in Spanish.

## 2026-05-25 — P3: Búsqueda, Landing público, Split de server.py (inicio)
- **Búsqueda global**: nuevo endpoint `GET /api/search?q=…` busca con regex case-insensitive en books, research, education, reports y companies (respeta filtro de status para no-admins). Frontend: `SearchResults` page en `/search?q=…` agrupada por sección. Topbar form ahora navega a `/search`. Búsqueda gated con `require_member`.
- **Landing público en `/`**: `PublicLanding.jsx` con hero institucional, 4 pilares de propuesta de valor, trust strip (acceso privado, círculo discreto, Stripe), CTAs a Stripe Payment Link y al sitio Framer. Usuarios sin sesión llegan a `/`, miembros pasan directo del login a `/dashboard`. La ruta `*` ahora redirige al landing (era `/dashboard`).
- **Modularización pragmática del backend**: nuevo directorio `/app/backend/routers/` con `search.py` extraído usando patrón de factory `register_search_routes(*, db, require_member, serialize_doc)`. Server.py inyecta las dependencias y monta el router. Documento `ARCHITECTURE.md` explica el patrón y la orden recomendado para extraer el resto (uploads → billing → members → content → auth). Tests existentes siguen pasando.

## 2026-05-28 — AI Chat Support (GPT-4o)
- **In-app chat assistant**: `routers/chat.py` exposes `POST /api/chat`, `GET /api/chat/history`, `DELETE /api/chat/history`. Uses **OpenAI GPT-4o** via the `emergentintegrations` library with the Universal Key already in `.env`.
- **System prompt en español**: asistente discreto de Hampton Crest Academy, tono institucional, áreas de ayuda definidas (navegación, conceptos financieros, recomendaciones de libros, dudas de membresía). Multi-turn con memoria por `session_id` persistida en `chat_messages` collection.
- **Frontend widget** (`ChatWidget.jsx`): burbuja flotante (abajo-derecha, encima del badge Made-with-Emergent), panel deslizable con header, área de mensajes con burbujas diferenciadas por rol, indicador "escribiendo…", botón reiniciar conversación, persistencia de `session_id` en `sessionStorage`. Visible solo para usuarios autenticados (montado en `AppLayout`).
- **Verificado**: respuesta multi-turn coherente ("¿Cómo activo 2FA?" → "Ajustes → Seguridad → Autenticación de Dos Factores"), reset borra historial server-side, sin token devuelve 401.

## Prioritized Backlog
### P2 — Remaining
- (none — all P2 features shipped)

### Out of scope (per user)
- Live session calendar (declined 2026-05-25)

### P3 / nice-to-haves
- Full-text search across content
- Public marketing landing page
- Mobile app shell (PWA)
- Server.py modular split (auth/content/uploads/2fa/directory)
- Analyst commentary timeline view

## Test Credentials
See `/app/memory/test_credentials.md`
