import { afterEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ getAccessToken: () => "tok", tryRefreshAccessToken: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/api/client", () => client);

import { connectNotifications, socketUrl } from "@/lib/realtime/notificationSocket";

class FakeSocket {
  static last: FakeSocket;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  readyState = 1;
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

  it("renews the access token after an unauthorized close and closes a connecting socket only once open", () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.useFakeTimers();
    const stop = connectNotifications({ onChange: vi.fn() });
    const socket = FakeSocket.last;
    socket.onclose?.({ code: 4401 });
    expect(client.tryRefreshAccessToken).toHaveBeenCalledTimes(1);
    stop();

    const connecting = connectNotifications({ onChange: vi.fn() });
    const pending = FakeSocket.last;
    pending.readyState = 0;
    const close = vi.spyOn(pending, "close");
    connecting();
    expect(close).not.toHaveBeenCalled();
    pending.onopen?.();
    expect(close).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
