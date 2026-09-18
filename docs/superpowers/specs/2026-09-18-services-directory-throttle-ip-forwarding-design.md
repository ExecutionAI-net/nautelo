# Design: trusted client-IP forwarding for the SSR → Django throttle hop

**Date:** 2026-09-18
**Status:** Approved for implementation
**Scope:** `backend/common/throttling.py`, `backend/config/settings/*.py`,
`frontend/src/lib/api/directory.ts` (+ a new internal-headers helper),
`.env.example` files, `.github/workflows/ci.yml`.

## 1. Problem

Phase 5's five public directory endpoints (`services_catalog`) share the
`services_directory` throttle scope (`60/min`), enforced by
`common.throttling.HashedIPScopedRateThrottle`. All of Phase 5's frontend
pages read this API via server-side rendering
(`frontend/src/app/services/professionals/page.tsx`, `.../[slug]/page.tsx`,
`.../[categorySlug]/page.tsx`, `sitemap.ts`), all `force-dynamic` /
`no-store`, all going through `directory.ts`'s `directoryFetch()`.

Because these are Node-to-Node requests from the Next.js server to Django,
Django's `REMOTE_ADDR` is the Next.js server's own IP for every visitor —
never the real visitor's IP. Every visitor's directory traffic collapses
into one shared 60/min bucket (effectively ~30 page loads/min, since a
combined page makes two backend calls), and the site will silently start
throttling real traffic the first time it gets meaningful visitors.

## 2. A second, pre-existing issue found during design

DRF's `SimpleRateThrottle.get_ident()` — the method
`HashedIPScopedRateThrottle` inherits from — behaves as follows when
`REST_FRAMEWORK["NUM_PROXIES"]` is unset (its default, and this project
never sets it):

```python
return ''.join(xff.split()) if xff else remote_addr
```

It trusts a client-supplied `X-Forwarded-For` header **verbatim**, with no
proxy validation, whenever one is present — completely ignoring
`REMOTE_ADDR`. Since every throttled endpoint in this project (`auth`,
`auth-refresh`, `taxonomy_search`, `public_listing_read`,
`services_directory`) is `AllowAny` and reachable directly from the public
internet, any anonymous client can already set an arbitrary
`X-Forwarded-For` value per request and get a fresh throttle bucket every
time — a complete, pre-existing throttle bypass, including for the `auth`
scope (10/min login attempts), enabling unthrottled credential stuffing.

This is fixed by the same change described below: `get_ident()` is
rewritten to never trust a client-supplied `X-Forwarded-For` at all, for
any scope. No caller's legitimate behavior regresses — nothing in this
project currently relies on that trust.

## 3. Approach

**Shared internal secret header**, validated with a constant-time compare,
chosen over an IP/network allowlist: this repo has no fixed production
reverse-proxy or internal-network topology yet (`docker-compose.yml` only
runs dev dependencies; CORS comments confirm frontend and backend are
separate origins with no proxy unifying them), so an IP-allowlist-based
trust boundary would be fragile and easy to misconfigure or silently break
across deployments. A shared secret is deployment-topology-independent.

## 4. Design

### 4.1 Backend

**Settings** (`backend/config/settings/base.py`), same pattern as
`CONTACT_HASH_SECRET`:

```python
INTERNAL_SERVICE_SECRET = env("INTERNAL_SERVICE_SECRET")
```

Required (no default) in `base.py`, exactly like `CONTACT_HASH_SECRET` and
`DJANGO_SECRET_KEY` — fails loud if unconfigured rather than silently
running with trust disabled. `.env.example` gets a `change-me-in-dev`
placeholder; `.github/workflows/ci.yml` gets a `ci-test-secret`-style line
alongside the existing `CONTACT_HASH_SECRET` entry.

**`backend/common/throttling.py`** — `get_ident()` rewritten so the
resolution order is: valid internal secret + forwarded IP present → use the
forwarded IP; otherwise → `REMOTE_ADDR`. `HTTP_X_FORWARDED_FOR` is never
consulted, closing §2's gap for every scope that uses this throttle class.

```python
INTERNAL_CLIENT_IP_HEADER = "HTTP_X_INTERNAL_CLIENT_IP"
INTERNAL_SERVICE_SECRET_HEADER = "HTTP_X_INTERNAL_SERVICE_SECRET"

class HashedIPScopedRateThrottle(ScopedRateThrottle):
    def get_ident(self, request):
        ident = self._resolve_raw_ident(request)
        if not ident:
            return ident
        return hmac.new(
            settings.CONTACT_HASH_SECRET.encode(), ident.encode(), hashlib.sha256,
        ).hexdigest()

    def _resolve_raw_ident(self, request):
        provided = request.META.get(INTERNAL_SERVICE_SECRET_HEADER, "")
        if provided and hmac.compare_digest(
            provided.encode(), settings.INTERNAL_SERVICE_SECRET.encode()
        ):
            forwarded_ip = request.META.get(INTERNAL_CLIENT_IP_HEADER, "").strip()
            if forwarded_ip:
                return forwarded_ip
        return request.META.get("REMOTE_ADDR")
```

Deliberately does **not** call `super().get_ident()` — that would
reintroduce the raw-XFF trust from §2. `hmac.compare_digest` (not `==`) for
the secret comparison, matching the project's existing HMAC usage for
`CONTACT_HASH_SECRET`. Hashing happens after resolution, same as today, so
`test_the_cache_key_never_contains_the_raw_ip` keeps its guarantee
regardless of which IP source won.

No new throttle class needed — this is a single shared fix, and every
current caller (`auth`, `auth-refresh`, `taxonomy_search`,
`public_listing_read`, `services_directory`) benefits identically.

### 4.2 Frontend

New helper, `frontend/src/lib/api/internal-headers.ts`:

```typescript
import { headers } from "next/headers";

// headers() throws outside a request-scoped render (e.g. a route that
// hasn't opted into dynamic rendering); callers must never break a page
// render over a best-effort header, so failure here just means "no IP to
// forward" — directoryFetch() falls back to Django's REMOTE_ADDR path,
// which is always safe, just coarser-grained.
export async function forwardedClientIp(): Promise<string | undefined> {
  try {
    const store = await headers();
    const xff = store.get("x-forwarded-for");
    return xff?.split(",")[0]?.trim() || undefined;
  } catch {
    return undefined;
  }
}
```

`directoryFetch()` in `directory.ts` calls this internally and adds the two
headers to its existing `fetch()` call — **no signature change**, so
`fetchServiceCategories`, `fetchServiceCategory`, `fetchProfessionals`,
`fetchProfessional`, `resolveLegacyProfessional`, and every Task 14-16 page
that calls them are untouched:

```typescript
export async function directoryFetch<T>(path: string): Promise<T | null> {
  const ip = await forwardedClientIp();
  const response = await fetch(`${DIRECTORY_API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "X-Internal-Service-Secret": INTERNAL_SERVICE_SECRET,
      ...(ip ? { "X-Internal-Client-IP": ip } : {}),
    },
    cache: "no-store",
  });
  ...
}
```

`INTERNAL_SERVICE_SECRET` is read from `process.env.INTERNAL_SERVICE_SECRET`
— **not** `NEXT_PUBLIC_`-prefixed, so Next.js never inlines it into a
client bundle. `directoryFetch` already only runs in server components
(`force-dynamic`/`no-store`), so this stays server-only. `.env.local.example`
gets a matching entry with the same dev placeholder value used on the
backend side.

### 4.3 Data flow

```
Browser (real visitor IP) ──▶ Next.js server component (SSR)
    reads incoming request's `x-forwarded-for` via headers()
    │
    ▼
directoryFetch() ──▶ Django
    X-Internal-Service-Secret: <shared secret>
    X-Internal-Client-IP: <visitor IP, if known>
    │
    ▼
HashedIPScopedRateThrottle.get_ident()
    secret valid + IP present → HMAC(visitor IP)   [per-visitor bucket]
    secret invalid/missing, or no IP                 → HMAC(REMOTE_ADDR)  [today's behavior]
```

### 4.4 Known limitation (explicitly out of scope)

This fix secures the Next.js → Django hop only. Whether `x-forwarded-for`
reaching Next.js itself is trustworthy depends on whatever fronts the
Next.js server in production (a CDN/load balancer/reverse proxy is assumed
per this design's approval) — that hop's own trust configuration
(equivalent to DRF's `NUM_PROXIES`) is not yet defined anywhere in this
repo, because no production topology is defined yet. If Next.js is ever
deployed directly exposed to the internet without such a fronting layer,
`x-forwarded-for` becomes visitor-spoofable at that hop. This is flagged
here rather than silently assumed away; it is not this task's fix target.

## 5. Error handling

| Condition | Behavior |
|---|---|
| No internal secret configured (`INTERNAL_SERVICE_SECRET` unset) | Django fails to start (`env()` has no default) — same fail-loud pattern as `CONTACT_HASH_SECRET`. |
| Secret present but wrong | Ignored; `get_ident()` falls back to `REMOTE_ADDR`. Request succeeds, throttled under the shared Next.js-server bucket (today's behavior — never worse). |
| Secret valid, no `X-Internal-Client-IP` sent (e.g. `headers()` unavailable) | Falls back to `REMOTE_ADDR`. |
| Any client-supplied `X-Forwarded-For` with no valid secret | Ignored entirely; never reaches `get_ident()`'s resolution. |

## 6. Testing plan

**Backend** (`backend/common/tests/test_throttling.py`):
- Valid secret + `X-Internal-Client-IP` → `get_ident()` hashes the forwarded
  IP, not `REMOTE_ADDR`.
- Invalid/missing secret + a spoofed `X-Internal-Client-IP` → `get_ident()`
  hashes `REMOTE_ADDR`, proving the forwarded value is ignored.
- No secret, arbitrary `X-Forwarded-For` (the DRF-default vector from §2)
  → `get_ident()` hashes `REMOTE_ADDR`, not the XFF value — proves the
  global spoof gap is closed for every scope sharing this class.
- Existing `test_the_cache_key_never_contains_the_raw_ip` keeps passing
  unmodified.

**Frontend** (`frontend/src/lib/api/directory.test.ts` +
new `internal-headers.test.ts`):
- `forwardedClientIp()` returns the first `x-forwarded-for` entry when
  `next/headers` provides one.
- `forwardedClientIp()` returns `undefined` (never throws) when `headers()`
  throws.
- `directoryFetch()`'s outgoing `fetch()` call always carries
  `X-Internal-Service-Secret`, and carries `X-Internal-Client-IP` only when
  one is available.

## 7. Out of scope / YAGNI

- No new throttle class/variant — one shared fix in `get_ident()`.
- No IP-format validation on the forwarded value: it is HMAC-SHA256-hashed
  before use, so input length/shape can't affect cache-key size or storage.
- No change to any Task 14-16 page component — the fix is fully contained
  in `directoryFetch()` and the throttle class.
