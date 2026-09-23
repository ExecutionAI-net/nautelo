import { afterEach, describe, expect, it, vi } from "vitest";

const REFRESH_URL = "http://localhost:8020/api/v1/auth/token/refresh/";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("apiFetch empty-body responses", () => {
  it("resolves (does not throw) for a 202 with an empty body, e.g. password-reset", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await import("@/lib/api/client");

    await expect(
      apiFetch("/api/v1/auth/password-reset/", { method: "POST" }),
    ).resolves.toBeUndefined();
  });

  it("still parses a body on an ordinary 200 response", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await import("@/lib/api/client");

    await expect(apiFetch("/api/v1/whatever/")).resolves.toEqual({ ok: true });
  });
});

describe("tryRefreshAccessToken same-tab de-duplication", () => {
  it("fires exactly one network request for concurrent callers, and does not let a losing response null out the winning token", async () => {
    // Simulates ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION: a second,
    // overlapping refresh call hits the already-rotated (blacklisted) token
    // and gets a 401, while the first call's rotation succeeds.
    let inFlight = 0;
    const fetchMock = vi.fn(async () => {
      inFlight += 1;
      const collided = inFlight > 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      if (collided) {
        return new Response(
          JSON.stringify({ error: { code: "token_not_valid" } }),
          { status: 401 },
        );
      }
      return new Response(JSON.stringify({ access: "fresh-access-token" }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { tryRefreshAccessToken, getAccessToken } = await import(
      "@/lib/api/client"
    );

    const [first, second] = await Promise.all([
      tryRefreshAccessToken(),
      tryRefreshAccessToken(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      REFRESH_URL,
      expect.objectContaining({ method: "POST" }),
    );
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(getAccessToken()).toBe("fresh-access-token");
  });

  it("issues a new network request for a later, non-overlapping refresh", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: "token-1" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: "token-2" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { tryRefreshAccessToken, getAccessToken } = await import(
      "@/lib/api/client"
    );

    await tryRefreshAccessToken();
    expect(getAccessToken()).toBe("token-1");

    await tryRefreshAccessToken();
    expect(getAccessToken()).toBe("token-2");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("tryRefreshAccessToken cross-tab coordination", () => {
  // Each browser tab has its own independent JS module state (a separate
  // realm). We simulate two tabs by resetting the module registry between
  // imports so each gets its own module-scoped `accessToken` / in-flight
  // promise, while sharing the same global `fetch` and `navigator.locks`
  // mocks the way two real tabs share the same cookie jar and Web Locks
  // partition.
  function createSerializingLockManager(): LockManager {
    let queue: Promise<unknown> = Promise.resolve();
    return {
      request: vi.fn((_name: string, callback: () => Promise<unknown>) => {
        const run = queue.then(() => callback());
        // Keep the queue chain alive regardless of individual failures.
        queue = run.catch(() => undefined);
        return run;
      }),
    } as unknown as LockManager;
  }

  it("does not let two tabs racing a refresh collide on the rotated/blacklisted cookie", async () => {
    let inFlight = 0;
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      inFlight += 1;
      const collided = inFlight > 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      if (collided) {
        return new Response(
          JSON.stringify({ error: { code: "token_not_valid" } }),
          { status: 401 },
        );
      }
      return new Response(
        JSON.stringify({ access: `access-${callCount}` }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      locks: createSerializingLockManager(),
    });

    vi.resetModules();
    const tabA = await import("@/lib/api/client");
    vi.resetModules();
    const tabB = await import("@/lib/api/client");

    const [resultA, resultB] = await Promise.all([
      tabA.tryRefreshAccessToken(),
      tabB.tryRefreshAccessToken(),
    ]);

    expect(resultA).toBe(true);
    expect(resultB).toBe(true);
    expect(tabA.getAccessToken()).not.toBeNull();
    expect(tabB.getAccessToken()).not.toBeNull();
  });

  it("releases the lock (instead of hanging every tab) when a tab's refresh request stalls", async () => {
    vi.useFakeTimers();
    try {
      let callCount = 0;
      const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
        callCount += 1;
        if (callCount === 1) {
          // Tab A's request stalls indefinitely (dropped connection) until
          // its own timeout aborts it — it must never resolve on its own.
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("stalled request aborted", "AbortError"));
            });
          });
        }
        return Promise.resolve(
          new Response(JSON.stringify({ access: "tab-b-token" }), {
            status: 200,
          }),
        );
      });
      vi.stubGlobal("fetch", fetchMock);
      vi.stubGlobal("navigator", {
        ...globalThis.navigator,
        locks: createSerializingLockManager(),
      });

      vi.resetModules();
      const tabA = await import("@/lib/api/client");
      vi.resetModules();
      const tabB = await import("@/lib/api/client");

      const resultAPromise = tabA.tryRefreshAccessToken();
      await Promise.resolve(); // let tab A acquire the lock and start its fetch
      const resultBPromise = tabB.tryRefreshAccessToken();

      await vi.advanceTimersByTimeAsync(tabA.REFRESH_TIMEOUT_MS);

      const [resultA, resultB] = await Promise.all([
        resultAPromise,
        resultBPromise,
      ]);

      expect(resultA).toBe(false);
      expect(tabA.getAccessToken()).toBeNull();
      // Tab B must not be starved by tab A's stall: once the timeout frees
      // the lock, tab B's own refresh proceeds and succeeds.
      expect(resultB).toBe(true);
      expect(tabB.getAccessToken()).toBe("tab-b-token");
    } finally {
      vi.useRealTimers();
    }
  });
});
