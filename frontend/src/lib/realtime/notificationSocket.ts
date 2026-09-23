// Notification push channel (spec 27.2). The socket only says "something
// changed"; REST stays the source of truth, so every push and every reconnect
// triggers a reload by the caller.
import { getAccessToken, tryRefreshAccessToken } from "@/lib/api/client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8020";
// A dashboard tab may stay open for hours: after repeated failures wait minutes, not seconds.
const MAX_BACKOFF_MS = 5 * 60_000;
// The server's close code for a missing or expired access token (notifications/consumers.py).
const CLOSE_UNAUTHORIZED = 4401;

export function socketUrl(apiBase: string = API_BASE): string {
  const url = new URL("/ws/notifications/", apiBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export interface SocketHandlers {
  /** Called on every push and after every (re)authentication. */
  onChange: () => void;
}

/** Opens the socket, authenticates with the first message and reconnects with
 *  capped exponential backoff. Returns a function that closes it for good. */
export function connectNotifications(handlers: SocketHandlers): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function open() {
    if (stopped || typeof WebSocket === "undefined") return;
    const token = getAccessToken();
    if (!token) {
      schedule();
      return;
    }
    socket = new WebSocket(socketUrl());
    socket.onopen = () => socket?.send(JSON.stringify({ type: "auth", token }));
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as { type?: string; kind?: string };
        if (data.type === "auth_ok") {
          attempt = 0;
          handlers.onChange();
        } else if (data.kind === "notification") {
          handlers.onChange();
        }
      } catch {
        // Ignore malformed frames.
      }
    };
    socket.onclose = (event) => {
      socket = null;
      if (stopped) return;
      if (event?.code === CLOSE_UNAUTHORIZED) {
        // The in-memory access token had expired: renew it first, otherwise every retry would fail the same way.
        void tryRefreshAccessToken().finally(schedule);
        return;
      }
      schedule();
    };
  }

  function schedule() {
    if (stopped) return;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
    attempt += 1;
    timer = setTimeout(open, delay);
  }

  open();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (!socket) return;
    if (socket.readyState === 0) {
      // Closing a socket that is still connecting makes the browser log a failed connection: let it open, then close.
      socket.onopen = () => socket?.close();
    } else {
      socket.close();
    }
  };
}
