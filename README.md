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
