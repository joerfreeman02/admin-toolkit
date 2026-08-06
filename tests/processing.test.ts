import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { CarryoverSchema, type TimeEntry } from "../src/domain";
import {
  classify,
  expandUploads,
  extractProjectCode,
  parseWorkbook,
  processUploads,
  reconcile,
  toPublicDataset,
} from "../src/processing";

function workbook(rows: Record<string, unknown>[], sheet = "Timesheet") {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheet);
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
function file(name: string, data: ArrayBuffer) {
  return new File([data], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
const base = { Employee: "Employee A", Month: "2026-07" };

describe("classification and parsing", () => {
  it("extracts a project code", () =>
    expect(extractProjectCode("Project 2101 - study")).toBe("2101"));
  it("classifies coded projects", () =>
    expect(classify("2101", "Study")).toBe("project"));
  it("classifies configured internal names", () =>
    expect(classify(undefined, "Holiday")).toBe("internal"));
  it("classifies codes at the configured threshold as internal", () =>
    expect(classify("10000", "Admin")).toBe("internal"));
  it("classifies uncoded project entries as exceptions", () =>
    expect(classify(undefined, "Awaiting code")).toBe("exception"));
  it("identifies employee and reporting month", () => {
    const result = parseWorkbook(
      workbook([
        { ...base, "Project Code": 2101, Description: "Study", Hours: 1.25 },
      ]),
      "a.xlsx",
      "2026-07",
    );
    expect(result.employee).toBe("Employee A");
    expect(result.entries[0].reportingMonth).toBe("2026-07");
  });
  it("retains source lineage", () =>
    expect(
      parseWorkbook(
        workbook([
          { ...base, "Project Code": 2101, Description: "Study", Hours: 2 },
        ]),
        "a.xlsx",
        "2026-07",
      ).entries[0].trace,
    ).toEqual({ file: "a.xlsx", worksheet: "Timesheet", row: 2 }));
  it("reports a missing requested month", () =>
    expect(
      parseWorkbook(
        workbook([
          { ...base, Month: "2026-06", Description: "Study", Hours: 2 },
        ]),
        "a.xlsx",
        "2026-07",
      ).warnings,
    ).toContain("a.xlsx: requested month not found"));
  it("rejects malformed workbooks", () =>
    expect(() =>
      parseWorkbook(new Uint8Array([1, 2, 3]).buffer, "bad.xlsx", "2026-07"),
    ).toThrow());
  it("rejects a workbook without the requested month worksheet", () =>
    expect(() =>
      parseWorkbook(workbook([base], "Summary"), "a.xlsx", "2026-07"),
    ).toThrow("Requested month worksheet not found"));
  it("warns on malformed totals without losing other rows", () => {
    const result = parseWorkbook(
      workbook([
        { ...base, Description: "Bad", Hours: "not-a-number" },
        { ...base, "Project Code": 2101, Description: "Good", Hours: 2 },
      ]),
      "a.xlsx",
      "2026-07",
    );
    expect(result.warnings).toHaveLength(1);
    expect(result.entries).toHaveLength(1);
  });
  it("supports decimal, quarter-hour and zero values", () => {
    const result = parseWorkbook(
      workbook([
        { ...base, Description: "One", Hours: 0.25 },
        { ...base, Description: "Zero", Hours: 0 },
      ]),
      "a.xlsx",
      "2026-07",
    );
    expect(result.entries.map((e) => e.hours)).toEqual([0.25]);
  });
  it("parses the verified EAS monthly grid and daily lineage", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["Project Code", "Description"]]),
      "Codes",
    );
    const rows: unknown[][] = Array.from({ length: 7 }, () => []);
    rows[0][2] = "Employee A";
    rows[3] = ["Project Code", "Description", "Notes", "Total", "1", "2"];
    rows[4] = [10000, "Admin", "", 1.25, 0.5, 0.75];
    rows[5] = [2101, "Study", "", 2.5, 1, 1.5];
    rows[6] = ["", "Awaiting code", "", 0.25, 0.25];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(rows),
      "July 2026",
    );
    const data = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
    }) as ArrayBuffer;
    const result = parseWorkbook(data, "synthetic.xlsx", "2026-07");
    expect(result.entries.map((entry) => entry.classification)).toEqual([
      "internal",
      "project",
      "exception",
    ]);
    expect(result.entries[1].dailyHours).toEqual({ "1": 1, "2": 1.5 });
  });
});

describe("aggregation, reconciliation and confidentiality", () => {
  const entries: TimeEntry[] = [
    {
      employee: "Employee A",
      reportingMonth: "2026-07",
      projectCode: "2101",
      description: "Study",
      hours: 2,
      classification: "project",
      trace: { file: "a.xlsx", worksheet: "Timesheet", row: 2 },
    },
    {
      employee: "Employee A",
      reportingMonth: "2026-07",
      projectCode: "2101",
      description: "Study",
      hours: 3,
      classification: "project",
      trace: { file: "a.xlsx", worksheet: "Timesheet", row: 3 },
    },
    {
      employee: "Employee B",
      reportingMonth: "2026-07",
      projectCode: "2101",
      description: "Study",
      hours: 4,
      classification: "project",
      trace: { file: "b.xlsx", worksheet: "Timesheet", row: 2 },
    },
    {
      employee: "Employee A",
      reportingMonth: "2026-07",
      description: "Admin",
      hours: 1,
      classification: "internal",
      trace: { file: "a.xlsx", worksheet: "Timesheet", row: 4 },
    },
    {
      employee: "Employee A",
      reportingMonth: "2026-07",
      description: "Awaiting code",
      hours: 0.5,
      classification: "exception",
      trace: { file: "a.xlsx", worksheet: "Timesheet", row: 5 },
    },
  ];
  it("aggregates repeated employee project rows and project totals", () => {
    const data = toPublicDataset(entries, "2026-07");
    expect(data.projects[0].contributors).toEqual([
      { employee: "Employee A", hours: 5 },
      { employee: "Employee B", hours: 4 },
    ]);
    expect(data.projects[0].total).toBe(9);
  });
  it("puts uncoded projects after coded projects", () =>
    expect(
      toPublicDataset(entries, "2026-07").projects.at(-1)?.code,
    ).toBeUndefined());
  it("reconciles every hour once", () =>
    expect(reconcile(entries)).toEqual({
      project: 9,
      internal: 1,
      exception: 0.5,
      total: 10.5,
      reconciles: true,
    }));
  it("excludes internal categories and source details from public state", () => {
    const json = JSON.stringify(toPublicDataset(entries, "2026-07"));
    expect(json).not.toMatch(/Admin|a\.xlsx|worksheet|internal/);
  });
  it("validates the carryover model", () =>
    expect(
      CarryoverSchema.safeParse({
        employeeInitials: "EA",
        hours: 0.5,
        projectCode: "2101",
        originatingMonth: "2026-07",
        status: "open",
      }).success,
    ).toBe(true));
});

describe("upload orchestration", () => {
  it("extracts xlsx entries from ZIP and ignores other files", async () => {
    const zip = new JSZip();
    zip.file("a.xlsx", workbook([{ ...base, Description: "Study", Hours: 1 }]));
    zip.file("readme.txt", "ignored");
    const upload = new File(
      [await zip.generateAsync({ type: "arraybuffer" })],
      "timesheets.zip",
    );
    expect((await expandUploads([upload])).map((item) => item.name)).toEqual([
      "a.xlsx",
    ]);
  });
  it("handles missing and blank staff timesheets without blocking valid staff", async () => {
    const result = await processUploads(
      [
        file("a.xlsx", workbook([{ ...base, Description: "Study", Hours: 1 }])),
        file(
          "b.xlsx",
          workbook([
            {
              Employee: "Employee B",
              Month: "2026-07",
              Description: "",
              Hours: 0,
            },
          ]),
        ),
      ],
      "2026-07",
    );
    expect(result.entries).toHaveLength(1);
    expect(result.blankTimesheets).toEqual(["Employee B"]);
    expect(result.missingEmployees).toEqual(["Employee C"]);
  });
  it("detects duplicate source files", async () => {
    const data = workbook([{ ...base, Description: "Study", Hours: 1 }]);
    const result = await processUploads(
      [file("same.xlsx", data), file("same.xlsx", data)],
      "2026-07",
    );
    expect(result.entries).toHaveLength(1);
    expect(result.duplicateFiles).toEqual(["same.xlsx"]);
  });
  it("continues mixed valid and invalid input", async () => {
    const result = await processUploads(
      [
        file(
          "good.xlsx",
          workbook([{ ...base, Description: "Study", Hours: 1 }]),
        ),
        file("bad.xlsx", new Uint8Array([1, 2]).buffer),
      ],
      "2026-07",
    );
    expect(result.entries).toHaveLength(1);
    expect(result.fatalErrors).toHaveLength(1);
  });
});
