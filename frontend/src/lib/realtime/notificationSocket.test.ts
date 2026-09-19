import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({ getAccessToken: () => "tok" }));

import { connectNotifications, socketUrl } from "@/lib/realtime/notificationSocket";

class FakeSocket {
  static last: FakeSocket;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {}
}

afterEach(() => vi.unstubAllGlobals());

describe("notification socket", () => {
  it("derives a ws URL from the API base", () => {
    expect(socketUrl("https://api.x.test")).toBe("wss://api.x.test/ws/notifications/");
    expect(socketUrl("http://127.0.0.1:8020")).toBe("ws://127.0.0.1:8020/ws/notifications/");
  });

  it("authenticates with the first message, never in the URL, and reports changes", () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    const onChange = vi.fn();
    const stop = connectNotifications({ onChange });
    const socket = FakeSocket.last;
    expect(socket.url).not.toContain("tok");
    socket.onopen?.();
    expect(JSON.parse(socket.sent[0])).toEqual({ type: "auth", token: "tok" });
    socket.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
    socket.onmessage?.({ data: JSON.stringify({ kind: "notification", id: "n" }) });
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
  });
});
