import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { Department, EmployeeRegister } from "../src/domain";
import { consolidateEntries } from "../src/consolidation";
import {
  inspectLatestMonthlyWorkbook,
  resolveHistoricalCarry,
} from "../src/monthlyWorkbook";
import { createEmployeeDataset } from "../src/publication";

const STATUS = {
  awaiting: "FFFFFF00",
  invoiced: "FFFFC000",
  carry: "FF92D050",
  closed: "FF95A6BD",
  unknown: "FF00B0F0",
};

interface CellHours {
  abbreviation: string;
  hours: number;
  fill?: string;
}

interface ProjectHours {
  code?: number;
  description: string;
  cells: CellHours[];
}

function fill(argb: string) {
  return {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb },
  };
}

function addMonthSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  abbreviations: string[],
  projects: ProjectHours[],
) {
  const sheet = workbook.addWorksheet(name);
  [
    [3, "HRS to be invoiced highlighted in yellow hatch", STATUS.awaiting],
    [4, "Invoices sent", STATUS.invoiced],
    [5, "These hours need to be carried over for invoicing", STATUS.carry],
    [6, "These hours were carried but have now been invoiced", STATUS.closed],
  ].forEach(([row, text, color]) => {
    sheet.getCell(Number(row), 3).value = String(text);
    sheet.getCell(Number(row), 3).fill = fill(String(color));
  });
  const headerRow = 8;
  sheet.getCell(headerRow, 2).value = "Job Number";
  sheet.getCell(headerRow, 3).value = "Job Name";
  abbreviations.forEach((abbreviation, index) => {
    sheet.getCell(headerRow, 4 + index).value = abbreviation;
  });
  sheet.getCell(headerRow, 4 + abbreviations.length).value =
    "Hours to be carried from previous months";
  sheet.getCell(headerRow, 5 + abbreviations.length).value = "Notes";
  projects.forEach((project, index) => {
    const row = headerRow + 2 + index;
    sheet.getCell(row, 2).value = project.code ?? null;
    sheet.getCell(row, 3).value = project.description;
    project.cells.forEach((item) => {
      const column = 4 + abbreviations.indexOf(item.abbreviation);
      sheet.getCell(row, column).value = item.hours;
      if (item.fill) sheet.getCell(row, column).fill = fill(item.fill);
    });
  });
}

async function workbookBuffer(
  sheets: Array<{
    name: string;
    abbreviations: string[];
    projects: ProjectHours[];
  }>,
) {
  const workbook = new ExcelJS.Workbook();
  sheets.forEach((sheet) =>
    addMonthSheet(workbook, sheet.name, sheet.abbreviations, sheet.projects),
  );
  const value = await workbook.xlsx.writeBuffer();
  const bytes = value as unknown as Uint8Array;
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function register(): EmployeeRegister {
  const employee = (
    id: string,
    fullName: string,
    abbreviation: string,
    department: Department,
  ) => ({
    id,
    fullName,
    aliases: [],
    assignments: [
      {
        effectiveFrom: "2026-01",
        department,
        grade: "Engineer" as const,
        abbreviation,
        withinBandOrder: 0,
        active: true,
      },
    ],
  });
  return {
    version: 1,
    employees: [
      employee("alpha", "Employee Alpha", "EA", "Transport"),
      employee("beta", "Employee Beta", "EB", "Drainage"),
      employee("mixed", "Employee Mixed", "EM", "Mixed"),
    ],
  };
}

describe("Latest Monthly Workbook carry-over", () => {
  it("keeps a genuine green-to-green-to-green lifecycle active with person-level provenance", async () => {
    const data = await workbookBuffer([
      {
        name: "Jul 26",
        abbreviations: ["EA", "EB", "EM"],
        projects: [
          {
            code: 4100,
            description: "Shared Project",
            cells: [
              { abbreviation: "EA", hours: 5, fill: STATUS.carry },
              { abbreviation: "EB", hours: 2, fill: STATUS.carry },
              { abbreviation: "EM", hours: 1, fill: STATUS.carry },
            ],
          },
        ],
      },
      {
        name: "May 26",
        abbreviations: ["EA", "EB", "EM"],
        projects: [
          {
            code: 4100,
            description: "Shared Project",
            cells: [{ abbreviation: "EA", hours: 3, fill: STATUS.carry }],
          },
          {
            code: 4200,
            description: "Duplicate Looking Description",
            cells: [{ abbreviation: "EA", hours: 1, fill: STATUS.carry }],
          },
        ],
      },
      {
        name: "Jun 26",
        abbreviations: ["EA", "EB", "EM"],
        projects: [
          {
            code: 4100,
            description: "Shared Project",
            cells: [{ abbreviation: "EA", hours: 4, fill: STATUS.carry }],
          },
          {
            code: 4300,
            description: "Duplicate Looking Description",
            cells: [{ abbreviation: "EB", hours: 2, fill: STATUS.carry }],
          },
        ],
      },
    ]);

    const inspection = await inspectLatestMonthlyWorkbook(data);
    expect(inspection.worksheets.map((sheet) => sheet.month)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
    ]);
    const resolution = resolveHistoricalCarry(
      inspection,
      register(),
      "2026-08",
    );
    expect(resolution.errors).toEqual([]);
    expect(resolution.records).toHaveLength(5);
    expect(
      resolution.records
        .filter(
          (record) =>
            record.projectCode === "4100" && record.employeeId === "alpha",
        )
        .map((record) => [record.originatingMonth, record.hours]),
    ).toEqual([
      ["2026-05", 3],
      ["2026-06", 4],
      ["2026-07", 5],
    ]);
    expect(
      resolution.records.find((record) => record.employeeId === "beta"),
    ).toMatchObject({ department: "Drainage", projectCode: "4100" });
    expect(
      resolution.records.find((record) => record.employeeId === "mixed"),
    ).toMatchObject({ department: "Mixed", hours: 1 });
    expect(
      new Set(resolution.records.map((record) => record.projectCode)),
    ).toEqual(new Set(["4100"]));
    expect(
      resolution.audit.find((record) => record.projectCode === "4200"),
    ).toMatchObject({
      lifecycleStatus: "expired",
      lifecycleStatusMonth: "2026-06",
    });
  });

  it("uses only the workbook's current green state and excludes closed or current-month cells", async () => {
    const inspection = await inspectLatestMonthlyWorkbook(
      await workbookBuffer([
        {
          name: "May 26",
          abbreviations: ["EA"],
          projects: [
            {
              code: 4100,
              description: "Closed Project",
              cells: [{ abbreviation: "EA", hours: 3, fill: STATUS.closed }],
            },
          ],
        },
        {
          name: "Jul 26",
          abbreviations: ["EA"],
          projects: [
            {
              code: 4200,
              description: "Current Month",
              cells: [{ abbreviation: "EA", hours: 5, fill: STATUS.carry }],
            },
          ],
        },
      ]),
    );
    expect(
      resolveHistoricalCarry(inspection, register(), "2026-07").records,
    ).toEqual([]);
  });

  it("fails safely for missing project numbers, malformed sheets, and duplicate months", async () => {
    const missingProject = await inspectLatestMonthlyWorkbook(
      await workbookBuffer([
        {
          name: "May 26",
          abbreviations: ["EA"],
          projects: [
            {
              description: "Uncoded carry",
              cells: [{ abbreviation: "EA", hours: 2, fill: STATUS.carry }],
            },
          ],
        },
      ]),
    );
    expect(missingProject.errors).toEqual([]);
    expect(
      resolveHistoricalCarry(missingProject, register(), "2026-06").issues,
    ).toEqual([
      expect.objectContaining({ kind: "project", sourceRole: "current" }),
    ]);

    const workbook = new ExcelJS.Workbook();
    addMonthSheet(workbook, "May 26", ["EA"], []);
    workbook.addWorksheet("May 2026");
    const value = (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array;
    const malformed = await inspectLatestMonthlyWorkbook(
      value.buffer.slice(
        value.byteOffset,
        value.byteOffset + value.byteLength,
      ) as ArrayBuffer,
    );
    expect(malformed.errors.join(" ")).toMatch(
      /headings are missing|more than one/i,
    );
  });

  it("exposes an unsupported status fill as a reviewable warning", async () => {
    const inspection = await inspectLatestMonthlyWorkbook(
      await workbookBuffer([
        {
          name: "May 26",
          abbreviations: ["EA"],
          projects: [
            {
              code: 4100,
              description: "Unknown status",
              cells: [{ abbreviation: "EA", hours: 2, fill: STATUS.unknown }],
            },
          ],
        },
      ]),
    );
    expect(inspection.warnings.join(" ")).toMatch(/unfamiliar colour/i);
    expect(inspection.carryCandidates).toEqual([]);
  });

  it("rejects a readable workbook that has no monthly worksheets", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Summary").getCell("A1").value = "Not a month";
    const value = (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array;
    await expect(
      inspectLatestMonthlyWorkbook(
        value.buffer.slice(
          value.byteOffset,
          value.byteOffset + value.byteLength,
        ) as ArrayBuffer,
      ),
    ).rejects.toThrow(/no monthly worksheets were found/i);
  });

  it("reports the structural reason when a recognised month sheet is malformed", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("May 26").getCell("A1").value = "Malformed";
    const value = (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array;
    await expect(
      inspectLatestMonthlyWorkbook(
        value.buffer.slice(
          value.byteOffset,
          value.byteOffset + value.byteLength,
        ) as ArrayBuffer,
      ),
    ).rejects.toThrow(/headings are missing/i);
  });

  it("seeds a previous March carry only when April continues it across the financial year", async () => {
    const previous = await inspectLatestMonthlyWorkbook(
      await workbookBuffer([
        {
          name: "Mar 26",
          abbreviations: ["EA"],
          projects: [
            {
              code: 4100,
              description: "Earlier carry",
              cells: [{ abbreviation: "EA", hours: 2, fill: STATUS.carry }],
            },
          ],
        },
      ]),
      {
        name: "misleading-current-name.xlsx",
        savedAt: "2026-04-01T00:00:00.000Z",
        role: "historical",
      },
    );
    const current = await inspectLatestMonthlyWorkbook(
      await workbookBuffer([
        {
          name: "Apr 26",
          abbreviations: ["EB"],
          projects: [
            {
              code: 4100,
              description: "Cross-year carry",
              cells: [{ abbreviation: "EB", hours: 3, fill: STATUS.carry }],
            },
          ],
        },
      ]),
      {
        name: "actually-says-1999.xlsx",
        savedAt: "2026-08-01T00:00:00.000Z",
        role: "current",
      },
    );
    expect(previous.financialYear).toBe("2025/26");
    expect(current.financialYear).toBe("2026/27");
    const resolution = resolveHistoricalCarry(
      [current, previous],
      register(),
      "2026-05",
    );
    expect(resolution.errors).toEqual([]);
    expect(resolution.records).toHaveLength(2);
    expect(resolution.records[0]).toMatchObject({
      originatingMonth: "2026-03",
      originatingYear: 2026,
      sourceWorkbook: "misleading-current-name.xlsx",
      sourceWorksheet: "Mar 26",
      sourceCell: "D10",
    });
  });

  it("uses the latest workbook state for an overlapping month and does not revive a closed carry", async () => {
    const oldCopy = await inspectLatestMonthlyWorkbook(
      await workbookBuffer([
        {
          name: "May 26",
          abbreviations: ["EA"],
          projects: [
            {
              code: 4100,
              description: "Closed later",
              cells: [{ abbreviation: "EA", hours: 2, fill: STATUS.carry }],
            },
          ],
        },
      ]),
      { savedAt: "2026-06-01T00:00:00.000Z", role: "historical" },
    );
    const latestCopy = await inspectLatestMonthlyWorkbook(
      await workbookBuffer([
        {
          name: "May 26",
          abbreviations: ["EA"],
          projects: [
            {
              code: 4100,
              description: "Closed later",
              cells: [{ abbreviation: "EA", hours: 2, fill: STATUS.closed }],
            },
          ],
        },
      ]),
      { savedAt: "2026-07-01T00:00:00.000Z", role: "current" },
    );
    expect(
      resolveHistoricalCarry([oldCopy, latestCopy], register(), "2026-08")
        .records,
    ).toEqual([]);
  });

  it("keeps legitimate separate month entries while preventing a duplicate workbook copy", async () => {
    const original = await inspectLatestMonthlyWorkbook(
      await workbookBuffer([
        {
          name: "Apr 26",
          abbreviations: ["EA"],
          projects: [
            {
              code: 4100,
              description: "Repeated value",
              cells: [{ abbreviation: "EA", hours: 2, fill: STATUS.carry }],
            },
          ],
        },
        {
          name: "May 26",
          abbreviations: ["EA"],
          projects: [
            {
              code: 4100,
              description: "Repeated value",
              cells: [{ abbreviation: "EA", hours: 2, fill: STATUS.carry }],
            },
          ],
        },
      ]),
      { savedAt: "2026-06-01T00:00:00.000Z" },
    );
    const duplicate = await inspectLatestMonthlyWorkbook(
      await workbookBuffer([
        {
          name: "Apr 26",
          abbreviations: ["EA"],
          projects: [
            {
              code: 4100,
              description: "Repeated value",
              cells: [{ abbreviation: "EA", hours: 2, fill: STATUS.carry }],
            },
          ],
        },
        {
          name: "May 26",
          abbreviations: ["EA"],
          projects: [
            {
              code: 4100,
              description: "Repeated value",
              cells: [{ abbreviation: "EA", hours: 2, fill: STATUS.carry }],
            },
          ],
        },
      ]),
      { savedAt: "2026-07-01T00:00:00.000Z" },
    );
    const records = resolveHistoricalCarry(
      [original, duplicate],
      register(),
      "2026-06",
    ).records;
    expect(records).toHaveLength(2);
    expect(records.map((item) => item.originatingMonth)).toEqual([
      "2026-04",
      "2026-05",
    ]);
  });

  it("expires a green carry when the project is absent from the next recognised month", async () => {
    const inspection = await inspectLatestMonthlyWorkbook(
      await workbookBuffer([
        {
          name: "May 26",
          abbreviations: ["EA"],
          projects: [
            {
              code: 4100,
              description: "Stops after May",
              cells: [{ abbreviation: "EA", hours: 2, fill: STATUS.carry }],
            },
          ],
        },
        {
          name: "Jun 26",
          abbreviations: ["EA"],
          projects: [
            {
              code: 4200,
              description: "Different project",
              cells: [{ abbreviation: "EA", hours: 1 }],
            },
          ],
        },
      ]),
    );
    const resolution = resolveHistoricalCarry(
      inspection,
      register(),
      "2026-07",
    );
    expect(resolution.records).toEqual([]);
    expect(resolution.audit).toEqual([
      expect.objectContaining({
        projectCode: "4100",
        lifecycleStatus: "expired",
        lifecycleStatusMonth: "2026-06",
      }),
    ]);
  });

  it.each([
    ["orange invoice", STATUS.invoiced, "closed"],
    ["grey closed state", STATUS.closed, "closed"],
  ])(
    "lets a later %s supersede earlier green",
    async (_name, laterFill, expected) => {
      const inspection = await inspectLatestMonthlyWorkbook(
        await workbookBuffer([
          {
            name: "May 26",
            abbreviations: ["EA"],
            projects: [
              {
                code: 4100,
                description: "Closed later",
                cells: [{ abbreviation: "EA", hours: 2, fill: STATUS.carry }],
              },
            ],
          },
          {
            name: "Jun 26",
            abbreviations: ["EA"],
            projects: [
              {
                code: 4100,
                description: "Closed later",
                cells: [{ abbreviation: "EA", hours: 2, fill: laterFill }],
              },
            ],
          },
        ]),
      );
      const resolution = resolveHistoricalCarry(
        inspection,
        register(),
        "2026-07",
      );
      expect(resolution.records).toEqual([]);
      expect(resolution.audit[0]).toMatchObject({
        lifecycleStatus: expected,
        lifecycleStatusMonth: "2026-06",
      });
    },
  );

  it("closes Starveacres and keeps Hampton Mead's later green as a separate lifecycle that expires in April", async () => {
    const previous = await inspectLatestMonthlyWorkbook(
      await workbookBuffer([
        {
          name: "Jan 26",
          abbreviations: ["EA", "EB"],
          projects: [
            {
              code: 6526,
              description: "5 Hampton Mead, Loughton",
              cells: [{ abbreviation: "EA", hours: 0.5, fill: STATUS.carry }],
            },
          ],
        },
        {
          name: "Feb 26",
          abbreviations: ["EA", "EB"],
          projects: [
            {
              code: 6526,
              description: "5 Hampton Mead, Loughton",
              cells: [
                { abbreviation: "EA", hours: 4.5, fill: STATUS.invoiced },
              ],
            },
          ],
        },
        {
          name: "Mar 26",
          abbreviations: ["EA", "EB"],
          projects: [
            {
              code: 6526,
              description: "5 Hampton Mead, Loughton",
              cells: [{ abbreviation: "EB", hours: 0.5, fill: STATUS.carry }],
            },
          ],
        },
      ]),
      { role: "historical" },
    );
    const current = await inspectLatestMonthlyWorkbook(
      await workbookBuffer([
        { name: "Apr 26", abbreviations: ["EA", "EB"], projects: [] },
        {
          name: "May 26",
          abbreviations: ["EA", "EB"],
          projects: [
            {
              code: 5752,
              description: "Starveacres, 16 Watford Road, Radlett",
              cells: [{ abbreviation: "EA", hours: 0.5, fill: STATUS.carry }],
            },
          ],
        },
        {
          name: "Jun 26",
          abbreviations: ["EA", "EB"],
          projects: [
            {
              code: 5752,
              description: "Starveacres, 16 Watford Road, Radlett",
              cells: [{ abbreviation: "EA", hours: 2.25, fill: STATUS.carry }],
            },
          ],
        },
        {
          name: "Jul 26",
          abbreviations: ["EA", "EB"],
          projects: [
            {
              code: 5752,
              description: "Starveacres, 16 Watford Road, Radlett",
              cells: [
                { abbreviation: "EA", hours: 10.75, fill: STATUS.invoiced },
              ],
            },
          ],
        },
      ]),
      { role: "current" },
    );
    const resolution = resolveHistoricalCarry(
      [previous, current],
      register(),
      "2026-07",
    );
    expect(
      resolution.records.filter((record) =>
        ["5752", "6526"].includes(record.projectCode ?? ""),
      ),
    ).toEqual([]);
    expect(
      resolution.audit.filter((record) => record.projectCode === "5752"),
    ).toEqual([
      expect.objectContaining({
        originatingMonth: "2026-05",
        lifecycleStatus: "closed",
        lifecycleStatusMonth: "2026-07",
      }),
      expect.objectContaining({
        originatingMonth: "2026-06",
        lifecycleStatus: "closed",
        lifecycleStatusMonth: "2026-07",
      }),
    ]);
    expect(
      resolution.audit.find(
        (record) =>
          record.projectCode === "6526" &&
          record.originatingMonth === "2026-01",
      ),
    ).toMatchObject({
      employeeAbbreviation: "EA",
      lifecycleStatus: "closed",
      lifecycleStatusMonth: "2026-02",
    });
    expect(
      resolution.audit.find(
        (record) =>
          record.projectCode === "6526" &&
          record.originatingMonth === "2026-03",
      ),
    ).toMatchObject({
      employeeAbbreviation: "EB",
      lifecycleStatus: "expired",
      lifecycleStatusMonth: "2026-04",
    });
    const currentRun = consolidateEntries(
      [
        {
          employee: "Employee Alpha",
          reportingMonth: "2026-07",
          projectCode: "5752",
          description: "Starveacres, 16 Watford Road, Radlett",
          hours: 1.25,
          classification: "project",
          trace: { file: "current.xlsx", worksheet: "Jul 26", row: 5 },
        },
      ],
      register(),
      "2026-07",
    );
    const viewer = createEmployeeDataset(currentRun, resolution.records);
    expect(
      viewer.projects.find((project) => project.code === "5752"),
    ).toMatchObject({
      contributors: [expect.objectContaining({ hours: 1.25 })],
      carriedHours: [],
    });
  });

  it("resolves pre-effective-date history to the employee's latest department without manufacturing other employees", async () => {
    const employeeRegister: EmployeeRegister = {
      version: 1,
      employees: [
        {
          id: "alpha",
          fullName: "Employee Alpha",
          aliases: [],
          assignments: [
            {
              effectiveFrom: "2026-05",
              department: "Drainage",
              grade: "Engineer",
              abbreviation: "EA",
              withinBandOrder: 0,
              active: true,
            },
            {
              effectiveFrom: "2026-07",
              department: "Transport",
              grade: "Engineer",
              abbreviation: "EA",
              withinBandOrder: 0,
              active: true,
            },
          ],
        },
        {
          id: "later-joiner",
          fullName: "Later Joiner",
          aliases: [],
          assignments: [
            {
              effectiveFrom: "2026-08",
              department: "Mixed",
              grade: "Engineer",
              abbreviation: "LJ",
              withinBandOrder: 0,
              active: true,
            },
          ],
        },
      ],
    };
    const inspection = await inspectLatestMonthlyWorkbook(
      await workbookBuffer([
        {
          name: "Apr 26",
          abbreviations: ["EA"],
          projects: [
            {
              code: 4100,
              description: "April source",
              cells: [{ abbreviation: "EA", hours: 2, fill: STATUS.carry }],
            },
          ],
        },
      ]),
    );
    const records = resolveHistoricalCarry(
      inspection,
      employeeRegister,
      "2026-05",
    ).records;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      employeeId: "alpha",
      department: "Transport",
      originatingMonth: "2026-04",
    });
    expect(records.some((item) => item.employeeId === "later-joiner")).toBe(
      false,
    );
  });
});
