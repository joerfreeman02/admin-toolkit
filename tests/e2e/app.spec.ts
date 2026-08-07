import { expect, test } from "@playwright/test";
test("landing, public viewer and build information are available", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: /Controlled timesheet ingestion/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Public Employee Viewer", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Station Access Study", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Holiday|Sick Leave/)).toHaveCount(0);
  await expect(page.getByText(/Uncoded · Awaiting project code/)).toBeVisible();
  await page.getByRole("button", { name: /ADMIN-0.1.1/ }).click();
  await expect(page.getByText("Build information")).toBeVisible();
});
test("admin route gates, remembered state survives reload, and logout revokes it", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Administrative access" }),
  ).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem("eas-admin-authorised", "true"),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await expect(page.getByText("Timesheet processing")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await expect(page.getByText("Timesheet processing")).toBeVisible();
  await page.getByRole("button", { name: "Logout / reset" }).click();
  await expect(
    page.getByRole("heading", { name: "Administrative access" }),
  ).toBeVisible();
});
test("keyboard navigation reaches the public viewer", async ({ page }) => {
  await page.goto("./");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Sprint 0 · prototype foundation")).toBeVisible();
});
