import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // src/** covers lib, components and page/route tests; the second entry
    // picks up the root-level next.config.test.ts, which would otherwise be
    // silently skipped.
    include: ["src/**/*.{test,spec}.{ts,tsx}", "*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
