import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/admin-toolkit/",
  define: {
    __BUILD_ID__: JSON.stringify(
      process.env.GITHUB_SHA?.slice(0, 8) ?? "local-dev",
    ),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
    coverage: { reporter: ["text", "html"] },
  },
});
