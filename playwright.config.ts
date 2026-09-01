import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:4173/admin-toolkit/" },
  webServer: {
    command:
      "pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/admin-toolkit/",
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_ADMIN_TOKEN_SHA256:
        "09f6b0c68aed236a30e85fed2810a7dad18c60f12ce54fffb4dbd24111eccebb",
      VITE_PUBLICATION_API_URL:
        "http://127.0.0.1:4173/employee-publications-api/",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
