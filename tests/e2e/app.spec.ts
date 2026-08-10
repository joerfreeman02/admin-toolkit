import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";

function syntheticTimesheet(description: string) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    [null, null, "Synthetic template"],
    [],
    [],
    [],
    [2101, description, null, 2, 2],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Jul 26");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function syntheticUncodedTimesheet(description: string) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    [null, null, "Synthetic template"],
    [],
    [],
    [],
    [null, "Unknown Project", description, 2, 2],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Jul 26");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function syntheticAnnualTemplate(
  code = 4312,
  description = "Harbour Road Access",
) {
  const workbook = XLSX.utils.book_new();
  const rows: unknown[][] = Array.from({ length: 12 }, () => []);
  rows[8] = [null, "Job Number", "Job Name"];
  rows[10] = [null, code, description];
  rows[11] =
    code === 5120
      ? [null, 4312, "Harbour Road Access"]
      : [null, 5120, "Riverside Survey"];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    "Jul 26",
  );
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

async function configureAdmin(page: import("@playwright/test").Page) {
  await page.goto("./");
  await page.evaluate(() => {
    localStorage.setItem("eas-admin-authorised", "true");
    localStorage.setItem(
      "eas-admin-employee-register-v1",
      JSON.stringify({
        version: 1,
        employees: [
          {
            id: "employee-alpha",
            fullName: "Employee Alpha",
            aliases: [],
            assignments: [
              {
                effectiveFrom: "2026-07",
                department: "Drainage",
                grade: "Engineer",
                abbreviation: "EA",
                withinBandOrder: 0,
                active: true,
              },
            ],
          },
          {
            id: "employee-beta",
            fullName: "Employee Beta",
            aliases: [],
            assignments: [
              {
                effectiveFrom: "2026-07",
                department: "Transport",
                grade: "Engineer",
                abbreviation: "EB",
                withinBandOrder: 0,
                active: true,
              },
            ],
          },
        ],
      }),
    );
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
}

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
  await expect(page.getByText("Protected source context")).toHaveCount(0);
  await expect(page.getByText(/Uncoded · Awaiting project code/)).toBeVisible();
  await page.getByRole("button", { name: /ADMIN-0.2.0/ }).click();
  await expect(page.getByText("Build information")).toBeVisible();
  await expect(page.getByText("TIME-0.2.0", { exact: true })).toBeVisible();
});

test("protected workflow resolves an observed project description before export", async ({
  page,
}) => {
  await configureAdmin(page);
  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles([
    {
      name: "Employee Alpha Timesheet 2026-2027.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: syntheticTimesheet("Study A"),
    },
    {
      name: "Employee Beta Timesheet 2026-2027.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: syntheticTimesheet("Study B"),
    },
  ]);
  await page.getByRole("button", { name: "Process locally" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Resolve conflicting project descriptions",
    }),
  ).toBeVisible();
  await expect(page.getByText("Export blocker", { exact: true })).toBeVisible();
  const exportButton = page.getByRole("button", {
    name: "Generate Internal Hours workbook",
  });
  await expect(exportButton).toBeDisabled();
  await page
    .getByLabel("Canonical description for project 2101")
    .selectOption("Study B");
  await expect(page.getByText("Resolved", { exact: true })).toBeVisible();
  await expect(exportButton).toBeEnabled();
  await expect(
    page.getByRole("cell", { name: "Study B", exact: true }),
  ).toBeVisible();
});

test("annual workbook persists on the workstation and drives explicit uncoded matching", async ({
  page,
}) => {
  await configureAdmin(page);
  await page
    .locator('input[aria-label="Hours for Invoicing template"]')
    .setInputFiles({
      name: "Synthetic Annual Hours.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: syntheticAnnualTemplate(),
    });
  await expect(
    page.getByText(/Annual workbook saved on this workstation/),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await expect(
    page.getByText("Approved annual workbook stored on this workstation"),
  ).toBeVisible();
  const reopened = await page.context().newPage();
  await reopened.goto("./");
  await reopened
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await expect(
    reopened.getByText("Approved annual workbook stored on this workstation"),
  ).toBeVisible();
  await reopened.close();

  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles({
    name: "Employee Alpha Timesheet 2026-2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticUncodedTimesheet("Harbour Roud"),
  });
  await page.getByRole("button", { name: "Process locally" }).click();
  await expect(page.getByText("Harbour Roud", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("strong").filter({ hasText: /4312 · Harbour Road Access/ }),
  ).toBeVisible();
  await expect(page.getByText("Export blocker", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm this match" }).click();
  await expect(
    page.getByText("Decision recorded", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "4312", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate Project Hours workbook" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Leave unresolved" }).click();
  await expect(page.getByText("Export blocker", { exact: true })).toBeVisible();
  await page.getByText("Choose another existing project").click();
  await page.getByLabel("Search by project number or name").fill("5120");
  await page
    .getByLabel("Existing project")
    .selectOption("5120|Riverside Survey");
  await page.getByRole("button", { name: "Confirm selected project" }).click();
  await expect(
    page.getByText("Decision recorded", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "5120", exact: true }),
  ).toBeVisible();
  await page
    .locator('input[aria-label="Replace Hours for Invoicing template"]')
    .setInputFiles({
      name: "Replacement Synthetic Annual Hours.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: syntheticAnnualTemplate(5120, "Riverside Survey"),
    });
  await expect(
    page.getByText("Replacement Synthetic Annual Hours.xlsx"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove local workbook" }).click();
  await expect(page.getByLabel("Hours for Invoicing template")).toBeVisible();
});

test("encrypted employee publication rejects the wrong token and opens with the generated token", async ({
  page,
}) => {
  await configureAdmin(page);
  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles({
    name: "Employee Alpha Timesheet 2026-2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticTimesheet("Synthetic Project"),
  });
  await page.getByRole("button", { name: "Process locally" }).click();
  await page
    .getByRole("button", { name: "Generate secure employee token" })
    .click();
  const token = await page.locator(".one-time-token code").innerText();
  await page.getByText(/I confirm this month's project hours/).click();
  await page
    .getByRole("button", { name: "Publish approved month for employees" })
    .click();
  const link = await page
    .getByLabel("Encrypted employee-view link")
    .inputValue();
  expect(link).toContain("#employee-viewer=");
  expect(link).not.toContain("Employee Alpha");
  expect(link).not.toContain("Synthetic Project");

  await page.goto(link);
  await page.getByLabel("Employee Viewer token").fill("wrong-token");
  await page.getByRole("button", { name: "Open approved month" }).click();
  await expect(page.getByRole("alert")).toContainText(/incorrect|damaged/);
  await page.getByLabel("Employee Viewer token").fill(token);
  await page.getByText("Remember this workstation", { exact: true }).click();
  await page.getByRole("button", { name: "Open approved month" }).click();
  await expect(
    page.getByText(/Approved month · decrypted on this workstation/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Synthetic Project" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Employee Alpha" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Project total 2\.00/ }),
  ).toBeVisible();
  await expect(page.getByText(/Training|Holiday|Sick Leave/)).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("eas-employee-viewer-token-v1"),
    ),
  ).toBe(token);
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
    page.getByText("Public area · synthetic demonstration"),
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
