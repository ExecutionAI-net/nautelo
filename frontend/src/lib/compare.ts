// The visitor's "compare" shortlist: listing ids kept in the browser only
// (spec §2.1 - nothing here is invented, the page fetches every boat by id).

export const COMPARE_MAX = 4;
export const COMPARE_STORAGE_KEY = "nautelo.compare";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parse a comma-separated `ids` query value into unique uuid-looking ids, capped at COMPARE_MAX. */
export function parseCompareIds(raw: string | string[] | undefined | null): string[] {
  const text = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const ids: string[] = [];
  for (const part of text.split(",")) {
    const id = part.trim().toLowerCase();
    if (UUID.test(id) && !ids.includes(id)) ids.push(id);
    if (ids.length === COMPARE_MAX) break;
  }
  return ids;
}

export function comparePath(ids: string[]): string {
  return ids.length ? `/boats/compare/?ids=${ids.join(",")}` : "/boats/compare/";
}

let cached = "";
let cachedIds: string[] = [];
const listeners = new Set<() => void>();

function readRaw(): string {
  try {
    return window.localStorage.getItem(COMPARE_STORAGE_KEY) ?? "";
  } catch {
    return cached;
  }
}

/** Snapshot for useSyncExternalStore: the same array instance while the stored value is unchanged. */
export function readCompareIds(): string[] {
  const raw = readRaw();
  if (raw !== cached) {
    cached = raw;
    cachedIds = parseCompareIds(raw);
  }
  return cachedIds;
}

export function writeCompareIds(ids: string[]) {
  try {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, ids.join(","));
  } catch {
    // Private mode or blocked storage: the shortlist lives for this page view only.
    cached = ids.join(",");
    cachedIds = ids;
  }
  for (const listener of listeners) listener();
}

/** Subscribe for useSyncExternalStore: this tab's writes and other tabs' storage events. */
export function subscribeCompare(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const EMPTY: string[] = [];
export const serverCompareIds = () => EMPTY;
