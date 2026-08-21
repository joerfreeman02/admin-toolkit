import { describe, expect, it } from "vitest";
import { consolidateEntries } from "../src/consolidation";
import type {
  EmployeeRegister,
  HistoricalCarryRecord,
  ResolvedTpcRecord,
  TimeEntry,
  TpcResolution,
} from "../src/domain";
import { createEmployeeDataset } from "../src/publication";

const register: EmployeeRegister = {
  version: 1,
  employees: [
    {
      id: "alpha",
      fullName: "Employee Alpha",
      aliases: [],
      assignments: [
        {
          effectiveFrom: "2026-01",
          department: "Transport",
          grade: "Engineer",
          abbreviation: "EA",
          withinBandOrder: 0,
          active: true,
        },
      ],
    },
  ],
};

const entry: TimeEntry = {
  employee: "Employee Alpha",
  reportingMonth: "2026-07",
  projectCode: "7005",
  description: "Known Project",
  hours: 5,
  classification: "project",
  trace: { file: "private-timesheet.xlsx", worksheet: "Jul 26", row: 12 },
};

const carry: HistoricalCarryRecord = {
  projectCode: "7005",
  projectDescription: "Known Project",
  employeeId: "alpha",
  employee: "Employee Alpha",
  department: "Transport",
  employeeAbbreviation: "EA",
  hours: 4,
  originatingMonth: "2026-06",
  originatingYear: 2026,
  sourceWorkbook: "private-hours.xlsx",
  sourceWorkbookId: "hours-private",
  sourceWorksheet: "Jun 26",
  sourceRow: 20,
  sourceColumn: 4,
  sourceCell: "D20",
  status: "carry",
  fill: "#92D050",
};

function tpc(overrides: Partial<ResolvedTpcRecord> = {}): ResolvedTpcRecord {
  return {
    key: "tpc-key",
    originatingDate: "2026-07-10",
    originatingMonth: "2026-07",
    originatingYear: 2026,
    supplier: "Synthetic Supplier",
    projectManager: "PRIVATE PM",
    projectNumberRaw: "7005",
    projectCode: "7005",
    projectDescription: "Known Project",
    description: "Mapping",
    net: { kind: "amount", amount: 100 },
    vat: { kind: "amount", amount: 20 },
    gross: { kind: "amount", amount: 120 },
    notes: "PRIVATE NOTE",
    sourceFinancialYear: "2026/27",
    sourceWorkbook: "private-tpc.xlsx",
    sourceWorkbookId: "tpc-private",
    sourceWorksheet: "Jul 2026",
    sourceRow: 9,
    status: "outstanding",
    statusEvidence: "red-row",
    resolution: "project",
    ...overrides,
  };
}

describe("final Employee Viewer publication data", () => {
  it("preserves carry origin and publishes minimal outstanding TPC fields", () => {
    const allocated = tpc();
    const unallocated = tpc({
      key: "unallocated",
      projectCode: undefined,
      projectDescription: undefined,
      projectNumberRaw: "N/A",
      resolution: "unallocated",
    });
    const resolution: TpcResolution = {
      loaded: true,
      records: [allocated, unallocated],
      warningRecords: [],
      allocated: [allocated],
      unallocated: [unallocated],
      nonProject: [],
      issues: [],
      warnings: [],
    };
    const dataset = createEmployeeDataset(
      consolidateEntries([entry], register, "2026-07"),
      [carry],
      resolution,
    );
    expect(dataset.projects[0].carriedHours).toEqual([
      expect.objectContaining({ originatingMonth: "2026-06", hours: 4 }),
    ]);
    expect(dataset.projects[0].outstandingTpcs).toHaveLength(1);
    expect(dataset.unallocatedTpcs).toHaveLength(1);
    expect(dataset.tpcLoaded).toBe(true);
    expect(JSON.stringify(dataset)).not.toMatch(
      /PRIVATE PM|PRIVATE NOTE|private-tpc|private-timesheet|sourceWorksheet|sourceRow/,
    );
  });

  it("states TPC was not loaded through an explicit publication flag", () => {
    const dataset = createEmployeeDataset(
      consolidateEntries([entry], register, "2026-07"),
      [carry],
    );
    expect(dataset.tpcLoaded).toBe(false);
    expect(dataset.unallocatedTpcs).toEqual([]);
  });

  it("keeps an unknown-project carry discoverable with its original month", () => {
    const dataset = createEmployeeDataset(
      consolidateEntries([entry], register, "2026-07"),
      [{ ...carry, projectCode: undefined, projectDescription: undefined }],
    );
    expect(dataset.statuses).toContainEqual({
      employee: "Employee Alpha",
      kind: "unknown-project",
      hours: 4,
      originatingMonth: "2026-06",
    });
  });
});
