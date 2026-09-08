# Security remediation — September 2026

## Premium membership boundary

All content reads for research, education, reports, companies, books, dashboard summary and bookmarks use `require_member`. A valid session with inactive membership receives HTTP 403 with `membership_inactive`; a missing or invalid session receives 401. Authentication/profile, membership configuration, checkout recovery, Stripe webhooks and the access-denied flow intentionally remain available without active membership.

## Upload boundary

Private document upload signatures require both a `.pdf` filename and `application/pdf`. Legacy multipart PDF uploads additionally verify the `%PDF-` signature. Signed cover uploads require a matching JPG/JPEG, PNG or WebP extension and MIME type. Because the browser sends signed uploads directly to Supabase, content-byte verification after a signed upload remains a separate hardening item; document buckets remain private.

The legacy `/api/files/*` endpoint remains member-protected but proxies the complete object and does not implement byte ranges. It is retained for previously published objects only. New books, lessons and reports use short-lived Supabase signed downloads, which preserve storage-level range support.

## Tiptap advisory

`GHSA-cp6q-959q-f8rh` affects `@tiptap/core` through 3.30.3: crafted `__proto__` attributes passed to `mergeAttributes()` may become executable DOM attributes. Academy currently uses Tiptap only in the administrator content editor, and published content is rendered through DOMPurify, which reduces exposure but does not remove the vulnerable dependency. The patched line requires Tiptap 3.30.4 or later; npm offers 3.31.3 as a semver-major upgrade from the current 2.x line. No major editor upgrade is included in this remediation. Plan: migrate the editor in an isolated branch, test stored documents and paste/import behavior, then upgrade all Tiptap packages together.

CI now blocks high or critical vulnerabilities in production dependencies. Development-only advisories remain reported separately and do not represent deployed runtime code.
