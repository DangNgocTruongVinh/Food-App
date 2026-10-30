import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Giả lập chung trạng thái tài khoản cho requireAuth (xem src/test/setup.ts).
    setupFiles: ["src/test/setup.ts"],
  },
});
