import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiFetch }));

import { listModels, uploadMedia } from "@/lib/api/sellerListings";

afterEach(() => {
  vi.restoreAllMocks();
  apiFetch.mockReset();
});

describe("uploadMedia", () => {
  it("runs intent, direct upload, then complete", async () => {
    const file = new File(["abc"], "a.jpg", { type: "image/jpeg" });
    apiFetch
      .mockResolvedValueOnce({
        media: { id: "m1" },
        upload: { url: "https://s3.test/put", method: "PUT", headers: { "Content-Type": "image/jpeg" } },
      })
      .mockResolvedValueOnce({ id: "m1", status: "PROCESSING" })
      .mockResolvedValueOnce({ id: "m1", status: "READY" });
    const put = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    const row = await uploadMedia("l1", file);

    expect(apiFetch.mock.calls[0][0]).toBe("/api/v1/listings/l1/media/intents/");
    const intentBody = JSON.parse(apiFetch.mock.calls[0][1].body);
    expect(intentBody).toMatchObject({ media_type: "IMAGE", filename: "a.jpg", size: 3 });
    expect(intentBody.checksum_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(put).toHaveBeenCalledWith("https://s3.test/put", expect.objectContaining({ method: "PUT" }));
    expect(apiFetch.mock.calls[1][0]).toBe("/api/v1/listings/l1/media/m1/complete/");
    // It then polls the upload until the server-side checks have a verdict.
    expect(apiFetch.mock.calls[2][0]).toBe("/api/v1/listings/l1/media/m1/");
    expect(row.status).toBe("READY");
  });

  it("returns the rejection reason when the server refuses the file", async () => {
    apiFetch
      .mockResolvedValueOnce({
        media: { id: "m2" },
        upload: { url: "https://s3.test/put", method: "PUT", headers: {} },
      })
      .mockResolvedValueOnce({ id: "m2", status: "REJECTED", rejection_reason: "This image is too small." });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const row = await uploadMedia("l1", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    expect(row.status).toBe("REJECTED");
    expect(row.rejection_reason).toBe("This image is too small.");
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it("does not call complete when the storage upload fails", async () => {
    apiFetch.mockResolvedValueOnce({
      media: { id: "m1" },
      upload: { url: "https://s3.test/put", method: "PUT", headers: {} },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 403 }));
    await expect(uploadMedia("l1", new File(["x"], "a.png", { type: "image/png" }))).rejects.toThrow();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});

describe("listModels", () => {
  it("returns the Other placeholder alongside ordinary models", async () => {
    apiFetch.mockResolvedValueOnce({ results: [{ id: "a", name: "A", slug: "a" }], other: { id: "o", label: "Other" } });
    const choices = await listModels("b1");
    expect(choices.other?.id).toBe("o");
    expect(choices.models).toHaveLength(1);
  });
});
