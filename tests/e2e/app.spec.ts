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
  await expect(page.getByText(/Uncoded - Awaiting project code/)).toBeVisible();
  await page.getByRole("button", { name: /ADMIN-0.2.0/ }).click();
  await expect(page.getByText("Build information")).toBeVisible();
  await expect(page.getByText("TIME-0.2.0", { exact: true })).toBeVisible();
});

test("protected workflow resolves an observed project description before export", async ({
  page,
}) => {
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
