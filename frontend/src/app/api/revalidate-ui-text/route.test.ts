import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }));
vi.mock("@/i18n/server", () => ({ UI_TEXT_TAG: "ui-text" }));

import { POST } from "@/app/api/revalidate-ui-text/route";

const token = (secret: string) => createHash("sha256").update(`uitext:${secret}`).digest("hex");
const call = (given?: string) => POST(new Request("http://x/api/revalidate-ui-text/", { method: "POST", headers: given ? { "x-revalidate-token": given } : {} }));

describe("POST /api/revalidate-ui-text/", () => {
  beforeEach(() => {
    revalidateTag.mockReset();
    process.env.INTERNAL_SERVICE_SECRET = "s3cret";
  });

  it("drops the cached site text when the token is right", async () => {
    const response = await call(token("s3cret"));
    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("ui-text", { expire: 0 });
  });

  it("refuses a missing or wrong token and never touches the cache", async () => {
    expect((await call()).status).toBe(401);
    expect((await call(token("other"))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses everything when no secret is configured", async () => {
    process.env.INTERNAL_SERVICE_SECRET = "";
    expect((await call(token(""))).status).toBe(401);
  });
});
