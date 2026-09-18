/**
 * Allowlist local return URLs; prevent open redirects (spec 33.1).
 * Only a single-slash absolute path on this origin is accepted.
 */
export function isSafeNextUrl(value: string | null | undefined): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  // Control characters are rejected outright rather than stripped: a value that
  // needs cleaning to look safe is not a value we want to redirect to.
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f) return false;
  }
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.startsWith("/\\")) return false;
  return true;
}

export function safeNextUrl(
  value: string | null | undefined,
  fallback = "/",
): string {
  return isSafeNextUrl(value) ? (value as string) : fallback;
}
