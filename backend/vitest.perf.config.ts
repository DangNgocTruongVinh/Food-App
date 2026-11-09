import { defineConfig } from "vitest/config";

// Bài đo hiệu năng (*.perf.test.ts): chạy riêng, từng file một, để số đo không bị các test khác làm chậm.
export default defineConfig({
  test: {
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.perf.test.ts"],
    fileParallelism: false,
  },
});
