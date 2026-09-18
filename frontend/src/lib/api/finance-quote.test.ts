import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The disclosure is a client component. If this module ever imports the
// server-only directory fetchers again, `next build` fails with "next/headers
// ... Pages Router"; unit tests do not see that, so pin the import graph here.
describe("finance-quote client module", () => {
  const source = readFileSync(resolve(__dirname, "finance-quote.ts"), "utf-8");

  it("imports nothing but the client fetch helper", () => {
    const imports = [...source.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]);

    expect(imports).toEqual(["@/lib/api/client"]);
  });
});
