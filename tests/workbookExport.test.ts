import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  applyUncodedApprovals,
  consolidateEntries,
  entryReviewKey,
} from "../src/consolidation";
import type { EmployeeRegister, TimeEntry } from "../src/domain";
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
    expect([audit.getCell("H2").value, audit.getCell("H3").value]).toEqual([
      "Study B",
      "Study B",
    ]);
    expect(audit.getCell("I2").value).toBe(
      "Resolved to observed source description",
    );
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
    expect(sheet.getCell("A1").value).toContain("EAS Internal Hours");
    expect(sheet.getCell("A7").value).toBe(10002);
    expect(sheet.getCell("D7").value).toBe(2.5);
    const audit = workbook.getWorksheet("Audit Trace")!;
    expect(audit.getCell("A1").value).toBe("Source file");
    expect(audit.rowCount).toBeGreaterThan(2);
    expect(audit.getCell("H5").value).toBeNull();
    expect(audit.getCell("I5").value).toBeNull();
  });

  it("blocks workbook generation while exceptions remain unresolved", async () => {
    const unresolved = entry("Employee Alpha", "Unresolved", 1, "exception", 5);
    const result = consolidateEntries([unresolved], register(), "2026-07");
    await expect(
      generateProjectWorkbook(result, await template(), "test-sha"),
    ).rejects.toThrow("blocked");
  });
});
