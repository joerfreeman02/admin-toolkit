import { expect, test } from "@playwright/test";

test("landing, public viewer and Sprint 1 build information are available", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", {
      name: /Monthly timesheets consolidated with every hour accounted for/,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Public Employee Viewer", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Station Access Study", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Holiday|Sick Leave/)).toHaveCount(0);
  await expect(page.getByText(/Uncoded - Awaiting project code/)).toBeVisible();
  await page.getByRole("button", { name: /ADMIN-0.2.0/ }).click();
  await expect(page.getByText("Build information")).toBeVisible();
  await expect(page.getByText("TIME-0.2.0", { exact: true })).toBeVisible();
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
  await expect(page.getByText("Monthly timesheet consolidation")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await expect(page.getByText("Monthly timesheet consolidation")).toBeVisible();
  await page.getByRole("button", { name: "Logout / reset" }).click();
  await expect(
    page.getByRole("heading", { name: "Administrative access" }),
  ).toBeVisible();
});

test("keyboard activation reaches the synthetic public viewer", async ({
  page,
}) => {
  await page.goto("./");
  const viewerButton = page.getByRole("button", {
    name: "Public Employee Viewer",
    exact: true,
  });
  await viewerButton.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Public area - synthetic data only"),
  ).toBeVisible();
});

test("About page presents the approved creator credit on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.getByRole("button", { name: "About", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Joe Freeman" }),
  ).toBeVisible();
  await expect(
    page.getByText("Creator & Product Owner — AI Engineering Toolkits"),
  ).toBeVisible();
  await expect(page.getByAltText("Portrait of Joe Freeman")).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});
