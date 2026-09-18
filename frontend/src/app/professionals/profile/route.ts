import { NextResponse } from "next/server";

import { resolveLegacyProfessional } from "@/lib/api/directory";

// Spec 4.3: /professionals/profile/?id=<legacy> -> resolved professional slug
// URL, 301 when resolvable, otherwise 404. A Route Handler (not a page) because
// redirect() from a server component emits 307/303, not the 301 the spec fixes.
export async function GET(request: Request): Promise<NextResponse> {
  const legacyId = new URL(request.url).searchParams.get("id")?.trim();
  if (!legacyId) {
    return new NextResponse(null, { status: 404 });
  }

  let destination: string | null = null;
  try {
    destination = await resolveLegacyProfessional(legacyId);
  } catch {
    // An unreachable API is not a redirect: fall through to 404 rather than
    // throwing a 500 at a crawler following an old link.
    destination = null;
  }

  if (!destination) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.redirect(new URL(destination, request.url), 301);
}
