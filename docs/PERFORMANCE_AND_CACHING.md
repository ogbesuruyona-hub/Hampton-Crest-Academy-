# Performance and caching policy

## Request model

- `/api/dashboard-summary` returns counts and the small content slices used by the member dashboard. It does not return full collections.
- Course progress loads independently so a slower progress calculation cannot block books, research, reports, or company counts.
- Read requests are deduplicated in memory per browser session. Private API responses remain `private, no-store` at the edge.
- Books, reports, research, education, companies, and members accept bounded `page` and `page_size` parameters. The total is returned in `X-Total-Count`.

## Cache classes

| Resource | Policy | Reason |
| --- | --- | --- |
| Hashed JS, CSS and optimized images under `/assets/` | `public, max-age=31536000, immutable` | The URL changes when the bytes change. |
| HTML/app shell | `public, max-age=0, must-revalidate` | Deployments must become visible without serving stale routing code. |
| `/api/*` member and admin responses | `private, no-store` | Responses can contain membership, progress, or financial education data. |
| Private PDFs | Short-lived signed URL (5 minutes) | Buckets stay private; links are never cached publicly. |

Cloudflare must respect origin cache headers and must not add a cache-everything rule for `/api/*`, authenticated HTML, signed storage URLs, or `/admin/*`.

## Documents

PDFs stay in the private Supabase bucket. The open endpoint produces a short-lived signed redirect. Supabase range requests are required so PDF viewers can request only the needed byte ranges. Admin uploaders warn at 10 MB while retaining the existing 50 MB book and 25 MB report limits.
# September 2026 remediation

- The application request path no longer creates MongoDB indexes, applies data migrations, seeds users or initializes legacy storage. Run `cd backend && python -m scripts.release_setup` as a controlled release step.
- Global search executes the five bounded collection queries concurrently. It intentionally retains escaped partial-match regex semantics; ordinary MongoDB text indexes are not added because they would change partial matching and ranking behavior rather than accelerate the current unanchored regex queries.
- Bookmark hydration groups IDs by collection and performs at most one `$in` query per content type, preserving the saved order in memory.
- Member Directory returns 25 records by default, permits at most 100, and exposes the total through `X-Total-Count`.
- Interactive list filters use a 350 ms debounce to avoid a request per keystroke.
