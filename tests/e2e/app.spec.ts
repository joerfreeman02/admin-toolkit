import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

function syntheticTimesheet(
  description: string,
  sheetName = "Jul 26",
  total = 2,
  daily = 2,
) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    [null, null, "Synthetic template"],
    [],
    [],
    [],
    [2101, description, null, total, daily],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function syntheticUncodedTimesheet(...descriptions: string[]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    [null, null, "Synthetic template"],
    [],
    [],
    [],
    ...descriptions.map((description) => [
      null,
      "Unknown Project",
      description,
      2,
      2,
    ]),
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Jul 26");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function syntheticInternalSuggestionTimesheet() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [null, null, "Synthetic template"],
      [],
      [],
      [],
      [null, "Unknown Project", "17.25hrs in lieu from June", 2, 2],
    ]),
    "Jul 26",
  );
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function syntheticQaTimesheet() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [null, null, "Synthetic template"],
      [],
      [],
      [],
      [2101, "Synthetic Project", null, 1, 1],
      [10008, "Training", null, 1, 1],
      [null, "Unknown Project", "Sensitive unknown wording", 2, 2],
      [null, "Unknown Project", "Duplicate private wording", 2, 2],
    ]),
    "Jul 26",
  );
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function syntheticJobRegister(
  projects: Array<{
    code: string;
    name: string;
    client?: string;
    manager?: string;
    director?: string;
  }> = [
    {
      code: "7005",
      name: "Mill Lane, Sawston",
      client: "Bidwells",
      manager: "Manager Alpha",
      director: "Director Beta",
    },
    { code: "7010", name: "Riverside Access" },
  ],
) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [
        "Project",
        "Project Name",
        "Client",
        "Project Manager",
        "Project Director",
        null,
        "Helper",
      ],
      ...projects.map((project) => [
        project.code,
        project.name,
        project.client,
        project.manager,
        project.director,
        "ignored",
        "not catalogue data",
      ]),
    ]),
    "Job Register",
  );
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsm" });
}

async function syntheticLatestMonthlyWorkbook(
  code = 4312,
  description = "Harbour Road Access",
  sheetName = "Jun 26",
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  ["FFFFFF00", "FFFFC000", "FF92D050", "FF95A6BD"].forEach((color, index) => {
    const cell = sheet.getCell(3 + index, 3);
    cell.value = [
      "HRS to be invoiced highlighted in yellow hatch",
      "Invoices sent",
      "These hours need to be carried over for invoicing",
      "These hours were carried but have now been invoiced",
    ][index];
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  });
  sheet.getCell("B9").value = "Job Number";
  sheet.getCell("C9").value = "Job Name";
  sheet.getCell("D9").value = "EA";
  sheet.getCell("E9").value = "Hours to be carried from previous months";
  sheet.getCell("F9").value = "Notes";
  sheet.getCell("B11").value = code;
  sheet.getCell("C11").value = description;
  sheet.getCell("B12").value = code === 5120 ? 4312 : 5120;
  sheet.getCell("C12").value =
    code === 5120 ? "Harbour Road Access" : "Riverside Survey";
  return Buffer.from(
    (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array,
  );
}

async function syntheticCarryWorkbook(
  employeeAbbreviation = "OLD",
  sheetName = "Mar 26",
  projectCode: number | undefined = 4312,
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  ["FFFFFF00", "FFFFC000", "FF92D050", "FF95A6BD"].forEach((color, index) => {
    const cell = sheet.getCell(3 + index, 3);
    cell.value = [
      "HRS to be invoiced highlighted in yellow hatch",
      "Invoices sent",
      "These hours need to be carried over for invoicing",
      "These hours were carried but have now been invoiced",
    ][index];
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: color },
    };
  });
  sheet.getCell("B9").value = "Job Number";
  sheet.getCell("C9").value = "Job Name";
  sheet.getCell("D9").value = employeeAbbreviation;
  sheet.getCell("E9").value = "Hours to be carried from previous months";
  sheet.getCell("F9").value = "Notes";
  sheet.getCell("B11").value = projectCode;
  sheet.getCell("C11").value = "Historical Project";
  sheet.getCell("D11").value = 3.5;
  sheet.getCell("D11").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF92D050" },
  };
  return Buffer.from(
    (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array,
  );
}

async function configureAdmin(
  page: import("@playwright/test").Page,
  includeLatestWorkbook = true,
) {
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
  if (includeLatestWorkbook) {
    await page
      .locator('input[aria-label="Current hours workbook"]')
      .setInputFiles({
        name: "Synthetic Latest Monthly Workbook.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: await syntheticLatestMonthlyWorkbook(),
      });
    await expect(
      page.getByText(/Current hours workbook: 2026\/27/),
    ).toBeVisible();
  }
}

test("landing, public viewer and Sprint 1 build information are available", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", {
      name: /Monthly timesheets turned into clear, ready-to-use reports/,
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
  await page.getByRole("button", { name: /NEXUS-1.0.0-rc.2/ }).click();
  await expect(page.getByText("Build information")).toBeVisible();
  await expect(
    page.getByText("TIME-1.0.0-rc.2", { exact: true }),
  ).toBeVisible();
});

test("Job Register loads values-only, persists, replaces safely and drives a compact project search", async ({
  page,
}) => {
  await configureAdmin(page);
  const source = syntheticJobRegister();
  const sourceCopy = Buffer.from(source);
  await page.locator('input[aria-label="Choose Job Register"]').setInputFiles({
    name: "Synthetic Job Register.xlsm",
    mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
    buffer: source,
  });
  await expect(
    page.getByText(/Latest copy — ready · 2 projects/),
  ).toBeVisible();
  expect(source.equals(sourceCopy)).toBe(true);

  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await expect(
    page.getByText(/Latest copy — ready · 2 projects/),
  ).toBeVisible();

  await page
    .locator('input[aria-label="Replace with latest Job Register"]')
    .setInputFiles({
      name: "Replacement Job Register.xlsm",
      mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
      buffer: syntheticJobRegister([
        {
          code: "7005",
          name: "Mill Lane, Sawston",
          client: "Bidwells",
          manager: "Manager Alpha",
          director: "Director Beta",
        },
        { code: "7020", name: "Replacement Project" },
      ]),
    });
  await expect(page.getByText(/Latest Job Register saved/)).toBeVisible();

  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles({
    name: "Employee Alpha Timesheet 2026-2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticUncodedTimesheet("Mill Lane Sawston"),
  });
  await page.getByRole("button", { name: "Check files" }).click();
  await expect(page.getByText(/7005 · Mill Lane, Sawston/)).toBeVisible();
  await page.getByText("Search projects", { exact: true }).click();
  await page
    .getByLabel("Project number, name, client or manager")
    .fill("Bidwells");
  await expect(page.locator(".project-search-results button")).toHaveCount(1);
  await expect(page.locator(".project-search select")).toHaveCount(0);

  await page
    .locator('input[aria-label="Replace with latest Job Register"]')
    .setInputFiles({
      name: "Invalid Job Register.xlsm",
      mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
      buffer: XLSX.write(
        (() => {
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.aoa_to_sheet([["Wrong", "Headers"]]),
            "Other",
          );
          return workbook;
        })(),
        { type: "buffer", bookType: "xlsm" },
      ),
    });
  await expect(
    page.getByText(/does not contain a worksheet named "Job Register"/),
  ).toBeVisible();
  await expect(
    page.getByText(/Latest copy — ready · 2 projects/),
  ).toBeVisible();
});

test("internal suggestions remain advisory and accept in one deliberate click", async ({
  page,
}) => {
  await configureAdmin(page);
  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles({
    name: "Employee Alpha Timesheet 2026-2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticInternalSuggestionTimesheet(),
  });
  await page.getByRole("button", { name: "Check files" }).click();
  await expect(page.getByText("Likely match")).toBeVisible();
  await expect(page.locator(".internal-suggestion strong")).toContainText(
    "Time in Lieu",
  );
  await expect(page.getByText("1 item still needs a decision")).toBeVisible();
  await page.getByRole("button", { name: "Use Time in Lieu" }).click();
  await expect(page.getByText("Nothing left to review.")).toBeVisible();
  await expect(
    page.getByText(/0 internal categories · 2\.00 Time in Lieu hours/),
  ).toBeVisible();
});

test("Unknown and Excluded are completed one-click outcomes with rich bounded source context", async ({
  page,
}) => {
  await configureAdmin(page);
  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles({
    name: "Employee Alpha Timesheet 2026-2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticQaTimesheet(),
  });
  await page.getByRole("button", { name: "Check files" }).click();
  await expect(page.getByText("Reports aren't ready yet")).toBeVisible();
  await expect(
    page.getByText("Some timesheet entries still need a decision."),
  ).toBeHidden();

  await page.getByText("Open original entry").click();
  await expect(page.getByText("Recorded hours")).toBeVisible();
  await expect(
    page.locator(".source-context-grid dd").filter({
      hasText: "Sensitive unknown wording",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View surrounding rows" }).click();
  await expect(page.locator(".source-row-context tbody tr")).toHaveCount(4);
  const sourceDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download original timesheet" })
    .click();
  await sourceDownload;

  await page.getByRole("button", { name: "Leave as Unknown Project" }).click();
  await expect(page.locator(".exception-heading")).toContainText(
    "Duplicate private wording",
  );
  await page.getByRole("button", { name: "Exclude these hours" }).click();
  await expect(page.getByText("Nothing left to review.")).toBeVisible();
  await expect(
    page.getByText(
      /1 identified projects · 2.00 unknown hours · 2.00 excluded hours/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download report" }),
  ).toBeEnabled();
  await expect(page.getByText("Create employee access code")).toBeVisible();
  await expect(
    page.getByText(
      /shared pilot token|Generate secure employee token|interim pilot security/i,
    ),
  ).toHaveCount(0);
  const projectDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report" }).click();
  const projectFile = await projectDownload;
  const internalDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download directors' report" })
    .click();
  const internalFile = await internalDownload;
  if (process.env.NEXUS_QA_OUTPUT_DIR) {
    await mkdir(process.env.NEXUS_QA_OUTPUT_DIR, { recursive: true });
    await projectFile.saveAs(
      path.join(
        process.env.NEXUS_QA_OUTPUT_DIR,
        `qa-${projectFile.suggestedFilename()}`,
      ),
    );
    await internalFile.saveAs(
      path.join(
        process.env.NEXUS_QA_OUTPUT_DIR,
        `qa-${internalFile.suggestedFilename()}`,
      ),
    );
  }
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
  await page.getByRole("button", { name: "Check files" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Choose the project name to use",
    }),
  ).toBeVisible();
  const exportButton = page.getByRole("button", {
    name: "Download directors' report",
  });
  await expect(exportButton).toBeDisabled();
  await page
    .getByLabel("Canonical description for project 2101")
    .selectOption("Study B");
  await page.getByRole("button", { name: "Save & next" }).click();
  await expect(page.getByText("Nothing left to review.")).toBeVisible();
  await expect(exportButton).toBeEnabled();
  await expect(page.getByText("Report preview")).toHaveCount(0);
});

test("financial-year workbooks persist, replace safely, retain history and drive explicit uncoded matching", async ({
  page,
}) => {
  await configureAdmin(page, false);
  await page
    .locator('input[aria-label="Current hours workbook"]')
    .setInputFiles({
      name: "Synthetic Latest Monthly Workbook.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await syntheticLatestMonthlyWorkbook(),
    });
  await expect(
    page.getByText(/Current hours workbook: 2026\/27/),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await expect(
    page.getByText(/Current hours workbook: 2026\/27/),
  ).toBeVisible();
  const reopened = await page.context().newPage();
  await reopened.goto("./");
  await reopened
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await expect(
    reopened.getByText(/Current hours workbook: 2026\/27/),
  ).toBeVisible();
  await reopened.close();

  await page
    .locator('input[aria-label="Previous year hours workbook"]')
    .setInputFiles({
      name: "Synthetic Previous Year.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await syntheticLatestMonthlyWorkbook(
        4312,
        "Earlier Harbour Work",
        "Mar 26",
      ),
    });
  await expect(
    page.getByText(/Previous year: 2025\/26 — retained/),
  ).toBeVisible();

  await page
    .locator('input[aria-label="Replace current hours workbook"]')
    .setInputFiles({
      name: "Replacement Latest Monthly Workbook.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await syntheticLatestMonthlyWorkbook(5120, "Riverside Survey"),
    });
  await expect(
    page.getByText("Replacement Latest Monthly Workbook.xlsx"),
  ).toBeVisible();
  const saved = await page.evaluate(
    () =>
      new Promise<
        Array<{ financialYear: string; fileName: string; role: string }>
      >((resolve, reject) => {
        const request = indexedDB.open("eas-admin-toolkit-workstation-v1", 4);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const getAll = database
            .transaction("financial-year-workbooks", "readonly")
            .objectStore("financial-year-workbooks")
            .getAll();
          getAll.onerror = () => reject(getAll.error);
          getAll.onsuccess = () => {
            resolve(getAll.result);
            database.close();
          };
        };
      }),
  );
  expect(saved).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        financialYear: "2026/27",
        fileName: "Replacement Latest Monthly Workbook.xlsx",
        role: "current",
      }),
      expect.objectContaining({
        financialYear: "2025/26",
        role: "historical",
      }),
    ]),
  );
  expect(saved).toHaveLength(2);

  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles({
    name: "Employee Alpha Timesheet 2026-2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticUncodedTimesheet("Harbour Roud"),
  });
  await page.getByRole("button", { name: "Check files" }).click();
  await expect(page.locator(".exception-heading")).toContainText(
    "Harbour Roud",
  );
  await expect(
    page.getByRole("strong").filter({ hasText: /4312 · Harbour Road Access/ }),
  ).toBeVisible();
  await expect(
    page
      .locator(".exception-card")
      .getByText("Needs a decision", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use this project" }).click();
  await expect(page.getByText("Nothing left to review.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("button", { name: "Download report" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Add this month's files" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Review anything NEXUS couldn't identify",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Create monthly reports" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Publish employee viewer",
      exact: true,
    }),
  ).toBeVisible();
  const operatorText = await page.locator(".admin-workflow").innerText();
  expect(operatorText).not.toMatch(
    /IndexedDB|\bSHA\b|schema|reconciliation engine|database/i,
  );
});

test("guided review shows one current item, skips without loss, advances, and keeps reports compact", async ({
  page,
}) => {
  await configureAdmin(page);
  await expect(page.getByText("July 2026", { exact: true })).toBeVisible();
  await expect(page.getByText("Manage employee list")).toBeVisible();
  await expect(page.locator(".register-table")).toBeHidden();
  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles({
    name: "Employee Alpha Timesheet 2026-2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticUncodedTimesheet(
      "Harbour Road Access",
      "Riverside Survey",
    ),
  });
  await page.getByRole("button", { name: "Check files" }).click();

  await expect(page.locator(".exception-card")).toHaveCount(1);
  await expect(page.locator(".exception-heading")).toContainText(
    "Harbour Road Access",
  );
  await expect(page.locator(".exception-heading")).not.toContainText(
    "Riverside Survey",
  );
  await expect(
    page.getByText("2 items still need a decision", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Item 1 of 2 · 2 remaining")).toBeVisible();

  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.locator(".exception-heading")).toContainText(
    "Riverside Survey",
  );
  await expect(page.locator(".exception-heading")).not.toContainText(
    "Harbour Road Access",
  );
  await expect(page.getByText("Item 2 of 2 · 2 remaining")).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.locator(".exception-heading")).toContainText(
    "Harbour Road Access",
  );

  await page.getByRole("button", { name: "Use this project" }).click();
  await expect(page.locator(".exception-heading")).toContainText(
    "Riverside Survey",
  );
  await expect(page.getByText("Item 2 of 2 · 1 remaining")).toBeVisible();
  await page.getByRole("button", { name: "Use this project" }).click();
  await expect(page.getByText("Nothing left to review.")).toBeVisible();

  await expect(page.getByText("Report preview")).toHaveCount(0);
  await expect(page.getByText(/2 identified projects/)).toBeVisible();
  await expect(page.getByText(/0 internal categories/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Add this month's files" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Review anything NEXUS couldn't identify",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Create monthly reports" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Publish employee viewer",
      exact: true,
    }),
  ).toBeVisible();

  const projectDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report" }).click();
  const projectFile = await projectDownload;
  const internalDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download directors' report" })
    .click();
  const internalFile = await internalDownload;
  if (process.env.NEXUS_QA_OUTPUT_DIR) {
    await mkdir(process.env.NEXUS_QA_OUTPUT_DIR, { recursive: true });
    await projectFile.saveAs(
      path.join(
        process.env.NEXUS_QA_OUTPUT_DIR,
        projectFile.suggestedFilename(),
      ),
    );
    await internalFile.saveAs(
      path.join(
        process.env.NEXUS_QA_OUTPUT_DIR,
        internalFile.suggestedFilename(),
      ),
    );
  }
});

test("historical employee decisions are separate, persist, and are not requested again", async ({
  page,
}) => {
  await configureAdmin(page);
  await page
    .locator('input[aria-label="Previous year hours workbook"]')
    .setInputFiles({
      name: "Historical Carry.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await syntheticCarryWorkbook(),
    });
  await expect(
    page.getByText(/Previous year: 2025\/26 — retained/),
  ).toBeVisible();
  const timesheet = {
    name: "Employee Alpha Timesheet 2026-2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticTimesheet("Current Project"),
  };
  await page
    .locator('input[aria-label="Timesheets or ZIP"]')
    .setInputFiles(timesheet);
  await page.getByRole("button", { name: "Check files" }).click();
  await expect(page.getByText("Nothing left to review.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/1 older item needs checking/)).toBeVisible();
  await expect(page.getByText("Identify OLD")).toBeHidden();
  await page.getByText("Review older items").click();
  await expect(page.getByText("Identify OLD")).toBeVisible();
  await page.getByRole("button", { name: "Treat as former employee" }).click();
  await expect(page.getByText("All previously reviewed ✓")).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("eas-nexus-historical-review-v1"),
    ),
  ).toContain("historical-former:OLD");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("eas-admin-employee-register-v1") ?? "{}",
        ).employees.length,
    ),
  ).toBe(2);

  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await page
    .locator('input[aria-label="Timesheets or ZIP"]')
    .setInputFiles(timesheet);
  await page.getByRole("button", { name: "Check files" }).click();
  await expect(page.getByText("All previously reviewed ✓")).toBeVisible();
  await expect(page.getByText("Identify OLD")).toHaveCount(0);
});

test("carry queues distinguish Current and Previous FY authority and reveal one card only when opened", async ({
  page,
}) => {
  await configureAdmin(page, false);
  await page
    .locator('input[aria-label="Current hours workbook"]')
    .setInputFiles({
      name: "Current FY Missing Project.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await syntheticCarryWorkbook("EA", "Jun 26", undefined),
    });
  await page
    .locator('input[aria-label="Previous year hours workbook"]')
    .setInputFiles({
      name: "Previous FY Missing Project.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await syntheticCarryWorkbook("EA", "Mar 26", undefined),
    });
  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles({
    name: "Employee Alpha Timesheet 2026-2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticTimesheet("Current Project"),
  });
  await page.getByRole("button", { name: "Check files" }).click();

  await expect(page.getByText("Current-year carry-over checks")).toBeVisible();
  await expect(page.getByText("Older carry-over checks")).toBeVisible();
  await expect(
    page.getByText(
      "These entries are still marked to carry forward in the current hours workbook.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "These are older records that may still affect carry-over. You only need to review them once.",
    ),
  ).toBeVisible();
  await expect(page.locator("article.guided-review-card")).toHaveCount(0);

  await page.getByRole("button", { name: "Review current items" }).click();
  await expect(page.locator("article.guided-review-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Keep as Unknown Project carry" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Already dealt with — don't carry forward",
    }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Review older items" }).click();
  await expect(page.locator("article.guided-review-card")).toHaveCount(1);
  await expect(
    page.getByText(
      "This older carried-hours entry does not have a project number. Choose what should happen to it.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Already dealt with — don't carry forward",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Keep as Unknown Project carry" }),
  ).toBeVisible();
});

test("timesheet warnings use plain English while retaining optional diagnostic evidence", async ({
  page,
}) => {
  await configureAdmin(page);
  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles({
    name: "Employee Alpha Timesheet 2026-2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticTimesheet("Current Project", "Jul 26", 3, 2),
  });
  await page.getByRole("button", { name: "Check files" }).click();
  await expect(
    page.getByText(
      /Employee Alpha's timesheet contains a total that does not match/i,
    ),
  ).toBeVisible();
  await expect(page.getByText(/column-D total differs/i)).toBeHidden();
  await page.getByText(/More details \(1\)/).click();
  await expect(page.getByText(/column-D total differs/i)).toBeVisible();
});

test("April report creation initialises a new financial year and retains the previous workbook unchanged", async ({
  page,
}) => {
  await configureAdmin(page, false);
  await page.getByLabel("Reporting month").fill("2027-04");
  const previousBytes = await syntheticLatestMonthlyWorkbook(
    4312,
    "Previous-year structure",
    "Mar 27",
  );
  await page
    .locator('input[aria-label="Previous year hours workbook"]')
    .setInputFiles({
      name: "Previous 2026-27.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: previousBytes,
    });
  await expect(
    page.getByText(/Previous year: 2026\/27 — retained/),
  ).toBeVisible();
  await expect(page.getByText(/Starting a new financial year/)).toBeVisible();
  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles({
    name: "Employee Alpha Timesheet 2027-2028.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticTimesheet("April Project", "Apr 27"),
  });
  await page.getByRole("button", { name: "Check files" }).click();
  await page.getByRole("button", { name: "Download report" }).click();
  await expect(
    page.getByText("Project-hours workbook generated locally."),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Current hours workbook: 2027\/28 — updated through April 2027/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/Previous year: 2026\/27 — retained/),
  ).toBeVisible();
  const saved = await page.evaluate(
    () =>
      new Promise<
        Array<{ financialYear: string; role: string; dataByteLength: number }>
      >((resolve, reject) => {
        const request = indexedDB.open("eas-admin-toolkit-workstation-v1", 4);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const getAll = database
            .transaction("financial-year-workbooks", "readonly")
            .objectStore("financial-year-workbooks")
            .getAll();
          getAll.onerror = () => reject(getAll.error);
          getAll.onsuccess = () => {
            resolve(
              getAll.result.map(
                (item: {
                  financialYear: string;
                  role: string;
                  data: ArrayBuffer;
                }) => ({
                  financialYear: item.financialYear,
                  role: item.role,
                  dataByteLength: item.data.byteLength,
                }),
              ),
            );
            database.close();
          };
        };
      }),
  );
  expect(saved.map((item) => [item.financialYear, item.role])).toEqual(
    expect.arrayContaining([
      ["2026/27", "historical"],
      ["2027/28", "current"],
    ]),
  );
  expect(
    saved.find((item) => item.financialYear === "2026/27")?.dataByteLength,
  ).toBe(previousBytes.byteLength);
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
  await page.getByRole("button", { name: "Check files" }).click();
  await page
    .getByRole("button", { name: "Create employee access code" })
    .click();
  const token = await page.locator(".one-time-token code").innerText();
  await page.getByText(/I confirm this month is ready to publish/).click();
  await page.getByRole("button", { name: "Publish Employee Viewer" }).click();
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
  await expect(
    page.getByText("Create this month's hours reports"),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await expect(
    page.getByText("Create this month's hours reports"),
  ).toBeVisible();
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
