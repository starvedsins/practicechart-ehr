import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/*.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 20000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      include: [
        "src/lib/validation.ts",
        "src/lib/auth.ts",
        "src/lib/service.ts",
        "src/lib/storage.ts",
      ],
      reporter: ["text", "json-summary", "html"],
    },
    reporters: [
      "default",
      ["json", { outputFile: "docs/evidence/vitest-results.json" }],
    ],
  },
});
