import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

function request(url: string) {
  return new Request(url);
}

describe("GET /professionals/profile/", () => {
  it("301s to the resolved canonical URL", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ url: "/services/professionals/ocean-legal/" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET(request("http://localhost:3020/professionals/profile/?id=4821"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3020/services/professionals/ocean-legal/",
    );
  });

  it("404s when the legacy id does not resolve", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const response = await GET(request("http://localhost:3020/professionals/profile/?id=nope"));

    expect(response.status).toBe(404);
  });

  it("404s when no id is supplied, without calling the API", async () => {
    const response = await GET(request("http://localhost:3020/professionals/profile/"));

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("404s when the API is unreachable rather than throwing", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await GET(request("http://localhost:3020/professionals/profile/?id=4821"));

    expect(response.status).toBe(404);
  });
});
