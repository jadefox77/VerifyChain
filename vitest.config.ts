import { defineConfig } from "vitest/config"
import path from "path"

// Unit tests need nothing but Node. Database tests (tests/db) run only when
// TEST_DATABASE_URL points at a throwaway Postgres, as in CI.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      // Prisma reads DATABASE_URL when the client loads. Tests only ever use
      // TEST_DATABASE_URL, never your real DATABASE_URL.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@127.0.0.1:1/unused",
      QR_SECRET: "test-qr-secret",
      NEXTAUTH_SECRET: "test-nextauth-secret",
    },
    // The database tests share one database, so files run one at a time.
    fileParallelism: false,
  },
})
