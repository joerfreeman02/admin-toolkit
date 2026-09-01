import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

const realCarryFixturePaths = {
  register: process.env.NEXUS_ACCEPTANCE_REGISTER,
  current: process.env.NEXUS_ACCEPTANCE_WORKBOOK,
  previous: process.env.NEXUS_ACCEPTANCE_PREVIOUS_WORKBOOK,
  timesheets: process.env.NEXUS_ACCEPTANCE_TIMESHEETS,
};
const realCarryFixturesAvailable = Object.values(realCarryFixturePaths).every(
  Boolean,
);

async function installPublicationApi(page: Page) {
  const publications = new Map<string, string>();
  await page.route("**/employee-publications-api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/sessions")) {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ token: "short-lived-test-session" }),
      });
      return;
    }
    const id = url.pathname.split("/").at(-1) ?? "";
    if (request.method() === "POST") {
      publications.set(id, request.postData() ?? "");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id }),
      });
      return;
    }
    if (request.method() === "GET") {
      const value = publications.get(id);
      await route.fulfill(
        value
          ? { status: 200, contentType: "application/json", body: value }
          : { status: 404, contentType: "application/json", body: "{}" },
      );
      return;
    }
    await route.fulfill({
      status: 405,
      contentType: "application/json",
      body: "{}",
    });
  });
}

function syntheticTimesheet(
  description: string,
  sheetName = "Jul 26",
  total = 2,
  daily = 2,
  projectCode = 2101,
) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    [null, null, "Synthetic template"],
    [],
    [],
    [],
    [projectCode, description, null, total, daily],
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

async function syntheticTpcWorkbook(
  sheetName = "Jul 2026",
  supplier = "Mapping Supplier",
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  [
    "Date",
    "Company Name",
    "Project Manager",
    "Project No.",
    "What it Was for",
    "Net Amount",
    "VAT",
    "Gross Amount",
    "Credit Card",
    "BACS",
    "Miles",
    "Invoice number charged on",
    "Notes",
  ].forEach((header, index) => {
    sheet.getCell(2, index + 1).value = header;
  });
  const rows = [
    [
      new Date("2026-07-10"),
      supplier,
      "PM",
      "2101",
      "Mapping data",
      100,
      20,
      120,
    ],
    [
      new Date("2026-07-11"),
      "Already Invoiced Supplier",
      "PM",
      "2101",
      "Closed cost",
      50,
      10,
      60,
    ],
    [
      new Date("2026-07-11"),
      "Invoiced Missing Project Supplier",
      "PM",
      "",
      "Closed incomplete cost",
      50,
      10,
      60,
    ],
    [
      new Date("2026-07-11"),
      "Invoiced N/A Supplier",
      "PM",
      "N/A",
      "Closed N/A cost",
      50,
      10,
      60,
    ],
    [
      new Date("2026-07-11"),
      "Invoiced XXXX Supplier",
      "PM",
      "XXXX",
      "Closed XXXX cost",
      50,
      10,
      60,
    ],
    [
      new Date("2026-07-12"),
      "Unallocated Supplier",
      "PM",
      "N/A",
      "Recognisable cost",
      "-",
      "n/a",
      null,
    ],
  ];
  rows.forEach((values, index) => {
    const row = index + 3;
    values.forEach((value, column) => {
      const cell = sheet.getCell(row, column + 1);
      cell.value = value;
      if (![1, 2, 3, 4].includes(index))
        cell.font = { ...cell.font, color: { argb: "FFFF0000" } };
    });
  });
  workbook.addWorksheet("Sheet1");
  return Buffer.from(
    (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array,
  );
}

async function syntheticCarryWorkbook(
  employeeAbbreviation = "OLD",
  sheetName = "Mar 26",
  projectCode: number | null = 4312,
  missingProjectRows = 1,
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
  if (projectCode === null && missingProjectRows > 1) {
    sheet.getCell("C12").value = "Second historical project";
    sheet.getCell("D12").value = 4.25;
    sheet.getCell("D12").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF92D050" },
    };
  }
  return Buffer.from(
    (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array,
  );
}

async function syntheticContinuityWorkbook(
  projectCode: number | null = 4312,
  includeCurrentCandidate = false,
) {
  const workbook = new ExcelJS.Workbook();
  for (const sheetName of ["Apr 26", "May 26", "Jun 26", "Jul 26"]) {
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
    sheet.getCell("D9").value = "EA";
    sheet.getCell("E9").value = "Hours to be carried from previous months";
    sheet.getCell("F9").value = "Notes";
    sheet.getCell("B11").value = projectCode;
    sheet.getCell("C11").value = "Historical Project";
    for (const cell of [sheet.getCell("B11"), sheet.getCell("C11")])
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF92D050" },
      };
    if (includeCurrentCandidate && sheetName === "Jul 26") {
      sheet.getCell("D11").value = 3.5;
      sheet.getCell("D11").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF92D050" },
      };
    }
  }
  return Buffer.from(
    (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array,
  );
}

async function syntheticLifecycleWorkbooks() {
  const addSheet = (
    workbook: ExcelJS.Workbook,
    name: string,
    projects: Array<{
      code: number;
      description: string;
      abbreviation: "EA" | "EB";
      hours: number;
      fill: "FFFFC000" | "FF92D050";
    }>,
  ) => {
    const sheet = workbook.addWorksheet(name);
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
    sheet.getCell("D9").value = "EA";
    sheet.getCell("E9").value = "EB";
    sheet.getCell("F9").value = "Hours to be carried from previous months";
    sheet.getCell("G9").value = "Notes";
    projects.forEach((project, index) => {
      const row = 11 + index;
      sheet.getCell(row, 2).value = project.code;
      sheet.getCell(row, 3).value = project.description;
      const cell = sheet.getCell(row, project.abbreviation === "EA" ? 4 : 5);
      cell.value = project.hours;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: project.fill },
      };
    });
  };
  const previous = new ExcelJS.Workbook();
  addSheet(previous, "Jan 26", [
    {
      code: 6526,
      description: "5 Hampton Mead, Loughton",
      abbreviation: "EA",
      hours: 0.5,
      fill: "FF92D050",
    },
  ]);
  addSheet(previous, "Feb 26", [
    {
      code: 6526,
      description: "5 Hampton Mead, Loughton",
      abbreviation: "EA",
      hours: 4.5,
      fill: "FFFFC000",
    },
  ]);
  addSheet(previous, "Mar 26", [
    {
      code: 6526,
      description: "5 Hampton Mead, Loughton",
      abbreviation: "EB",
      hours: 0.5,
      fill: "FF92D050",
    },
  ]);
  const current = new ExcelJS.Workbook();
  addSheet(current, "Apr 26", []);
  addSheet(current, "May 26", [
    {
      code: 5752,
      description: "Starveacres, 16 Watford Road, Radlett",
      abbreviation: "EA",
      hours: 0.5,
      fill: "FF92D050",
    },
  ]);
  addSheet(current, "Jun 26", [
    {
      code: 5752,
      description: "Starveacres, 16 Watford Road, Radlett",
      abbreviation: "EA",
      hours: 2.25,
      fill: "FF92D050",
    },
    {
      code: 4656,
      description: "JBA Fairacres 164 East End Road, London",
      abbreviation: "EA",
      hours: 2.5,
      fill: "FF92D050",
    },
  ]);
  addSheet(current, "Jul 26", [
    {
      code: 5752,
      description: "Starveacres, 16 Watford Road, Radlett",
      abbreviation: "EA",
      hours: 10.75,
      fill: "FFFFC000",
    },
    {
      code: 4656,
      description: "JBA Fairacres 164 East End Road, London",
      abbreviation: "EA",
      hours: 1,
      fill: "FF92D050",
    },
  ]);
  return {
    previous: Buffer.from(
      (await previous.xlsx.writeBuffer()) as unknown as Uint8Array,
    ),
    current: Buffer.from(
      (await current.xlsx.writeBuffer()) as unknown as Uint8Array,
    ),
  };
}

async function configureAdmin(
  page: import("@playwright/test").Page,
  includeLatestWorkbook = true,
) {
  await installPublicationApi(page);
  await page.goto("./");
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await page.getByLabel("Access code").fill("admin-code");
  await page.getByRole("button", { name: "Unlock NEXUS" }).click();
  await page.evaluate(() => {
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

async function configureRealFixtureAdmin(
  page: import("@playwright/test").Page,
) {
  if (!realCarryFixturesAvailable)
    throw new Error("Real carry fixtures were not configured for this test.");
  const register = JSON.parse(
    await readFile(realCarryFixturePaths.register!, "utf8"),
  );
  await page.goto("./");
  await page.evaluate((value) => {
    localStorage.setItem("eas-admin-authorised", "true");
    localStorage.setItem("eas-admin-employee-register-v1", value);
  }, JSON.stringify(register));
  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await page
    .locator('input[aria-label="Current hours workbook"]')
    .setInputFiles(realCarryFixturePaths.current!);
  await expect(
    page.getByText(/2026\/27 saved on this workstation/),
  ).toBeVisible();
  await page
    .locator('input[aria-label="Previous year hours workbook"]')
    .setInputFiles(realCarryFixturePaths.previous!);
  await expect(
    page.getByText(/2025\/26 saved on this workstation/),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await expect(
    page.getByText(/Current hours workbook: 2026\/27/),
  ).toBeVisible();
  await expect(
    page.getByText(/Previous year: 2025\/26 — retained/),
  ).toBeVisible();
  await page
    .locator('input[aria-label="Timesheets or ZIP"]')
    .setInputFiles(realCarryFixturePaths.timesheets!);
  await page.getByRole("button", { name: "Check files" }).click();
}

async function openRealHistoricalMissingProjectCard(
  page: import("@playwright/test").Page,
) {
  await page.getByRole("button", { name: "Review older items" }).click();
  for (let index = 0; index < 20; index += 1) {
    const action = page.getByRole("button", {
      name: "Already dealt with — don't carry forward",
    });
    if (await action.count()) return;
    await page
      .getByLabel("Carry-over checks")
      .getByRole("button", { name: "Skip for now" })
      .click();
  }
  throw new Error(
    "No actionable previous-FY missing-project carry card found.",
  );
}

async function configureCarrySoftlockScenario(
  page: import("@playwright/test").Page,
) {
  await configureAdmin(page, false);
  await page
    .locator('input[aria-label="Current hours workbook"]')
    .setInputFiles({
      name: "Current FY.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await syntheticContinuityWorkbook(null),
    });
  await page
    .locator('input[aria-label="Previous year hours workbook"]')
    .setInputFiles({
      name: "Previous FY missing project.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await syntheticCarryWorkbook("EA", "Mar 26", null),
    });
  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles({
    name: "Employee Alpha Timesheet 2026-2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticTimesheet("Current Project"),
  });
  await page.getByRole("button", { name: "Check files" }).click();
  await page.getByRole("button", { name: "Review older items" }).click();
}

test("landing, public viewer and production build information are available", async ({
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
  await expect(page.getByText("Historical carried hours")).toBeVisible();
  await expect(page.getByText(/Example Mapping Co/)).toBeVisible();
  const detail = page.locator(".subpanel");
  await expect(detail.getByText(/Employee B/)).toBeVisible();
  await expect(detail.getByText(/Employee C/)).toHaveCount(0);
  await page.getByText("View all departments").click();
  await expect(detail.getByText(/Employee C/)).toBeVisible();
  const unallocated = page.locator("details.unallocated-tpcs");
  await expect(unallocated).not.toHaveAttribute("open", "");
  await unallocated.getByText("Show unallocated TPCs").click();
  await expect(page.getByText(/tell the Office Manager/)).toBeVisible();
  await page.getByRole("button", { name: /NEXUS 1.0.2/ }).click();
  await expect(page.getByText("Build information")).toBeVisible();
  await expect(page.getByText("TIME 1.0.0", { exact: true })).toBeVisible();
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
  await expect(
    page.getByText("Create Employee Viewer access code"),
  ).toBeVisible();
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
        const request = indexedDB.open("eas-admin-toolkit-workstation-v1", 5);
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
  await configureAdmin(page, false);
  await page
    .locator('input[aria-label="Current hours workbook"]')
    .setInputFiles({
      name: "Current continuity.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await syntheticContinuityWorkbook(),
    });
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

test("real-structure carry queues render the completed actions for Current and Previous FY", async ({
  page,
}) => {
  await configureAdmin(page, false);
  await page
    .locator('input[aria-label="Current hours workbook"]')
    .setInputFiles({
      name: "Current FY Missing Project.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await syntheticContinuityWorkbook(null, true),
    });
  await page
    .locator('input[aria-label="Previous year hours workbook"]')
    .setInputFiles({
      name: "Previous FY Missing Project.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await syntheticCarryWorkbook("EA", "Mar 26", null, 2),
    });
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
  await page
    .getByRole("button", { name: "Keep as Unknown Project carry" })
    .click();
  await expect(
    page.getByText("All current carry-over checks complete ✓"),
  ).toBeVisible();

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
  await page
    .getByRole("button", {
      name: "Already dealt with — don't carry forward",
    })
    .click();
  await expect(
    page.getByText("Older carry-over records — all previously reviewed ✓"),
  ).toBeVisible();

  expect(
    await page.evaluate(() =>
      localStorage.getItem("eas-nexus-historical-review-v1"),
    ),
  ).toContain("already-dealt-with");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("eas-nexus-historical-review-v1"),
    ),
  ).toContain("unknown-project-carry");

  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await page
    .locator('input[aria-label="Timesheets or ZIP"]')
    .setInputFiles(timesheet);
  await page.getByRole("button", { name: "Check files" }).click();
  await expect(
    page.getByText("All current carry-over checks complete ✓"),
  ).toBeVisible();
  await expect(
    page.getByText("Older carry-over records — all previously reviewed ✓"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review current items" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review older items" }),
  ).toHaveCount(0);
});

if (realCarryFixturesAvailable) {
  test("confidential parser route renders and persists Previous FY Already dealt with", async ({
    page,
  }) => {
    await configureRealFixtureAdmin(page);
    await openRealHistoricalMissingProjectCard(page);
    await expect(
      page.getByRole("button", {
        name: "Keep as Unknown Project carry",
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Already dealt with — don't carry forward",
      })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("eas-nexus-historical-review-v1"),
        ),
      )
      .toContain("already-dealt-with");
  });

  test("confidential parser route renders and persists Previous FY Unknown carry", async ({
    page,
  }) => {
    await configureRealFixtureAdmin(page);
    await openRealHistoricalMissingProjectCard(page);
    await page
      .getByRole("button", { name: "Keep as Unknown Project carry" })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("eas-nexus-historical-review-v1"),
        ),
      )
      .toContain("unknown-project-carry");
  });

  test("confidential parser route renders Current FY Unknown carry without closed-year action", async ({
    page,
  }) => {
    await configureRealFixtureAdmin(page);
    await page.getByRole("button", { name: "Review current items" }).click();
    await expect(
      page.getByRole("button", { name: "Keep as Unknown Project carry" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Already dealt with — don't carry forward",
      }),
    ).toHaveCount(0);
  });
}

test("Previous FY Already dealt with clears the carry softlock and enables the project report", async ({
  page,
}) => {
  await configureCarrySoftlockScenario(page);
  await page
    .getByRole("button", {
      name: "Already dealt with — don't carry forward",
    })
    .click();

  const projectReport = page.locator(".report-ready-grid > article").first();
  await expect(projectReport.getByText("Ready")).toBeVisible();
  await expect(
    projectReport.getByRole("button", { name: "Download report" }),
  ).toBeEnabled();
});

test("Previous FY Unknown carry clears the softlock and remains visible as Unknown hours", async ({
  page,
}) => {
  await configureCarrySoftlockScenario(page);
  await page
    .getByRole("button", { name: "Keep as Unknown Project carry" })
    .click();

  const projectReport = page.locator(".report-ready-grid > article").first();
  await expect(projectReport.getByText("Ready")).toBeVisible();
  await expect(
    projectReport.getByRole("button", { name: "Download report" }),
  ).toBeEnabled();

  await page
    .getByRole("button", { name: "Create Employee Viewer access code" })
    .click();
  const token = await page.locator(".one-time-token code").innerText();
  await page.getByText(/I confirm this month is ready to publish/).click();
  await page.getByRole("button", { name: "Publish Employee Viewer" }).click();
  const link = await page
    .getByLabel("Encrypted employee-view link")
    .inputValue();
  await page.goto(link);
  await page.getByLabel("Employee Viewer token").fill(token);
  await page.getByRole("button", { name: "Open approved month" }).click();
  await expect(
    page.getByText("2026-03 — 3.50h — Unknown Project"),
  ).toBeVisible();
});

test("Employee Viewer excludes closed and expired carry lifecycles while retaining a continuous carry", async ({
  page,
}) => {
  await configureAdmin(page, false);
  const workbooks = await syntheticLifecycleWorkbooks();
  await page
    .locator('input[aria-label="Current hours workbook"]')
    .setInputFiles({
      name: "Current lifecycle 2026-27.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: workbooks.current,
    });
  await page
    .locator('input[aria-label="Previous year hours workbook"]')
    .setInputFiles({
      name: "Previous lifecycle 2025-26.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: workbooks.previous,
    });
  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles({
    name: "Employee Alpha Timesheet 2026-2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticTimesheet(
      "Starveacres, 16 Watford Road, Radlett",
      "Jul 26",
      1.25,
      1.25,
      5752,
    ),
  });
  await page.getByRole("button", { name: "Check files" }).click();
  await page
    .getByRole("button", { name: "Create Employee Viewer access code" })
    .click();
  const token = await page.locator(".one-time-token code").innerText();
  await page.getByText(/I confirm this month is ready to publish/).click();
  await page.getByRole("button", { name: "Publish Employee Viewer" }).click();
  const link = await page
    .getByLabel("Encrypted employee-view link")
    .inputValue();
  await page.goto(link);
  await page.getByLabel("Employee Viewer token").fill(token);
  await page.getByRole("button", { name: "Open approved month" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Starveacres, 16 Watford Road, Radlett",
    }),
  ).toBeVisible();
  await expect(page.getByText("Employee Alpha: 1.25h")).toBeVisible();
  await expect(page.getByText("Total relevant hours — 1.25h")).toBeVisible();
  await expect(
    page.getByText(/Carried from 2026-05|Carried from 2026-06/),
  ).toHaveCount(0);
  await expect(page.getByText(/5 Hampton Mead/)).toHaveCount(0);
  await page.getByText("JBA Fairacres 164 East End Road, London").click();
  await expect(page.getByText("Carried from 2026-06 — 2.50h")).toBeVisible();
  await expect(page.getByText("Total relevant hours — 2.50h")).toBeVisible();
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
        const request = indexedDB.open("eas-admin-toolkit-workstation-v1", 5);
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

test("TPC financial-year library replaces same-year history and rolls over by processing month", async ({
  page,
}) => {
  await configureAdmin(page);
  await page.locator('input[aria-label="Current TPC workbook"]').setInputFiles({
    name: "Current TPC.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await syntheticTpcWorkbook(),
  });
  await page
    .locator('input[aria-label="Previous TPC workbook"]')
    .setInputFiles({
      name: "Historical TPC old.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await syntheticTpcWorkbook("Mar 2026", "Historic Supplier"),
    });
  await expect(
    page.getByText(/Previous TPC year: 2025\/26 — retained/),
  ).toBeVisible();
  await page
    .locator('input[aria-label="Previous TPC workbook"]')
    .setInputFiles({
      name: "Historical TPC replacement.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await syntheticTpcWorkbook(
        "Mar 2026",
        "Updated Historic Supplier",
      ),
    });
  await expect(
    page.getByText(/Historical TPC replacement\.xlsx saved for 2025\/26/),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await expect(page.getByText(/Current TPC workbook: 2026\/27/)).toBeVisible();
  await expect(
    page.getByText(/Previous TPC year: 2025\/26 — retained/),
  ).toBeVisible();
  const historicalName = await page.evaluate(
    () =>
      new Promise<string | undefined>((resolve, reject) => {
        const request = indexedDB.open("eas-admin-toolkit-workstation-v1", 5);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            "tpc-financial-year-workbooks",
            "readonly",
          );
          const get = transaction
            .objectStore("tpc-financial-year-workbooks")
            .get("2025/26");
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            resolve(
              (get.result as { fileName?: string } | undefined)?.fileName,
            );
            database.close();
          };
        };
      }),
  );
  expect(historicalName).toBe("Historical TPC replacement.xlsx");

  await page.locator('input[type="month"]').first().fill("2027-04");
  await expect(
    page.getByText(/Current TPC workbook: 2027\/28 — not added yet/),
  ).toBeVisible();
  await expect(
    page.getByText(/Previous TPC year: 2026\/27 — retained/),
  ).toBeVisible();
  await page.locator('input[aria-label="Current TPC workbook"]').setInputFiles({
    name: "New FY TPC.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await syntheticTpcWorkbook("Apr 2027", "New FY Supplier"),
  });
  await expect(
    page.getByText(/New FY TPC\.xlsx saved for 2027\/28/),
  ).toBeVisible();
  const roles = await page.evaluate(
    () =>
      new Promise<Array<[string, string]>>((resolve, reject) => {
        const request = indexedDB.open("eas-admin-toolkit-workstation-v1", 5);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            "tpc-financial-year-workbooks",
            "readonly",
          );
          const get = transaction
            .objectStore("tpc-financial-year-workbooks")
            .getAll();
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            resolve(
              (
                get.result as Array<{ financialYear: string; role: string }>
              ).map((item) => [item.financialYear, item.role]),
            );
            database.close();
          };
        };
      }),
  );
  expect(roles).toEqual(
    expect.arrayContaining([
      ["2025/26", "historical"],
      ["2026/27", "historical"],
      ["2027/28", "current"],
    ]),
  );
});

test("TPC workbook persists, reviews one item at a time, and publishes only outstanding costs", async ({
  page,
}) => {
  await configureAdmin(page);
  await page.locator('input[aria-label="Current TPC workbook"]').setInputFiles({
    name: "Synthetic TPC Apr 2026 - Mar 2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await syntheticTpcWorkbook(),
  });
  await expect(
    page.getByText(
      /Current TPC workbook: 2026\/27 — updated through July 2026/,
    ),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Admin Processing", exact: true })
    .click();
  await expect(
    page.getByText(
      /Current TPC workbook: 2026\/27 — updated through July 2026/,
    ),
  ).toBeVisible();

  await page.locator('input[aria-label="Timesheets or ZIP"]').setInputFiles({
    name: "Employee Alpha Timesheet 2026-2027.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: syntheticTimesheet("Station Access Study"),
  });
  await page.getByRole("button", { name: "Check files" }).click();
  await expect(page.getByText("1 TPC item needs checking")).toBeVisible();
  await expect(page.getByText("Project Manager: PM")).toBeVisible();
  await page.getByRole("button", { name: "Leave unallocated" }).click();
  await expect(page.getByText("No TPC items need checking.")).toBeVisible();

  await page
    .getByRole("button", { name: "Create Employee Viewer access code" })
    .click();
  const token = await page.locator(".one-time-token code").innerText();
  await page.getByText(/I confirm this month is ready to publish/).click();
  await page.getByRole("button", { name: "Publish Employee Viewer" }).click();
  const link = await page
    .getByLabel("Encrypted employee-view link")
    .inputValue();
  await page.goto(link);
  await page.getByLabel("Employee Viewer token").fill(token);
  await page.getByRole("button", { name: "Open approved month" }).click();
  await expect(page.getByText(/Mapping Supplier/)).toBeVisible();
  await expect(page.getByText(/Already Invoiced Supplier/)).toHaveCount(0);
  await expect(
    page.getByText(
      /Invoiced Missing Project Supplier|Invoiced N\/A Supplier|Invoiced XXXX Supplier/,
    ),
  ).toHaveCount(0);
  const unallocated = page.locator("details.unallocated-tpcs");
  await expect(unallocated).not.toHaveAttribute("open", "");
  await unallocated.getByText("Show unallocated TPCs").click();
  await expect(page.getByText(/Unallocated Supplier/)).toBeVisible();
  await expect(
    unallocated.locator("input, button, textarea, select"),
  ).toHaveCount(0);
  await expect(
    page.getByText(/sourceWorkbook|sourceWorksheet|sourceRow|Notes/),
  ).toHaveCount(0);
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
    .getByRole("button", { name: "Create Employee Viewer access code" })
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
  expect(link.length).toBeLessThan(250);

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
  await expect(page.getByText("Employee Alpha: 2.00h")).toBeVisible();
  await expect(
    page.getByText("TPC information not loaded for this month."),
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
  await expect(page.getByText("Employee Viewer demonstration")).toBeVisible();
});

test("missing and corrupt Employee Viewer assets fail closed while the demo route remains intentional", async ({
  page,
}) => {
  const id = "2026-08-X7k3mP9q";
  await page.route("**/employee-publications-api/v1/publications/*", (route) =>
    route.fulfill({ status: 404, body: "Not found" }),
  );
  await page.goto(`./#employee-viewer=${id}`);
  await expect(page.getByRole("alert")).toContainText("could not be found");
  await expect(page.getByText("Employee Viewer demonstration")).toHaveCount(0);

  await page.unroute("**/employee-publications-api/v1/publications/*");
  await page.route("**/employee-publications-api/v1/publications/*", (route) =>
    route.fulfill({ status: 200, body: "{corrupt" }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("could not be opened");
  await expect(page.getByText("Employee Viewer demonstration")).toHaveCount(0);

  await page.goto("./#employee-viewer-demo");
  await expect(page.getByText("Employee Viewer demonstration")).toBeVisible();
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
    page.getByText("Graduate Transport Planner · Creator of EAS FORGE"),
  ).toBeVisible();
  await expect(
    page.getByText("Created by Joe Freeman · EAS FORGE"),
  ).toBeVisible();
  await expect(page.getByAltText("Portrait of Joe Freeman")).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});
