"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ApiError,
  apiFetch,
  getAccessToken,
  hasSessionHint,
  setAccessToken,
  tryRefreshAccessToken,
} from "@/lib/api/client";
import type {
  LoginResponse,
  PermissionKey,
  SessionPayload,
} from "@/lib/auth/types";

interface SessionContextValue {
  session: SessionPayload | null;
  loading: boolean;
  error: string | null;
  can: (permission: PermissionKey) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSession(await apiFetch<SessionPayload>("/api/v1/session/"));
      setError(null);
    } catch (caught) {
      // An unreachable or unauthenticated API means "no session", never a crash.
      setSession(null);
      setError(caught instanceof ApiError ? caught.message : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // On a fresh page load the access token is gone (it lives in memory only),
    // but the HttpOnly refresh cookie may still be valid — so trade it for a new
    // access token BEFORE asking for the session, otherwise a signed-in user
    // would briefly render as a guest. A visitor who has never signed in carries
    // no session hint, so skip the attempt entirely instead of always drawing a
    // 401 that would just be thrown away.
    async function bootstrap() {
      if (getAccessToken() === null && hasSessionHint()) {
        await tryRefreshAccessToken();
      }
      await reload();
    }
    void bootstrap();
  }, [reload]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiFetch<LoginResponse>("/api/v1/auth/login/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(response.access);
      await reload();
    },
    [reload],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/api/v1/auth/logout/", {
        method: "POST",
        body: "{}",
      });
    } finally {
      setAccessToken(null);
      await reload();
    }
  }, [reload]);

  const can = useCallback(
    (permission: PermissionKey) => session?.permissions?.[permission] === true,
    [session],
  );

  const value = useMemo(
    () => ({ session, loading, error, can, login, logout, reload }),
    [session, loading, error, can, login, logout, reload],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error("useSession must be used inside a SessionProvider.");
  }
  return context;
}
