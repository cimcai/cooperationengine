import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

// Server-side tests run in a plain Node environment. The pure tests need no DB
// and no API keys; the getRunsHistory integration test additionally needs a
// Postgres via DATABASE_URL (it self-skips when that is absent). Client/React
// tests are out of scope here.
export default defineConfig({
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  test: {
    include: ["server/**/*.test.ts"],
    environment: "node",
  },
});
