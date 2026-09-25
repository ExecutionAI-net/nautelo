"use client";

import { type ReactNode, useEffect, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8020";

function send(target: "listing" | "profile", id: string, kind: "impression" | "click") {
  try {
    const key = `promo:${kind}:${id}`;
    if (kind === "impression") {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    }
  } catch {
    // Storage blocked: count anyway.
  }
  void fetch(`${API}/api/v1/promotions/events/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, id, kind }),
    keepalive: true,
  }).catch(() => undefined);
}

/** Reports one impression (once per session) when a featured card is half visible, and clicks. */
export default function PromoTracker({ target, id, children }: { target: "listing" | "profile"; id: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          send(target, id, "impression");
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, id]);

  return (
    <div ref={box} className="h-full" onClickCapture={() => send(target, id, "click")}>
      {children}
    </div>
  );
}
