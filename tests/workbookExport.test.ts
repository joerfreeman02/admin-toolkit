import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyUncodedApprovals,
  applyUncodedDecisions,
  consolidateEntries,
  entryReviewKey,
} from "../src/consolidation";
import type {
  EmployeeRegister,
  HistoricalCarryRecord,
  TimeEntry,
} from "../src/domain";
import { addEmployee, emptyEmployeeRegister } from "../src/employeeRegister";
import {
  generateInternalWorkbook,
  generateProjectWorkbook,
} from "../src/workbookExport";

function asArrayBuffer(value: unknown): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  const bytes = value as Uint8Array;
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function template(headerRow = 9) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Jul 26");
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
  sheet.getCell(headerRow, 2).value = "Job Number";
  sheet.getCell(headerRow, 3).value = "Job Name";
  sheet.getCell(headerRow, 2).font = { bold: true };
  sheet.getCell(headerRow, 2).border = { bottom: { style: "thin" } };
  sheet.getCell(headerRow + 2, 2).border = { bottom: { style: "thin" } };
  sheet.getCell(headerRow + 2, 3).border = { bottom: { style: "thin" } };
  sheet.getCell(headerRow + 2, 4).border = { bottom: { style: "thin" } };
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 50;
  sheet.getColumn(4).width = 9;
  sheet.getColumn(24).width = 25;
  sheet.getColumn(25).width = 30;
  return asArrayBuffer(await workbook.xlsx.writeBuffer());
}

function register(): EmployeeRegister {
  let value = emptyEmployeeRegister();
  value = addEmployee(value, {
    fullName: "Employee Alpha",
    effectiveFrom: "2026-07",
    department: "Drainage",
    grade: "Engineer",
    abbreviation: "EA",
  });
  value = addEmployee(value, {
    fullName: "Employee Beta",
    effectiveFrom: "2026-07",
    department: "Transport",
    grade: "Senior Engineer",
    abbreviation: "EB",
  });
  return value;
}

function entry(
  employee: string,
  description: string,
  hours: number,
  classification: TimeEntry["classification"],
  row: number,
  projectCode?: string,
): TimeEntry {
  return {
    employee,
    reportingMonth: "2026-07",
    projectCode,
    description,
    internalCategory: classification === "internal" ? description : undefined,
    hours,
    hoursAudit: {
      columnD: hours,
      dailyTotal: hours,
      authority: "column-d",
      differs: false,
    },
    classification,
    trace: { file: `${employee}.xlsx`, worksheet: "Jul 26", row },
  };
}

function acceptedRun() {
  const uncoded = entry(
    "Employee Alpha",
    "Approved Synthetic Study",
    1.25,
    "exception",
    8,
  );
  const entries = applyUncodedApprovals(
    [
      entry("Employee Alpha", "Synthetic Project", 1, "project", 5, "2101"),
      entry("Employee Alpha", "Synthetic Project", 2, "project", 6, "2101"),
      entry("Employee Beta", "Synthetic Project", 4, "project", 5, "2101"),
      entry("Employee Beta", "Training", 2.5, "internal", 7, "10002"),
      uncoded,
    ],
    new Set([entryReviewKey(uncoded)]),
  );
  const employeeRegister = register();
  return {
    entries,
    employeeRegister,
    result: consolidateEntries(entries, employeeRegister, "2026-07"),
  };
}

describe("Excel outputs", () => {
  it("generates a parseable project workbook with ordered employee headers", async () => {
    const run = acceptedRun();
    const data = await generateProjectWorkbook(
      run.result,
      await template(),
      "test-sha",
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(data) as never);
    const sheet = workbook.getWorksheet("Jul 26")!;
    expect(sheet.getCell("B9").value).toBe("Job Number");
    expect(sheet.getCell("C9").value).toBe("Job Name");
    expect(sheet.getCell("D9").value).toBe("EA");
    expect(sheet.getCell("E9").value).toBe("EB");
    expect(sheet.getColumn(2).width).toBe(14);
    expect(sheet.getCell("C3").fill).toMatchObject({
      fgColor: { argb: "FFFFFF00" },
    });
  });

  it("writes historical person-level carry detail without collapsing months into an unexplained total", async () => {
    const run = acceptedRun();
    const employeeId = run.employeeRegister.employees[0].id;
    const carry = (
      projectCode: string,
      projectDescription: string,
      originatingMonth: string,
      hours: number,
      sourceRow: number,
    ): HistoricalCarryRecord => ({
      projectCode,
      projectDescription,
      employeeId,
      employee: "Employee Alpha",
      employeeAbbreviation: "EA",
      department: "Drainage",
      hours,
      originatingMonth,
      originatingYear: Number(originatingMonth.slice(0, 4)),
      sourceWorkbook: "Synthetic 2026-27.xlsx",
      sourceWorkbookId: "financial-year:2026/27",
      sourceWorksheet: `${originatingMonth.slice(5)} synthetic`,
      sourceRow,
      sourceColumn: 4,
      sourceCell: `D${sourceRow}`,
      status: "carry",
      fill: "#92D050",
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      new Uint8Array(
        await generateProjectWorkbook(
          run.result,
          await template(),
          "test-sha",
          [
            carry("2101", "Synthetic Project", "2026-05", 3, 11),
            carry("2101", "Synthetic Project", "2026-06", 4, 12),
            carry("4200", "Carry-only Project", "2026-05", 2, 13),
          ],
        ),
      ) as never,
    );
    const project = workbook.getWorksheet("Jul 26")!;
    expect(project.getCell("F11").value).toContain("May 26 · EA · 3.00h");
    expect(project.getCell("F11").value).toContain("Jun 26 · EA · 4.00h");
    expect(project.getCell("B12").value).toBe(4200);
    const audit = workbook.getWorksheet("Carry-over Audit")!;
    expect(audit.getCell("A1").value).toBe("Project number");
    expect(audit.getCell("C2").value).toBe("Employee Alpha");
    expect(audit.getCell("E2").value).toBe("Drainage");
    expect(audit.getCell("N2").value).toBe("Carry · green #92D050");
    expect(audit.getCell("H2").value).toBe(2026);
    expect(audit.getCell("I2").value).toBe("Synthetic 2026-27.xlsx");
    expect(audit.getCell("K2").value).toBe("D11");
  });

  it("consolidates repeated project rows into expected employee cells", async () => {
    const run = acceptedRun();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      new Uint8Array(
        await generateProjectWorkbook(run.result, await template(), "test-sha"),
      ) as never,
    );
    const sheet = workbook.getWorksheet("Jul 26")!;
    expect(sheet.getCell("B11").value).toBe(2101);
    expect(sheet.getCell("D11").value).toBe(3);
    expect(sheet.getCell("E11").value).toBe(4);
  });

  it("uses timesheets rather than template hour cells for the current-month matrix", async () => {
    const run = acceptedRun();
    const templateWorkbook = new ExcelJS.Workbook();
    await templateWorkbook.xlsx.load(new Uint8Array(await template()) as never);
    templateWorkbook.getWorksheet("Jul 26")!.getCell("D11").value = 999;
    const templateWithPriorValue = asArrayBuffer(
      await templateWorkbook.xlsx.writeBuffer(),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      new Uint8Array(
        await generateProjectWorkbook(
          run.result,
          templateWithPriorValue,
          "test-sha",
        ),
      ) as never,
    );

    expect(workbook.getWorksheet("Jul 26")!.getCell("D11").value).toBe(3);
  });

  it("places approved uncoded projects last and excludes internal entries", async () => {
    const run = acceptedRun();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      new Uint8Array(
        await generateProjectWorkbook(run.result, await template(), "test-sha"),
      ) as never,
    );
    const sheet = workbook.getWorksheet("Jul 26")!;
    expect(sheet.getCell("B12").value).toBe("Uncoded");
    expect(sheet.getCell("C12").value).toBe("Approved Synthetic Study");
    const values: unknown[] = [];
    sheet.eachRow((row) => row.eachCell((cell) => values.push(cell.value)));
    expect(values).not.toContain(10002);
    expect(values).not.toContain("Training");
  });

  it("exports only the selected canonical description and retains original descriptions in the protected audit", async () => {
    const entries = [
      entry("Employee Alpha", "Study A", 1, "project", 5, "2101"),
      entry("Employee Beta", "Study B", 2, "project", 5, "2101"),
    ];
    const employeeRegister = register();
    const result = consolidateEntries(
      entries,
      employeeRegister,
      "2026-07",
      new Map([["2101", "Study B"]]),
    );
    expect(result.canExport).toBe(true);

    const projectWorkbook = new ExcelJS.Workbook();
    await projectWorkbook.xlsx.load(
      new Uint8Array(
        await generateProjectWorkbook(result, await template(), "test-sha"),
      ) as never,
    );
    const projectSheet = projectWorkbook.getWorksheet("Jul 26")!;
    expect(projectSheet.getCell("C11").value).toBe("Study B");
    const projectValues: unknown[] = [];
    projectSheet.eachRow((row) =>
      row.eachCell((cell) => projectValues.push(cell.value)),
    );
    expect(projectValues).not.toContain("Study A");

    const internalWorkbook = new ExcelJS.Workbook();
    await internalWorkbook.xlsx.load(
      new Uint8Array(
        await generateInternalWorkbook(
          result,
          entries,
          employeeRegister,
          "test-sha",
        ),
      ) as never,
    );
    const audit = internalWorkbook.getWorksheet("Audit Trace")!;
    expect([audit.getCell("G2").value, audit.getCell("G3").value]).toEqual([
      "Study A",
      "Study B",
    ]);
    expect([audit.getCell("I2").value, audit.getCell("I3").value]).toEqual([
      "Study B",
      "Study B",
    ]);
    expect(audit.getCell("J2").value).toBe(
      "Resolved to observed source description",
    );
  });

  it("audits the original uncoded wording and the deliberately selected canonical project", async () => {
    const uncoded = entry(
      "Employee Alpha",
      "Harbour Roud",
      1.5,
      "exception",
      8,
    );
    const entries = applyUncodedDecisions(
      [uncoded],
      new Map([
        [
          entryReviewKey(uncoded),
          {
            kind: "existing-project" as const,
            projectCode: "4312",
            projectDescription: "Harbour Road Access",
          },
        ],
      ]),
    );
    const employeeRegister = register();
    const result = consolidateEntries(entries, employeeRegister, "2026-07");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      new Uint8Array(
        await generateInternalWorkbook(
          result,
          entries,
          employeeRegister,
          "test-sha",
        ),
      ) as never,
    );
    const audit = workbook.getWorksheet("Audit Trace")!;

    expect(audit.getCell("F2").value).toBeNull();
    expect(audit.getCell("G2").value).toBe("Harbour Roud");
    expect(audit.getCell("H2").value).toBe("4312");
    expect(audit.getCell("I2").value).toBe("Harbour Road Access");
    expect(audit.getCell("J2").value).toBe("Matched to existing project 4312");
    expect(audit.getCell("N2").value).toBe("Matched project 4312");
  });

  it("honours a template whose project header begins on row 8", async () => {
    const run = acceptedRun();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      new Uint8Array(
        await generateProjectWorkbook(
          run.result,
          await template(8),
          "test-sha",
        ),
      ) as never,
    );
    const sheet = workbook.getWorksheet("Jul 26")!;
    expect(sheet.getCell("B8").value).toBe("Job Number");
    expect(sheet.getCell("B10").value).toBe(2101);
  });

  it("generates a separate Internal Hours workbook with totals and audit trace", async () => {
    const run = acceptedRun();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      new Uint8Array(
        await generateInternalWorkbook(
          run.result,
          run.entries,
          run.employeeRegister,
          "test-sha",
        ),
      ) as never,
    );
    const sheet = workbook.getWorksheet("Internal Hours")!;
    expect(sheet.getCell("A1").value).toContain("NEXUS Internal Hours");
    expect(sheet.getCell("A7").value).toBe(10002);
    expect(sheet.getCell("D7").value).toBe(2.5);
    const audit = workbook.getWorksheet("Audit Trace")!;
    expect(audit.getCell("A1").value).toBe("Source file");
    expect(audit.rowCount).toBeGreaterThan(2);
    expect(audit.getCell("I5").value).toBeNull();
    expect(audit.getCell("J5").value).toBeNull();
  });

  it("separates Unknown and Excluded hours in both private workbooks while preserving employee totals", async () => {
    const unknown = entry(
      "Employee Alpha",
      "Missing project detail",
      1.5,
      "exception",
      8,
    );
    const excluded = entry(
      "Employee Beta",
      "Duplicate submission",
      0.75,
      "exception",
      9,
    );
    const timeInLieu = entry(
      "Employee Alpha",
      "17.25hrs in lieu from June",
      17.25,
      "exception",
      10,
    );
    const entries = applyUncodedDecisions(
      [
        entry("Employee Alpha", "Synthetic Project", 2, "project", 5, "2101"),
        entry("Employee Beta", "Training", 1, "internal", 6, "10002"),
        timeInLieu,
        unknown,
        excluded,
      ],
      new Map([
        [entryReviewKey(timeInLieu), { kind: "time-in-lieu" as const }],
        [entryReviewKey(unknown), { kind: "unknown-project" as const }],
        [
          entryReviewKey(excluded),
          { kind: "excluded" as const, reason: "Duplicate" },
        ],
      ]),
    );
    const employeeRegister = register();
    const result = consolidateEntries(entries, employeeRegister, "2026-07");
    expect(result.canExport).toBe(true);
    const carry: HistoricalCarryRecord = {
      projectCode: "4312",
      projectDescription: "Synthetic Carried Project",
      employeeId: employeeRegister.employees[0].id,
      employee: "Employee Alpha",
      employeeAbbreviation: "EA",
      department: "Drainage",
      hours: 3.5,
      originatingMonth: "2026-06",
      originatingYear: 2026,
      sourceWorkbook: "Synthetic Historical Workbook.xlsx",
      sourceWorkbookId: "synthetic-history",
      sourceWorksheet: "Jun 26",
      sourceRow: 11,
      sourceColumn: 4,
      sourceCell: "D11",
      status: "carry",
      fill: "#92D050",
    };

    const project = new ExcelJS.Workbook();
    const projectData = await generateProjectWorkbook(
      result,
      await template(),
      "test-sha",
      [carry],
    );
    await project.xlsx.load(new Uint8Array(projectData) as never);
    const projectSheet = project.getWorksheet("Jul 26")!;
    const unknownProjectRow = projectSheet.getRow(
      projectSheet
        .getColumn(3)
        .values.findIndex((value) => value === "Unallocated / Unknown Project"),
    );
    const excludedProjectRow = projectSheet.getRow(
      projectSheet
        .getColumn(3)
        .values.findIndex((value) => value === "Excluded / Discarded Hours"),
    );
    const timeInLieuProjectRow = projectSheet.getRow(
      projectSheet
        .getColumn(3)
        .values.findIndex((value) => value === "Time in Lieu"),
    );
    expect(timeInLieuProjectRow.getCell(4).value).toBe(17.25);
    expect(unknownProjectRow.getCell(4).value).toBe(1.5);
    expect(unknownProjectRow.getCell(5).value).toBeNull();
    expect(excludedProjectRow.getCell(4).value).toBeNull();
    expect(excludedProjectRow.getCell(5).value).toBe(0.75);

    const internal = new ExcelJS.Workbook();
    const internalData = await generateInternalWorkbook(
      result,
      entries,
      employeeRegister,
      "test-sha",
    );
    await internal.xlsx.load(new Uint8Array(internalData) as never);
    const internalSheet = internal.getWorksheet("Internal Hours")!;
    const labels = internalSheet.getColumn(1).values;
    const unknownInternalRow = internalSheet.getRow(
      labels.findIndex((value) => value === "Unknown / Unallocated"),
    );
    const excludedInternalRow = internalSheet.getRow(
      labels.findIndex((value) => value === "Excluded / Discarded"),
    );
    const timeInLieuInternalRow = internalSheet.getRow(
      labels.findIndex((value) => value === "Time in Lieu"),
    );
    expect(timeInLieuInternalRow.getCell(3).value).toBe(17.25);
    expect(unknownInternalRow.getCell(3).value).toBe(1.5);
    expect(excludedInternalRow.getCell(4).value).toBe(0.75);
    const audit = internal.getWorksheet("Audit Trace")!;
    expect(audit.getCell("O4").value).toMatch(/Time in Lieu/);
    expect(audit.getCell("O5").value).toMatch(/Unknown/);
    expect(audit.getCell("O6").value).toMatch(/Excluded/);
    expect(audit.getCell("J6").value).toContain("Duplicate");
    if (process.env.NEXUS_QA_OUTPUT_DIR) {
      await mkdir(process.env.NEXUS_QA_OUTPUT_DIR, { recursive: true });
      await writeFile(
        path.join(
          process.env.NEXUS_QA_OUTPUT_DIR,
          "NEXUS-1.0A.3-Project-QA.xlsx",
        ),
        new Uint8Array(projectData),
      );
      await writeFile(
        path.join(
          process.env.NEXUS_QA_OUTPUT_DIR,
          "NEXUS-1.0A.3-Internal-QA.xlsx",
        ),
        new Uint8Array(internalData),
      );
    }
  });

  it("writes Time in Lieu as a separate private non-project row with employee attribution", async () => {
    const source = entry(
      "Employee Alpha",
      "17.25hrs in lieu from June",
      17.25,
      "exception",
      12,
    );
    const entries = applyUncodedDecisions(
      [source],
      new Map([[entryReviewKey(source), { kind: "time-in-lieu" as const }]]),
    );
    const employeeRegister = register();
    const result = consolidateEntries(entries, employeeRegister, "2026-07");

    const project = new ExcelJS.Workbook();
    const projectData = await generateProjectWorkbook(
      result,
      await template(),
      "test-sha",
    );
    await project.xlsx.load(new Uint8Array(projectData) as never);
    const projectSheet = project.getWorksheet("Jul 26")!;
    const projectRow = projectSheet.getRow(
      projectSheet
        .getColumn(3)
        .values.findIndex((value) => value === "Time in Lieu"),
    );
    expect(projectRow.getCell(4).value).toBe(17.25);

    const internal = new ExcelJS.Workbook();
    const internalData = await generateInternalWorkbook(
      result,
      entries,
      employeeRegister,
      "test-sha",
    );
    await internal.xlsx.load(new Uint8Array(internalData) as never);
    const internalSheet = internal.getWorksheet("Internal Hours")!;
    const internalRow = internalSheet.getRow(
      internalSheet
        .getColumn(1)
        .values.findIndex((value) => value === "Time in Lieu"),
    );
    expect(internalRow.getCell(3).value).toBe(17.25);
    const audit = internal.getWorksheet("Audit Trace")!;
    expect(audit.getCell("N2").value).toBe("Time in Lieu");
    expect(audit.getCell("O2").value).toMatch(/Time in Lieu/);
  });

  it("retains historical Unknown Project carry in the separate non-project rows", async () => {
    const employeeRegister = register();
    const result = consolidateEntries([], employeeRegister, "2026-07");
    const historicalUnknown: HistoricalCarryRecord = {
      projectCode: undefined,
      projectDescription: "Historic source wording",
      employeeId: employeeRegister.employees[0].id,
      employee: "Employee Alpha",
      employeeAbbreviation: "EA",
      department: "Drainage",
      hours: 3.5,
      originatingMonth: "2025-05",
      originatingYear: 2025,
      sourceWorkbook: "Synthetic Historical Workbook.xlsx",
      sourceWorkbookId: "synthetic-history-unknown",
      sourceWorksheet: "May 25",
      sourceRow: 12,
      sourceColumn: 4,
      sourceCell: "D12",
      status: "carry",
      fill: "#92D050",
    };

    const project = new ExcelJS.Workbook();
    const projectData = await generateProjectWorkbook(
      result,
      await template(),
      "test-sha",
      [historicalUnknown],
    );
    await project.xlsx.load(new Uint8Array(projectData) as never);
    const projectSheet = project.getWorksheet("Jul 26")!;
    const projectRow = projectSheet.getRow(
      projectSheet
        .getColumn(3)
        .values.findIndex((value) => value === "Unallocated / Unknown Project"),
    );
    expect(projectRow.getCell(4).value).toBe(3.5);
    expect(project.getWorksheet("Carry-over Audit")!.getCell("A2").value).toBe(
      "Unknown Project carry",
    );

    const internal = new ExcelJS.Workbook();
    const internalData = await generateInternalWorkbook(
      result,
      [],
      employeeRegister,
      "test-sha",
      [historicalUnknown],
    );
    await internal.xlsx.load(new Uint8Array(internalData) as never);
    const internalSheet = internal.getWorksheet("Internal Hours")!;
    const internalRow = internalSheet.getRow(
      internalSheet
        .getColumn(1)
        .values.findIndex((value) => value === "Unknown / Unallocated"),
    );
    expect(internalRow.getCell(3).value).toBe(3.5);
  });

  it("blocks workbook generation while exceptions remain unresolved", async () => {
    const unresolved = entry("Employee Alpha", "Unresolved", 1, "exception", 5);
    const result = consolidateEntries([unresolved], register(), "2026-07");
    await expect(
      generateProjectWorkbook(result, await template(), "test-sha"),
    ).rejects.toThrow("blocked");
  });
});
