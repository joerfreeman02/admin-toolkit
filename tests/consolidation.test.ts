import { describe, expect, it } from "vitest";
import {
  applyUncodedApprovals,
  consolidateEntries,
  entryReviewKey,
} from "../src/consolidation";
import type { EmployeeRegister, TimeEntry } from "../src/domain";
import { addEmployee, emptyEmployeeRegister } from "../src/employeeRegister";

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
    hours,
    classification,
    trace: { file: `${employee}.xlsx`, worksheet: "Jul 26", row },
  };
}

describe("classification review and consolidation", () => {
  it("keeps an uncoded entry fail-closed until explicit approval", () => {
    const uncoded = entry(
      "Employee Alpha",
      "Uncoded Study",
      1.5,
      "exception",
      5,
    );
    expect(
      consolidateEntries([uncoded], register(), "2026-07").projects,
    ).toEqual([]);
    const approved = applyUncodedApprovals(
      [uncoded],
      new Set([entryReviewKey(uncoded)]),
    );
    expect(approved[0]).toMatchObject({
      classification: "project",
      approvedUncoded: true,
    });
  });

  it("aggregates repeated rows for one employee and multiple employees", () => {
    const result = consolidateEntries(
      [
        entry("Employee Alpha", "Study", 1, "project", 5, "2101"),
        entry("Employee Alpha", "Study", 2, "project", 6, "2101"),
        entry("Employee Beta", "Study", 3, "project", 5, "2101"),
      ],
      register(),
      "2026-07",
    );
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].total).toBe(6);
    expect(Object.values(result.projects[0].hoursByEmployee).sort()).toEqual([
      3, 3,
    ]);
  });

  it("sorts coded projects numerically and approved uncoded projects last", () => {
    const uncoded = entry(
      "Employee Alpha",
      "Reviewed Study",
      1,
      "exception",
      9,
    );
    const entries = applyUncodedApprovals(
      [
        entry("Employee Alpha", "Later", 1, "project", 5, "900"),
        entry("Employee Alpha", "First", 1, "project", 6, "120"),
        uncoded,
      ],
      new Set([entryReviewKey(uncoded)]),
    );
    expect(
      consolidateEntries(entries, register(), "2026-07").projects.map(
        (project) => project.code ?? "uncoded",
      ),
    ).toEqual(["120", "900", "uncoded"]);
  });

  it("warns and blocks on conflicting descriptions for one project code", () => {
    const result = consolidateEntries(
      [
        entry("Employee Alpha", "Study A", 1, "project", 5, "2101"),
        entry("Employee Beta", "Study B", 2, "project", 5, "2101"),
      ],
      register(),
      "2026-07",
    );
    expect(result.descriptionConflicts).toMatchObject([
      {
        projectCode: "2101",
        descriptions: ["Study A", "Study B"],
        resolved: false,
      },
    ]);
    expect(result.descriptionConflicts[0].sources).toEqual([
      {
        description: "Study A",
        traces: [{ file: "Employee Alpha.xlsx", worksheet: "Jul 26", row: 5 }],
      },
      {
        description: "Study B",
        traces: [{ file: "Employee Beta.xlsx", worksheet: "Jul 26", row: 5 }],
      },
    ]);
    expect(result.canExport).toBe(false);
  });

  it("uses deliberate observed choices while preserving all hours and blocking any second unresolved conflict", () => {
    const entries = [
      entry("Employee Alpha", "Study A", 1, "project", 5, "2101"),
      entry("Employee Beta", "Study B", 2, "project", 5, "2101"),
      entry("Employee Alpha", "Design A", 3, "project", 6, "2102"),
      entry("Employee Beta", "Design B", 4, "project", 6, "2102"),
    ];
    const oneResolved = consolidateEntries(
      entries,
      register(),
      "2026-07",
      new Map([["2101", "Study B"]]),
    );
    expect(
      oneResolved.projects.find((project) => project.code === "2101"),
    ).toMatchObject({
      description: "Study B",
      total: 3,
    });
    expect(oneResolved.descriptionConflicts).toMatchObject([
      { projectCode: "2101", canonicalDescription: "Study B", resolved: true },
      { projectCode: "2102", resolved: false },
    ]);
    expect(oneResolved.canExport).toBe(false);

    const allResolved = consolidateEntries(
      entries,
      register(),
      "2026-07",
      new Map([
        ["2101", "Study B"],
        ["2102", "Design A"],
      ]),
    );
    expect(allResolved.projectHours).toBe(10);
    expect(allResolved.projects.map((project) => project.description)).toEqual([
      "Study B",
      "Design A",
    ]);
    expect(allResolved.canExport).toBe(true);
    expect(allResolved.blockers).toEqual([]);

    const customAttempt = consolidateEntries(
      entries.slice(0, 2),
      register(),
      "2026-07",
      new Map([["2101", "Unobserved automatic label"]]),
    );
    expect(customAttempt.descriptionConflicts[0].resolved).toBe(false);
    expect(customAttempt.canExport).toBe(false);
  });

  it("keeps internal hours in a separate aggregation", () => {
    const result = consolidateEntries(
      [
        entry("Employee Alpha", "Study", 2, "project", 5, "2101"),
        entry("Employee Alpha", "Training", 1, "internal", 6, "10002"),
      ],
      register(),
      "2026-07",
    );
    expect(result.projects[0].total).toBe(2);
    expect(result.internal[0]).toMatchObject({ code: "10002", total: 1 });
  });

  it("reconciles project, internal and exception hours exactly once", () => {
    const result = consolidateEntries(
      [
        entry("Employee Alpha", "Study", 2, "project", 5, "2101"),
        entry("Employee Alpha", "Training", 1, "internal", 6, "10002"),
        entry("Employee Beta", "Unknown", 0.5, "exception", 7),
      ],
      register(),
      "2026-07",
    );
    expect(result).toMatchObject({
      projectHours: 2,
      internalHours: 1,
      exceptionHours: 0.5,
      importedHours: 3.5,
      reconciles: true,
      canExport: false,
    });
  });

  it("flags an unknown employee without discarding their imported hours", () => {
    const result = consolidateEntries(
      [entry("New Starter", "Study", 2, "project", 5, "2101")],
      register(),
      "2026-07",
    );
    expect(result.unknownEmployees).toEqual(["New Starter"]);
    expect(result.importedHours).toBe(2);
    expect(result.canExport).toBe(false);
  });
});
