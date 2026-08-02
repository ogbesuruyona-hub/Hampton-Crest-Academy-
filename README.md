# Hampton Crest Academy

## Payment Configuration

Membership payment buttons use one public backend source of truth:

- Frontend calls `GET /api/membership/config`.
- Backend returns `payment_link_url` from `PAYMENT_LINK_URL`.
- If `PAYMENT_LINK_URL` is empty, the frontend shows a Spanish payment-not-configured message.

Set the backend API base URL in the frontend environment:

```env
REACT_APP_BACKEND_URL=""
```

Set payment and Stripe values only in backend environment/deployment secrets:

```env
PAYMENT_LINK_URL=""
STRIPE_API_KEY=""
STRIPE_WEBHOOK_SECRET=""
```

Do not put Stripe secret keys in frontend environment variables.

## Vercel Production Deployment

This repository is configured for a combined Vercel deployment:

- `/api/*` routes to `backend/server.py`.
- React static assets are built from `frontend/package.json`.
- React deep links fall back to `frontend/build/index.html`.

For same-origin Vercel deployment, `REACT_APP_BACKEND_URL` can be empty because the frontend calls `/api`.

Required backend environment variables:

```env
MONGO_URL=""
DB_NAME=""
JWT_SECRET=""
CORS_ORIGINS=""
APP_PUBLIC_URL=""
PAYMENT_LINK_URL=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
OPENAI_API_KEY=""
RESEND_API_KEY=""
SENDER_EMAIL=""
STRIPE_API_KEY=""
STRIPE_WEBHOOK_SECRET=""
FMP_API_KEY=""
```

Optional backend variables:

```env
FRAMER_URL=""
SENDER_NAME=""
APP_NAME=""
EMAILS_ENABLED=""
ENABLE_TEST_MEMBER_SEED="false"
```

Production checks before deploying:

```bash
python -m py_compile backend/server.py backend/routers/chat.py backend/routers/valuation.py backend/scripts/cleanup_test_users.py
cd frontend && npm run build
```

## Admin Bootstrap

No public/default admin account is created unless both values are configured:

```env
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
```

Passwords are hashed before storage and must never be printed or exposed by API responses.

## Test/Demo User Cleanup

Known test/demo users can be reviewed and deleted with:

```bash
python backend/scripts/cleanup_test_users.py
```

Use `--dry-run` to preview and `--yes` to skip the confirmation prompt:

```bash
python backend/scripts/cleanup_test_users.py --dry-run
python backend/scripts/cleanup_test_users.py --yes
```

The script targets only known demo/test email patterns and never prints password hashes.
