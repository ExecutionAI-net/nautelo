import { revalidateTag } from "next/cache";
import { createHash, timingSafeEqual } from "node:crypto";

import { UI_TEXT_TAG } from "@/i18n/server";

// Django calls this when staff press "Publish to platform", so edited text shows up at once instead of within a minute.
export async function POST(request: Request) {
  // Same derivation as the backend (config/settings/base.py): sha256("uitext:" + the shared internal secret).
  const secret = process.env.INTERNAL_SERVICE_SECRET ?? "";
  const expected = secret ? createHash("sha256").update(`uitext:${secret}`).digest("hex") : "";
  const given = request.headers.get("x-revalidate-token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidateTag(UI_TEXT_TAG, { expire: 0 });
  return Response.json({ ok: true });
}
