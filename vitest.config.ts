import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // lr-core engine simulation is the slow part of each test. Run tests
    // serially (one fork) to avoid spawning many engine instances in parallel.
    pool: "forks",
    isolate: true,
    fileParallelism: false,
    testTimeout: 30_000,
    include: ["tests/**/*.test.ts"],
  },
});
