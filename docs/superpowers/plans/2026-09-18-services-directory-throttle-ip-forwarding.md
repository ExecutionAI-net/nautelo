# Trusted Client-IP Forwarding for the SSR → Django Throttle Hop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every real visitor to the `services_directory` public endpoints their own throttle budget during Next.js SSR, instead of every visitor sharing one bucket keyed on the Next.js server's own IP — and close a pre-existing global gap where DRF's default `get_ident()` trusts a client-supplied `X-Forwarded-For` verbatim.

**Architecture:** The Next.js server reads the incoming request's forwarded IP via `next/headers`'s `headers()` and sends it to Django in a custom `X-Internal-Client-IP` header, alongside a shared secret (`X-Internal-Service-Secret`) that proves the request came from this project's own Next.js server. `common.throttling.HashedIPScopedRateThrottle.get_ident()` is rewritten to trust the forwarded IP only when the secret matches (constant-time compare), and to never consult `X-Forwarded-For` directly — falling back to `REMOTE_ADDR` in every other case, exactly like today.

**Tech Stack:** Django REST Framework (`ScopedRateThrottle` subclass), `hmac`/`hashlib` (stdlib); Next.js 16 App Router server components, `next/headers`; pytest + pytest-django (backend), Vitest (frontend).

**Spec:** [docs/superpowers/specs/2026-09-18-services-directory-throttle-ip-forwarding-design.md](../specs/2026-09-18-services-directory-throttle-ip-forwarding-design.md)

## Global Constraints

- Never call `super().get_ident()` (DRF's `SimpleRateThrottle.get_ident()`) from `HashedIPScopedRateThrottle` — it trusts a client-supplied `X-Forwarded-For` verbatim when `NUM_PROXIES` is unset, which this project never sets.
- The shared secret is compared with `hmac.compare_digest`, never `==`.
- `INTERNAL_SERVICE_SECRET` is a required Django setting (`env("INTERNAL_SERVICE_SECRET")`, no default) — same fail-loud pattern as `CONTACT_HASH_SECRET`.
- On the frontend, the secret is read from `process.env.INTERNAL_SERVICE_SECRET` — **never** a `NEXT_PUBLIC_`-prefixed variable, so it is never bundled into client-side JS.
- `directoryFetch()`'s public signature does not change — no caller (`fetchServiceCategories`, `fetchServiceCategory`, `fetchProfessionals`, `fetchProfessional`, `resolveLegacyProfessional`) or any page that calls them is touched.
- A missing/invalid secret or missing forwarded IP must never fail a request — always fall back to `REMOTE_ADDR` (today's behavior).

---

## File Structure

- **Modify** `backend/config/settings/base.py` — add the `INTERNAL_SERVICE_SECRET` setting.
- **Modify** `backend/common/throttling.py` — rewrite `get_ident()` to resolve a trusted forwarded IP or fall back to `REMOTE_ADDR`, never `X-Forwarded-For`.
- **Modify** `backend/.env.example`, `.github/workflows/ci.yml` — provide `INTERNAL_SERVICE_SECRET` for local dev and CI.
- **Modify** `backend/common/tests/test_throttling.py` — unit-level proof of the new resolution logic.
- **Modify** `backend/services_catalog/tests/test_service_category_api.py` — end-to-end proof that two visitors behind the same Next.js server get independent budgets.
- **Create** `frontend/src/lib/api/internal-headers.ts` — `forwardedClientIp()`, reading the real visitor IP from the current SSR request.
- **Create** `frontend/src/lib/api/internal-headers.test.ts` — unit tests for that helper.
- **Modify** `frontend/src/lib/api/directory.ts` — `directoryFetch()` attaches the secret and (when available) forwarded-IP headers.
- **Modify** `frontend/src/lib/api/directory.test.ts` — proves the headers are attached correctly.
- **Modify** `frontend/.env.local.example` — document the new required env var.

---

## Task 1: Backend — trusted forwarded-IP resolution in `HashedIPScopedRateThrottle`

**Files:**
- Modify: `backend/config/settings/base.py:179` (right after `CONTACT_HASH_SECRET`)
- Modify: `backend/common/throttling.py`
- Modify: `backend/.env.example:32` (right after `CONTACT_HASH_SECRET`)
- Modify: `.github/workflows/ci.yml:49` (right after `CONTACT_HASH_SECRET`, in the `backend` job's `env:`)
- Test: `backend/common/tests/test_throttling.py`
- Test: `backend/services_catalog/tests/test_service_category_api.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: `settings.INTERNAL_SERVICE_SECRET` (str); `common.throttling.INTERNAL_CLIENT_IP_HEADER` / `INTERNAL_SERVICE_SECRET_HEADER` (the `request.META` key names); `HashedIPScopedRateThrottle.get_ident(request)` behavior described above, consumed by every view across the project that sets `throttle_scope`.

**One-time environment setup (skip any step already satisfied):**

```bash
cd backend
uv sync
cp .env.example .env
```

Edit `backend/.env` and set `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL=postgres://nautelo:nautelo@127.0.0.1:5433/nautelo`, `REDIS_URL=redis://127.0.0.1:6380/0`, `CELERY_BROKER_URL=redis://127.0.0.1:6380/1`, `CELERY_RESULT_BACKEND=redis://127.0.0.1:6380/2`, `CHANNELS_REDIS_URL=redis://127.0.0.1:6380/3` (matching `docker-compose.yml`'s port mappings), then from the repo root run `docker compose up -d` to start Postgres/Redis/MinIO before running any test in this task.

- [ ] **Step 1: Add the `INTERNAL_SERVICE_SECRET` setting**

In `backend/config/settings/base.py`, right after the `CONTACT_HASH_SECRET = env("CONTACT_HASH_SECRET")` line:

```python
# Shared secret proving a request genuinely originates from this project's own
# Next.js server (server-to-server, never exposed to the browser) rather than
# the public internet. See common.throttling.HashedIPScopedRateThrottle.
INTERNAL_SERVICE_SECRET = env("INTERNAL_SERVICE_SECRET")
```

In `backend/.env.example`, right after `CONTACT_HASH_SECRET=change-me-in-dev`:

```
INTERNAL_SERVICE_SECRET=change-me-in-dev
```

Also add the same line to your local `backend/.env` (not committed).

In `.github/workflows/ci.yml`, in the `backend` job's `env:` block, right after `CONTACT_HASH_SECRET: ci-test-secret`:

```yaml
      INTERNAL_SERVICE_SECRET: ci-test-secret
```

- [ ] **Step 2: Run the Django system check to confirm settings load**

Run: `cd backend && uv run python manage.py check`
Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 3: Write the failing tests**

Replace the full contents of `backend/common/tests/test_throttling.py` with:

```python
from django.test import override_settings
from rest_framework.test import APIRequestFactory

from common.throttling import HashedIPScopedRateThrottle


def test_the_cache_key_never_contains_the_raw_ip():
    request = APIRequestFactory().post("/api/v1/auth/register/", REMOTE_ADDR="198.51.100.9")
    throttle = HashedIPScopedRateThrottle()
    ident = throttle.get_ident(request)

    assert "198.51.100.9" not in ident
    assert len(ident) == 64  # sha256 hex
    # Deterministic: the same address must always map to the same bucket.
    assert throttle.get_ident(request) == ident


@override_settings(INTERNAL_SERVICE_SECRET="test-internal-secret")
def test_a_valid_internal_secret_makes_the_forwarded_ip_the_throttle_identity():
    forwarded_request = APIRequestFactory().get(
        "/api/v1/service-categories/",
        REMOTE_ADDR="10.0.0.5",  # the Next.js server's own address
        HTTP_X_INTERNAL_SERVICE_SECRET="test-internal-secret",
        HTTP_X_INTERNAL_CLIENT_IP="198.51.100.42",  # the real visitor's address
    )
    direct_request = APIRequestFactory().get(
        "/api/v1/service-categories/", REMOTE_ADDR="198.51.100.42"
    )
    throttle = HashedIPScopedRateThrottle()

    # Same hash as hashing the visitor's IP directly as REMOTE_ADDR, proving
    # the forwarded value - not the Next.js server's REMOTE_ADDR - won.
    assert throttle.get_ident(forwarded_request) == throttle.get_ident(direct_request)


@override_settings(INTERNAL_SERVICE_SECRET="test-internal-secret")
def test_a_wrong_internal_secret_ignores_the_forwarded_ip():
    wrong_secret_request = APIRequestFactory().get(
        "/api/v1/service-categories/",
        REMOTE_ADDR="10.0.0.5",
        HTTP_X_INTERNAL_SERVICE_SECRET="not-the-real-secret",
        HTTP_X_INTERNAL_CLIENT_IP="198.51.100.42",
    )
    no_header_request = APIRequestFactory().get(
        "/api/v1/service-categories/", REMOTE_ADDR="10.0.0.5"
    )
    throttle = HashedIPScopedRateThrottle()

    assert throttle.get_ident(wrong_secret_request) == throttle.get_ident(no_header_request)


def test_an_unauthenticated_x_forwarded_for_header_is_never_trusted():
    # Regression guard for the pre-existing global gap: with NUM_PROXIES unset
    # (this project's default), DRF's own SimpleRateThrottle.get_ident() would
    # trust this header verbatim. This class must never call that method.
    spoofed_request = APIRequestFactory().get(
        "/api/v1/auth/login/",
        REMOTE_ADDR="203.0.113.7",
        HTTP_X_FORWARDED_FOR="1.2.3.4",
    )
    plain_request = APIRequestFactory().get(
        "/api/v1/auth/login/", REMOTE_ADDR="203.0.113.7"
    )
    throttle = HashedIPScopedRateThrottle()

    assert throttle.get_ident(spoofed_request) == throttle.get_ident(plain_request)
```

Add this test to `backend/services_catalog/tests/test_service_category_api.py`, right after `test_category_list_is_rate_limited` (it already imports `HashedIPScopedRateThrottle`):

```python
@pytest.mark.django_db
def test_two_visitors_behind_the_shared_next_js_server_get_independent_budgets(
    monkeypatch, settings
):
    # Regression test for the SSR throttle-sharing gap: two different SSR page
    # loads from the same Next.js server (same REMOTE_ADDR as far as Django is
    # concerned) must not share one throttle budget once each carries its own
    # visitor's forwarded IP.
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "services_directory", "1/min"
    )
    settings.INTERNAL_SERVICE_SECRET = "test-internal-secret"
    client = APIClient()
    secret_header = {"HTTP_X_INTERNAL_SERVICE_SECRET": "test-internal-secret"}

    first_visitor = client.get(
        "/api/v1/service-categories/", **secret_header, HTTP_X_INTERNAL_CLIENT_IP="198.51.100.1"
    )
    second_visitor = client.get(
        "/api/v1/service-categories/", **secret_header, HTTP_X_INTERNAL_CLIENT_IP="198.51.100.2"
    )
    first_visitor_again = client.get(
        "/api/v1/service-categories/", **secret_header, HTTP_X_INTERNAL_CLIENT_IP="198.51.100.1"
    )

    assert first_visitor.status_code == 200
    assert second_visitor.status_code == 200
    assert first_visitor_again.status_code == 429
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd backend && uv run pytest common/tests/test_throttling.py services_catalog/tests/test_service_category_api.py -v`
Expected: `test_a_valid_internal_secret_makes_the_forwarded_ip_the_throttle_identity`, `test_a_wrong_internal_secret_ignores_the_forwarded_ip`, and `test_two_visitors_behind_the_shared_next_js_server_get_independent_budgets` FAIL (current `get_ident()` doesn't know about the new headers, and `test_an_unauthenticated_x_forwarded_for_header_is_never_trusted` FAILs too, since DRF's inherited `get_ident()` currently trusts `X-Forwarded-For`). `test_the_cache_key_never_contains_the_raw_ip` still PASSes.

- [ ] **Step 5: Rewrite `get_ident()`**

Replace the full contents of `backend/common/throttling.py`:

```python
import hashlib
import hmac

from django.conf import settings
from rest_framework.throttling import ScopedRateThrottle

INTERNAL_CLIENT_IP_HEADER = "HTTP_X_INTERNAL_CLIENT_IP"
INTERNAL_SERVICE_SECRET_HEADER = "HTTP_X_INTERNAL_SERVICE_SECRET"


class HashedIPScopedRateThrottle(ScopedRateThrottle):
    """ScopedRateThrottle that never lets a raw client IP reach the cache.

    DRF's SimpleRateThrottle.get_cache_key() embeds get_ident()'s return value
    verbatim, producing Redis keys like `throttle_auth_192.0.2.7`. Spec 30.4 is
    explicit: "Rate limiting must not store raw IP beyond approved security
    systems." Hashing the identifier keeps the throttle exactly as effective
    (the hash is stable and 1:1 with the IP) while storing no readable address.

    The HMAC key is CONTACT_HASH_SECRET, the same secret spec 11.7 already
    mandates for `viewer_hash = HMAC-SHA256(CONTACT_HASH_SECRET, canonical_client_ip)`
    on ListingView. Reusing it keeps one IP-pseudonymization secret for the whole
    project, so rotating it rotates every derived identifier at once.
    """

    def get_ident(self, request):
        ident = self._resolve_raw_ident(request)
        if not ident:
            return ident
        return hmac.new(
            settings.CONTACT_HASH_SECRET.encode(),
            ident.encode(),
            hashlib.sha256,
        ).hexdigest()

    def _resolve_raw_ident(self, request):
        """Resolve the un-hashed client identifier.

        Deliberately does not call ScopedRateThrottle/SimpleRateThrottle's own
        get_ident(): with REST_FRAMEWORK["NUM_PROXIES"] unset (this project's
        default), DRF trusts a client-supplied X-Forwarded-For verbatim,
        letting any anonymous caller pick its own throttle bucket. This
        resolver never consults X-Forwarded-For at all.

        The only way a forwarded IP is trusted is the internal secret below,
        set only by this project's own Next.js server (see
        frontend/src/lib/api/directory.ts) for the SSR-to-API hop, where
        REMOTE_ADDR is otherwise always the Next.js server's own address, not
        the visitor's.
        """
        provided_secret = request.META.get(INTERNAL_SERVICE_SECRET_HEADER, "")
        if provided_secret and hmac.compare_digest(
            provided_secret.encode(), settings.INTERNAL_SERVICE_SECRET.encode()
        ):
            forwarded_ip = request.META.get(INTERNAL_CLIENT_IP_HEADER, "").strip()
            if forwarded_ip:
                return forwarded_ip
        return request.META.get("REMOTE_ADDR")
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && uv run pytest common/tests/test_throttling.py services_catalog/tests/test_service_category_api.py -v`
Expected: all PASS.

- [ ] **Step 7: Run the full backend suite to confirm no regression**

Run: `cd backend && uv run pytest -v`
Expected: all PASS (in particular every test in `accounts/`, `taxonomy/`, `listings/` that touches throttling — none should have started relying on `X-Forwarded-For`).

- [ ] **Step 8: Commit**

```bash
git add backend/config/settings/base.py backend/common/throttling.py backend/.env.example .github/workflows/ci.yml backend/common/tests/test_throttling.py backend/services_catalog/tests/test_service_category_api.py
git commit -m "$(cat <<'EOF'
fix(throttling): trust a forwarded client IP only via a verified internal secret

HashedIPScopedRateThrottle.get_ident() no longer calls DRF's inherited
resolution, which trusted a client-supplied X-Forwarded-For verbatim
whenever NUM_PROXIES was unset (this project's default) - a project-wide
throttle bypass across every scope (auth included). It now trusts a
forwarded IP only when X-Internal-Service-Secret matches
INTERNAL_SERVICE_SECRET, and otherwise always falls back to REMOTE_ADDR.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Frontend — `forwardedClientIp()` helper

**Files:**
- Create: `frontend/src/lib/api/internal-headers.ts`
- Test: `frontend/src/lib/api/internal-headers.test.ts`

**Interfaces:**
- Consumes: `headers` from `next/headers`.
- Produces: `forwardedClientIp(): Promise<string | undefined>`, consumed by Task 3's `directoryFetch()`.

**One-time environment setup (skip if already done):**

```bash
cd frontend
pnpm install --frozen-lockfile
```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/api/internal-headers.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

import { forwardedClientIp } from "./internal-headers";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({ headers: headersMock }));

afterEach(() => headersMock.mockReset());

describe("forwardedClientIp", () => {
  it("returns the first entry of x-forwarded-for", async () => {
    headersMock.mockResolvedValue(
      new Headers({ "x-forwarded-for": "198.51.100.42, 10.0.0.5" }),
    );

    await expect(forwardedClientIp()).resolves.toBe("198.51.100.42");
  });

  it("returns undefined when there is no x-forwarded-for header", async () => {
    headersMock.mockResolvedValue(new Headers());

    await expect(forwardedClientIp()).resolves.toBeUndefined();
  });

  it("returns undefined instead of throwing when headers() is unavailable", async () => {
    headersMock.mockRejectedValue(new Error("outside request scope"));

    await expect(forwardedClientIp()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/lib/api/internal-headers.test.ts`
Expected: FAIL — `Failed to resolve import "./internal-headers"` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/api/internal-headers.ts`:

```typescript
import { headers } from "next/headers";

/**
 * The real visitor's IP for the current SSR request, read from the incoming
 * request's `x-forwarded-for` header — or undefined when unavailable.
 *
 * `headers()` throws outside a request-scoped render (a route that has not
 * opted into dynamic rendering); a page render must never fail over this
 * best-effort value, so failure here just means "no IP to forward" and
 * directoryFetch() falls back to Django's REMOTE_ADDR-based throttling.
 */
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/lib/api/internal-headers.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api/internal-headers.ts frontend/src/lib/api/internal-headers.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): add forwardedClientIp() to read the real visitor IP during SSR

Reads x-forwarded-for via next/headers for the directory pages' SSR data
fetches. Never throws - a page render must not fail over a best-effort
value, so an unavailable headers() just means no IP to forward.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Frontend — wire the internal headers into `directoryFetch()`

**Files:**
- Modify: `frontend/src/lib/api/directory.ts:92-107`
- Modify: `frontend/src/lib/api/directory.test.ts`
- Modify: `frontend/.env.local.example`

**Interfaces:**
- Consumes: `forwardedClientIp()` from Task 2 (`frontend/src/lib/api/internal-headers.ts`).
- Produces: no change to `directoryFetch<T>(path: string): Promise<T | null>`'s signature — only its outgoing request headers change. No other file needs to change.

- [ ] **Step 1: Write the failing tests**

In `frontend/src/lib/api/directory.test.ts`, add the `internal-headers` mock next to the existing `fetchMock` setup:

```typescript
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const forwardedClientIpMock = vi.fn().mockResolvedValue(undefined);
vi.mock("./internal-headers", () => ({
  forwardedClientIp: () => forwardedClientIpMock(),
}));

afterEach(() => {
  fetchMock.mockReset();
  forwardedClientIpMock.mockReset().mockResolvedValue(undefined);
});
```

(This replaces the existing `const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); afterEach(() => fetchMock.mockReset());` block.)

Add a new describe block at the end of the file:

```typescript
describe("directoryFetch internal headers", () => {
  it("always sends the internal service secret header", async () => {
    fetchMock.mockResolvedValue(json({}));

    await directoryFetch("/api/v1/service-categories/");

    const [, init] = fetchMock.mock.calls[0];
    const sentHeaders = new Headers(init.headers as HeadersInit);
    expect(sentHeaders.get("X-Internal-Service-Secret")).not.toBeNull();
  });

  it("omits the client IP header when none is available", async () => {
    forwardedClientIpMock.mockResolvedValue(undefined);
    fetchMock.mockResolvedValue(json({}));

    await directoryFetch("/api/v1/service-categories/");

    const [, init] = fetchMock.mock.calls[0];
    const sentHeaders = new Headers(init.headers as HeadersInit);
    expect(sentHeaders.has("X-Internal-Client-IP")).toBe(false);
  });

  it("forwards the client IP header when one is available", async () => {
    forwardedClientIpMock.mockResolvedValue("198.51.100.42");
    fetchMock.mockResolvedValue(json({}));

    await directoryFetch("/api/v1/service-categories/");

    const [, init] = fetchMock.mock.calls[0];
    const sentHeaders = new Headers(init.headers as HeadersInit);
    expect(sentHeaders.get("X-Internal-Client-IP")).toBe("198.51.100.42");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/lib/api/directory.test.ts`
Expected: the 3 new tests FAIL (`directoryFetch` doesn't send either header yet); all pre-existing tests in the file still PASS.

- [ ] **Step 3: Wire the headers into `directoryFetch()`**

In `frontend/src/lib/api/directory.ts`, add the import and the module-level secret constant right after the existing `DIRECTORY_API_BASE_URL` constant:

```typescript
import { forwardedClientIp } from "./internal-headers";

export const DIRECTORY_API_BASE_URL =
  // 127.0.0.1, not localhost: this runs in Node during SSR and this machine
  // resolves localhost to IPv6 ::1 (Phase 0/1 retrospective).
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8020";

// Server-only: never NEXT_PUBLIC_-prefixed, so Next.js never inlines this
// into a client bundle. Proves a services_directory request genuinely came
// from this project's own Next.js server - see
// common.throttling.HashedIPScopedRateThrottle.
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET ?? "";
```

Replace the body of `directoryFetch`:

```typescript
export async function directoryFetch<T>(path: string): Promise<T | null> {
  const clientIp = await forwardedClientIp();
  const response = await fetch(`${DIRECTORY_API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "X-Internal-Service-Secret": INTERNAL_SERVICE_SECRET,
      ...(clientIp ? { "X-Internal-Client-IP": clientIp } : {}),
    },
    // Directory content is staff-edited and provider-edited; never serve a
    // stale grid from the build cache.
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Directory API ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}
```

In `frontend/.env.local.example`, add:

```
# Must match the backend's INTERNAL_SERVICE_SECRET (backend/.env). Proves SSR
# directory requests come from this server, not the public internet.
INTERNAL_SERVICE_SECRET=change-me-in-dev
```

Also add the same line to your local `frontend/.env.local` (not committed).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/lib/api/directory.test.ts`
Expected: all PASS, including the pre-existing ones.

- [ ] **Step 5: Run the full frontend test suite and lint**

Run: `cd frontend && pnpm test && pnpm lint`
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api/directory.ts frontend/src/lib/api/directory.test.ts frontend/.env.local.example
git commit -m "$(cat <<'EOF'
feat(frontend): forward the real visitor IP to Django on directory SSR reads

directoryFetch() now sends X-Internal-Service-Secret on every request and
X-Internal-Client-IP when the incoming request's x-forwarded-for is known,
so each visitor gets their own services_directory throttle budget instead
of sharing one bucket keyed on the Next.js server's own IP.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start both dev servers**

```bash
cd backend && uv run python manage.py runserver 8020
```

In a second terminal:

```bash
cd frontend && pnpm dev
```

- [ ] **Step 2: Confirm the secret is required in `backend/.env` and `frontend/.env.local`**

Both files must have the same `INTERNAL_SERVICE_SECRET` value (set in Task 1/3). If they differ, every SSR request falls back to the shared `REMOTE_ADDR` bucket — the fix silently does nothing, which is the safe failure mode, but worth confirming during this pass.

- [ ] **Step 3: Load a directory page and confirm the headers are sent**

Open `http://localhost:3020/services/professionals/` in a browser. In the backend terminal, confirm requests to `/api/v1/service-categories/` and `/api/v1/professionals/` are arriving (Django's dev server logs each request). Add a temporary `print(request.META.get("HTTP_X_INTERNAL_CLIENT_IP"))` at the top of `ServiceCategoryListView.get_queryset` to confirm a real value arrives (Django dev server binds to loopback, so expect something like `127.0.0.1` — the point is confirming the header round-trips end-to-end, not a specific value). Remove the print statement afterward.

- [ ] **Step 4: Confirm no regression on the auth throttle**

```bash
for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8020/api/v1/auth/login/ -H "Content-Type: application/json" -d '{"email":"nobody@example.com","password":"wrong"}'; done
```

Expected: the first 10 requests return `400`/`401` (bad credentials), the 11th returns `429` — proving the `auth` scope still throttles correctly by `REMOTE_ADDR` now that `X-Forwarded-For` is never trusted (no header is sent in this curl, so this exercises the plain fallback path).

- [ ] **Step 5: Confirm `X-Forwarded-For` alone no longer bypasses the auth throttle**

```bash
for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8020/api/v1/auth/login/ -H "Content-Type: application/json" -H "X-Forwarded-For: 203.0.113.$i" -d '{"email":"nobody@example.com","password":"wrong"}'; done
```

Expected: same result as Step 4 — throttled by request 11 despite each request carrying a different `X-Forwarded-For` value, proving the pre-existing spoof gap (§2 of the spec) is closed.

---

## Self-Review

**Spec coverage:**
- §2 (pre-existing global XFF spoof gap) → Task 1, `test_an_unauthenticated_x_forwarded_for_header_is_never_trusted` + Task 4 Step 5.
- §4.1 backend settings/throttling rewrite → Task 1.
- §4.2 frontend helper + `directoryFetch` wiring → Tasks 2–3.
- §4.3 data flow (secret valid+IP → per-visitor; else → `REMOTE_ADDR`) → Task 1's tests, Task 3's tests.
- §4.4 known limitation (trust of whatever fronts Next.js itself) → documented in the spec; no code task needed, it's explicitly out of scope.
- §5 error-handling table → covered by `test_a_wrong_internal_secret_ignores_the_forwarded_ip` (wrong secret), `forwardedClientIp`'s try/catch test (unavailable `headers()`), and the "omits the client IP header" directory.ts test (no IP available).
- §6 testing plan → every listed test is in Task 1–3.
- §7 out of scope (no new throttle class, no IP-format validation, no page component changes) → respected; no task touches any `page.tsx` or `sitemap.ts`.

**Placeholder scan:** none found — every step has literal file contents, not descriptions.

**Type consistency:** `forwardedClientIp(): Promise<string | undefined>` (Task 2) matches its usage in Task 3 (`const clientIp = await forwardedClientIp();` then `clientIp ? {...} : {}`). `INTERNAL_CLIENT_IP_HEADER` / `INTERNAL_SERVICE_SECRET_HEADER` (Task 1, Python `META` keys `HTTP_X_INTERNAL_CLIENT_IP` / `HTTP_X_INTERNAL_SERVICE_SECRET`) match the header names sent in Task 3 (`X-Internal-Client-IP` / `X-Internal-Service-Secret` — Django's `HTTP_` + underscored-uppercase convention on incoming headers is standard and not restated per-task since it's a framework rule, not a project one).
