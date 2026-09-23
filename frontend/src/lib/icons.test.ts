import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MATERIAL_SYMBOLS_ICONS } from "@/lib/icons";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/** Every icon name the source can render: the text of an icon span (a bare word,
 * a string, or the branches of a ternary) and every `icon: "..."` / `icon="..."` prop. */
function iconNamesInSource(): Set<string> {
  const names = new Set<string>();
  for (const file of walk(join(__dirname, ".."))) {
    const source = readFileSync(file, "utf8");
    for (const span of source.matchAll(/material-symbols-outlined[^>]*>([\s\S]*?)<\/span>/g)) {
      const body = span[1];
      const bare = body.trim();
      if (/^[a-z][a-z_0-9]+$/.test(bare)) names.add(bare);
      for (const quoted of body.matchAll(/[?:{(>]\s*"([a-z][a-z_0-9]+)"/g)) names.add(quoted[1]);
    }
    for (const prop of source.matchAll(/\bicon(?:Name)?(?::\s*|=)"([a-z][a-z_0-9]+)"/g)) names.add(prop[1]);
  }
  return names;
}

describe("MATERIAL_SYMBOLS_ICONS", () => {
  it("contains every icon the source renders", () => {
    const listed = new Set(MATERIAL_SYMBOLS_ICONS);
    const missing = [...iconNamesInSource()].filter((name) => !listed.has(name)).sort();
    expect(missing).toEqual([]);
  });

  it("is alphabetical and unique, as the font API requires", () => {
    const sorted = [...new Set(MATERIAL_SYMBOLS_ICONS)].sort();
    expect([...MATERIAL_SYMBOLS_ICONS]).toEqual(sorted);
  });
});
