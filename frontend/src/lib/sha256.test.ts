import { describe, expect, it } from "vitest";

import { sha256HexSync } from "@/lib/sha256";

describe("sha256HexSync", () => {
  it("matches the known digests", () => {
    expect(sha256HexSync(new Uint8Array())).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256HexSync(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("handles inputs longer than one block", () => {
    const long = new TextEncoder().encode("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq");
    expect(sha256HexSync(long)).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });
});
