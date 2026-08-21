import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { TpcWorkbookInspection } from "../src/domain";
import { inspectTpcWorkbook, resolveTpcRecords } from "../src/tpcWorkbook";

interface Row {
  date?: Date;
  supplier?: string;
  projectManager?: string | null;
  project?: string;
  description?: string;
  net?: number | string;
  vat?: number | string;
  gross?: number | string;
  outstanding?: boolean;
}

const headers = [
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
];

async function workbookBuffer(
  sheets: Array<{ name: string; headerRow?: number; rows: Row[] }>,
) {
  const workbook = new ExcelJS.Workbook();
  for (const input of sheets) {
    const sheet = workbook.addWorksheet(input.name);
    const headerRow = input.headerRow ?? 2;
    headers.forEach((header, index) => {
      sheet.getCell(headerRow, index + 1).value = header;
    });
    input.rows.forEach((item, index) => {
      const row = headerRow + index + 1;
      const values = [
        item.date,
        item.supplier,
        item.projectManager === undefined ? "PM" : item.projectManager,
        item.project,
        item.description,
        item.net,
        item.vat,
        item.gross,
      ];
      values.forEach((value, column) => {
        const cell = sheet.getCell(row, column + 1);
        cell.value = value ?? null;
        if (item.outstanding)
          cell.font = { ...cell.font, color: { argb: "FFFF0000" } };
      });
    });
  }
  workbook.addWorksheet("Sheet1");
  const value = (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array;
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
}

const red = (project = "7005"): Row => ({
  date: new Date("2026-04-12T00:00:00Z"),
  supplier: "Synthetic Supplier",
  project,
  description: "Survey",
  net: 100,
  vat: 20,
  gross: 120,
  outstanding: true,
});

describe("TPC financial-year workbook reader", () => {
  it("derives chronology from every recognised monthly sheet and ignores helper sheets", async () => {
    const data = await workbookBuffer([
      { name: "May 2026", rows: [red()] },
      { name: "Apr 2026", headerRow: 3, rows: [red("7006")] },
    ]);
    const before = createHash("sha256")
      .update(new Uint8Array(data))
      .digest("hex");
    const result = await inspectTpcWorkbook(data, {
      name: "misleading-1999.xlsx",
    });
    const after = createHash("sha256")
      .update(new Uint8Array(data))
      .digest("hex");

    expect(result.financialYear).toBe("2026/27");
    expect(result.worksheets.map((sheet) => sheet.name)).toEqual([
      "Apr 2026",
      "May 2026",
    ]);
    expect(result.records).toHaveLength(2);
    expect(result.updatedThrough).toBe("2026-05");
    expect(after).toBe(before);
  });

  it("recognises previous April-to-March years independently of filenames", async () => {
    const result = await inspectTpcWorkbook(
      await workbookBuffer([
        { name: "Apr25", rows: [red()] },
        { name: "Mar26", rows: [red()] },
      ]),
      { name: "current.xlsx" },
    );
    expect(result.financialYear).toBe("2025/26");
    expect(result.worksheets).toHaveLength(2);
  });

  it("uses red as outstanding and black as invoiced", async () => {
    const black = { ...red("7006"), outstanding: false };
    const inspection = await inspectTpcWorkbook(
      await workbookBuffer([{ name: "Apr 2026", rows: [red(), black] }]),
    );
    expect(inspection.records.map((item) => item.status)).toEqual([
      "outstanding",
      "invoiced",
    ]);
    const resolved = resolveTpcRecords(
      [inspection],
      { version: 1, decisions: {} },
      [],
    );
    expect(resolved.records).toHaveLength(1);
    expect(resolved.records[0].projectCode).toBe("7005");
  });

  it("never queues black TPC rows, even when their project reference is messy", async () => {
    const inspection = await inspectTpcWorkbook(
      await workbookBuffer([
        {
          name: "Apr 2026",
          rows: [
            { ...red("7005"), outstanding: false },
            { ...red(""), outstanding: false },
            { ...red("N/A"), outstanding: false },
            { ...red("XXXX"), outstanding: false },
          ],
        },
      ]),
    );
    const resolved = resolveTpcRecords(
      [inspection],
      { version: 1, decisions: {} },
      [],
    );

    expect(inspection.records.map((record) => record.status)).toEqual([
      "invoiced",
      "invoiced",
      "invoiced",
      "invoiced",
    ]);
    expect(resolved.records).toEqual([]);
    expect(resolved.issues).toEqual([]);
    expect(resolved.unallocated).toEqual([]);
  });

  it("excludes black-row amount mismatches from normal operator warnings", async () => {
    const inspection = await inspectTpcWorkbook(
      await workbookBuffer([
        {
          name: "Apr 2026",
          rows: [
            {
              ...red("N/A"),
              gross: 130,
              outstanding: false,
            },
          ],
        },
      ]),
    );
    const resolved = resolveTpcRecords(
      [inspection],
      { version: 1, decisions: {} },
      [],
    );

    expect(resolved.records).toEqual([]);
    expect(resolved.issues).toEqual([]);
    expect(resolved.warnings).toEqual([]);
    expect(resolved.warningRecords).toEqual([]);
  });

  it("shows red amount mismatches as non-blocking outstanding warnings", async () => {
    const inspection = await inspectTpcWorkbook(
      await workbookBuffer([
        {
          name: "Apr 2026",
          rows: [{ ...red("7005"), gross: 130 }],
        },
      ]),
    );
    const resolved = resolveTpcRecords(
      [inspection],
      { version: 1, decisions: {} },
      [
        {
          code: "7005",
          description: "Known Project",
          sources: ["job-register"],
        },
      ],
    );

    expect(resolved.issues).toEqual([]);
    expect(resolved.warnings).toHaveLength(1);
    expect(resolved.warningRecords).toEqual([
      expect.objectContaining({
        status: "outstanding",
        monetaryWarning: expect.any(String),
      }),
    ]);
  });

  it("retains recorded Project Manager context only when the source supplies it", async () => {
    const inspection = await inspectTpcWorkbook(
      await workbookBuffer([
        {
          name: "Apr 2026",
          rows: [
            { ...red("N/A"), projectManager: "AB" },
            { ...red("XXXX"), projectManager: null },
          ],
        },
      ]),
    );

    expect(inspection.records.map((record) => record.projectManager)).toEqual([
      "AB",
      undefined,
    ]);
  });

  it("preserves non-numeric money and warns without correcting mismatched numeric values", async () => {
    const inspection = await inspectTpcWorkbook(
      await workbookBuffer([
        {
          name: "Apr 2026",
          rows: [
            { ...red(), net: 100, vat: 20, gross: 130 },
            { ...red("N/A"), net: "-", vat: "n/a", gross: undefined },
          ],
        },
      ]),
    );
    expect(inspection.records[0].gross).toEqual({
      kind: "amount",
      amount: 130,
    });
    expect(inspection.records[0].monetaryWarning).toMatch(/doesn't match/);
    expect(inspection.records[1].net).toEqual({ kind: "text", text: "-" });
    expect(inspection.records[1].vat).toEqual({ kind: "text", text: "n/a" });
    expect(inspection.records[1].gross).toEqual({ kind: "blank" });
  });

  it("matches exact project numbers and leaves unusable identifiers unallocated", async () => {
    const inspection = await inspectTpcWorkbook(
      await workbookBuffer([
        { name: "Apr 2026", rows: [red(), red("XXXX"), red("")] },
      ]),
    );
    const result = resolveTpcRecords(
      [inspection],
      { version: 1, decisions: {} },
      [
        {
          code: "7005",
          description: "Known Project",
          sources: ["job-register"],
        },
      ],
    );
    expect(result.allocated.map((item) => item.projectDescription)).toEqual([
      "Known Project",
    ]);
    expect(result.unallocated).toHaveLength(2);
    expect(result.issues).toHaveLength(2);
  });

  it("persists deliberate unallocated, project and non-project review decisions by source evidence", async () => {
    const inspection = await inspectTpcWorkbook(
      await workbookBuffer([
        { name: "Apr 2026", rows: [red("N/A"), red("XXXX"), red("")] },
      ]),
    );
    const [first, second, third] = inspection.records;
    const result = resolveTpcRecords(
      [inspection],
      {
        version: 1,
        decisions: {
          [first.key]: { kind: "unallocated" },
          [second.key]: {
            kind: "project",
            projectCode: "7005",
            projectDescription: "Known",
          },
          [third.key]: { kind: "non-project" },
        },
      },
      [],
    );
    expect(result.issues).toEqual([]);
    expect(result.unallocated).toHaveLength(1);
    expect(result.allocated[0].projectCode).toBe("7005");
    expect(result.nonProject).toHaveLength(1);
  });

  it("uses only the newest validated copy for an overlapping financial year", async () => {
    const old = await inspectTpcWorkbook(
      await workbookBuffer([{ name: "Apr 2026", rows: [red()] }]),
      { savedAt: "2026-05-01T00:00:00.000Z" },
    );
    const newerBlack = await inspectTpcWorkbook(
      await workbookBuffer([
        { name: "Apr 2026", rows: [{ ...red(), outstanding: false }] },
      ]),
      { savedAt: "2026-06-01T00:00:00.000Z" },
    );
    const resolved = resolveTpcRecords(
      [old as TpcWorkbookInspection, newerBlack],
      { version: 1, decisions: {} },
      [],
    );
    expect(resolved.records).toEqual([]);
  });
});
