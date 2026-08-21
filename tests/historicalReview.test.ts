import { beforeEach, describe, expect, it } from "vitest";
import type {
  EmployeeRegister,
  HistoricalReviewState,
  LatestMonthlyWorkbookInspection,
  WorkbookCarryCandidate,
} from "../src/domain";
import {
  HISTORICAL_REVIEW_KEY,
  emptyHistoricalReviewState,
  formerEmployeeMapping,
  historicalCandidateKey,
  loadHistoricalReviewState,
  saveHistoricalReviewState,
} from "../src/historicalReview";
import { resolveHistoricalCarry } from "../src/monthlyWorkbook";

const register: EmployeeRegister = {
  version: 1,
  employees: [
    {
      id: "former",
      fullName: "Former Employee",
      aliases: [],
      assignments: [
        {
          effectiveFrom: "2024-04",
          effectiveTo: "2025-03",
          department: "Transport",
          grade: "Engineer",
          abbreviation: "FE",
          withinBandOrder: 0,
          active: false,
        },
      ],
    },
  ],
};

function candidate(
  overrides: Partial<WorkbookCarryCandidate> = {},
): WorkbookCarryCandidate {
  return {
    projectCode: "2101",
    projectDescription: "Historical Project",
    employeeAbbreviation: "OLD",
    hours: 3.5,
    originatingMonth: "2025-02",
    originatingYear: 2025,
    sourceWorkbook: "Historical.xlsx",
    sourceWorkbookId: "historical-1",
    sourceWorksheet: "Feb 25",
    sourceRow: 12,
    sourceColumn: 4,
    sourceCell: "D12",
    status: "carry",
    fill: "#92D050",
    ...overrides,
  };
}

function inspection(
  item: WorkbookCarryCandidate,
): LatestMonthlyWorkbookInspection {
  return {
    financialYear: "2024/25",
    financialYearStart: 2024,
    updatedThrough: "2025-03",
    source: {
      id: "historical-1",
      name: "Historical.xlsx",
      financialYear: "2024/25",
      savedAt: "2026-07-01T00:00:00.000Z",
      role: "historical",
    },
    worksheets: [
      {
        name: "Feb 25",
        month: "2025-02",
        financialYear: "2024/25",
        headerRow: 9,
        employeeColumns: 1,
      },
    ],
    carryCandidates: [item],
    warnings: [],
    errors: [],
  };
}

beforeEach(() => localStorage.clear());

describe("persistent historical review", () => {
  it("persists workstation decisions without changing the Employee Register", () => {
    const state: HistoricalReviewState = {
      version: 1,
      employeeMappings: { OLD: "former" },
      issueResolutions: {},
    };
    saveHistoricalReviewState(state);
    expect(loadHistoricalReviewState()).toEqual(state);
    expect(localStorage.getItem(HISTORICAL_REVIEW_KEY)).toContain("former");
    expect(register.employees[0].aliases).toEqual([]);
  });

  it("reuses an unchanged former-employee mapping", () => {
    const state = emptyHistoricalReviewState();
    state.employeeMappings.OLD = "former";
    const resolved = resolveHistoricalCarry(
      inspection(candidate()),
      register,
      "2026-07",
      state,
    );
    expect(resolved.issues).toEqual([]);
    expect(resolved.records[0]).toMatchObject({
      employeeId: "former",
      employee: "Former Employee",
    });
  });

  it("creates a stable inactive historical identity without changing the current register", () => {
    const state = emptyHistoricalReviewState();
    state.employeeMappings.OLD = formerEmployeeMapping("OLD");
    const before = JSON.stringify(register);
    const resolved = resolveHistoricalCarry(
      inspection(candidate()),
      register,
      "2026-07",
      state,
    );
    expect(resolved.issues).toEqual([]);
    expect(resolved.records[0]).toMatchObject({
      employeeId: "historical-former:OLD",
      employee: "Former employee (OLD)",
      employeeAbbreviation: "OLD",
    });
    expect(JSON.stringify(register)).toBe(before);
  });

  it("persists a project resolution and reopens when source hours change", () => {
    const missingProject = candidate({ projectCode: undefined });
    const key = historicalCandidateKey(missingProject);
    const state = emptyHistoricalReviewState();
    state.employeeMappings.OLD = "former";
    state.issueResolutions[key] = {
      kind: "project",
      projectCode: "3100",
      projectDescription: "Resolved Project",
    };
    const unchanged = resolveHistoricalCarry(
      inspection(missingProject),
      register,
      "2026-07",
      state,
    );
    expect(unchanged.issues).toEqual([]);
    expect(unchanged.records[0].projectCode).toBe("3100");

    const changed = candidate({ projectCode: undefined, hours: 4.5 });
    expect(historicalCandidateKey(changed)).not.toBe(key);
    const reopened = resolveHistoricalCarry(
      inspection(changed),
      register,
      "2026-07",
      state,
    );
    expect(reopened.issues[0]).toMatchObject({ kind: "project" });
    expect(reopened.records).toEqual([]);
  });

  it("does not allow persisted acknowledgements to bypass workbook structure errors", () => {
    const source = inspection(candidate());
    source.errors = ["Mar 25: the carried-hours column is missing."];
    const state = emptyHistoricalReviewState();
    state.employeeMappings.OLD = "former";
    state.issueResolutions[
      "source|2024/25|historical|error|Mar 25: the carried-hours column is missing."
    ] = { kind: "exclude" };
    const resolved = resolveHistoricalCarry(source, register, "2026-07", state);
    expect(resolved.errors).toContain(
      "Mar 25: the carried-hours column is missing.",
    );
    expect(resolved.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "workbook-error" }),
      ]),
    );
  });

  it("suppresses an unchanged closed-year item marked already dealt with and reopens on change", () => {
    const missingProject = candidate({ projectCode: undefined });
    const state = emptyHistoricalReviewState();
    state.employeeMappings.OLD = "former";
    state.issueResolutions[historicalCandidateKey(missingProject)] = {
      kind: "already-dealt-with",
    };
    expect(
      resolveHistoricalCarry(
        inspection(missingProject),
        register,
        "2026-07",
        state,
      ).issues,
    ).toEqual([]);
    const changed = candidate({ projectCode: undefined, hours: 4.25 });
    expect(
      resolveHistoricalCarry(inspection(changed), register, "2026-07", state)
        .issues[0],
    ).toMatchObject({ kind: "project", sourceRole: "historical" });
  });

  it("keeps an authorised historical missing-project item as Unknown carry without inventing a code", () => {
    const missingProject = candidate({ projectCode: undefined });
    const state = emptyHistoricalReviewState();
    state.employeeMappings.OLD = formerEmployeeMapping("OLD");
    state.issueResolutions[historicalCandidateKey(missingProject)] = {
      kind: "unknown-project-carry",
    };
    const resolved = resolveHistoricalCarry(
      inspection(missingProject),
      register,
      "2026-07",
      state,
    );
    expect(resolved.issues).toEqual([]);
    expect(resolved.records[0]).toMatchObject({
      projectCode: undefined,
      originatingMonth: "2025-02",
      hours: 3.5,
      employee: "Former employee (OLD)",
    });
  });

  it("does not let a historical-only decision bypass current-year carry authority", () => {
    const missingProject = candidate({ projectCode: undefined });
    const current = inspection(missingProject);
    current.source.role = "current";
    current.source.financialYear = "2026/27";
    current.financialYear = "2026/27";
    const state = emptyHistoricalReviewState();
    state.employeeMappings.OLD = "former";
    state.issueResolutions[historicalCandidateKey(missingProject)] = {
      kind: "already-dealt-with",
    };
    const resolved = resolveHistoricalCarry(
      current,
      register,
      "2026-07",
      state,
    );
    expect(resolved.errors).toHaveLength(1);
    expect(resolved.issues[0]).toMatchObject({
      kind: "project",
      sourceRole: "current",
    });
  });

  it("keeps an authorised current-FY missing-project carry with its source provenance", () => {
    const missingProject = candidate({ projectCode: undefined });
    const current = inspection(missingProject);
    current.source.role = "current";
    current.source.financialYear = "2026/27";
    current.financialYear = "2026/27";
    const state = emptyHistoricalReviewState();
    state.employeeMappings.OLD = formerEmployeeMapping("OLD");
    state.issueResolutions[historicalCandidateKey(missingProject)] = {
      kind: "unknown-project-carry",
    };

    const resolved = resolveHistoricalCarry(
      current,
      register,
      "2026-07",
      state,
    );

    expect(resolved.errors).toEqual([]);
    expect(resolved.issues).toEqual([]);
    expect(resolved.records[0]).toMatchObject({
      projectCode: undefined,
      originatingMonth: "2025-02",
      hours: 3.5,
      employee: "Former employee (OLD)",
      sourceWorkbook: "Historical.xlsx",
      sourceCell: "D12",
    });
  });
});
