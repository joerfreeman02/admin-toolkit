import type {
  ConsolidationResult,
  EmployeeRegister,
  InternalConsolidationRow,
  ProjectConsolidationRow,
  TimeEntry,
} from "./domain";
import {
  abbreviationCollisions,
  employeeSnapshot,
  resolveEmployee,
} from "./employeeRegister";
import { reconcile } from "./processing";

function normalise(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function entryReviewKey(entry: TimeEntry) {
  return `${entry.trace.file}|${entry.trace.worksheet}|${entry.trace.row}`;
}

export function applyUncodedApprovals(
  entries: TimeEntry[],
  approvals: ReadonlySet<string>,
): TimeEntry[] {
  return entries.map((entry) =>
    entry.classification === "exception" && approvals.has(entryReviewKey(entry))
      ? { ...entry, classification: "project", approvedUncoded: true }
      : entry,
  );
}

export function missingRegisteredEmployees(
  sourceNames: string[],
  register: EmployeeRegister,
  month: string,
) {
  const found = new Set(
    sourceNames
      .map((name) => resolveEmployee(register, month, name)?.id)
      .filter(Boolean),
  );
  return employeeSnapshot(register, month)
    .filter((employee) => !found.has(employee.id))
    .map((employee) => employee.fullName);
}

export function consolidateEntries(
  entries: TimeEntry[],
  register: EmployeeRegister,
  month: string,
): ConsolidationResult {
  const employees = employeeSnapshot(register, month);
  const projects = new Map<string, ProjectConsolidationRow>();
  const internal = new Map<string, InternalConsolidationRow>();
  const descriptions = new Map<string, Set<string>>();
  const unknownEmployees = new Set<string>();
  const unresolved = entries.filter(
    (entry) => entry.classification === "exception",
  );

  for (const entry of entries) {
    const employee = resolveEmployee(register, month, entry.employee);
    if (!employee) {
      unknownEmployees.add(entry.employee);
      continue;
    }
    if (entry.classification === "project") {
      const key = entry.approvedUncoded
        ? `uncoded:${normalise(entry.description)}`
        : `code:${entry.projectCode}`;
      const row = projects.get(key) ?? {
        key,
        code: entry.approvedUncoded ? undefined : entry.projectCode,
        description: entry.description,
        approvedUncoded: !!entry.approvedUncoded,
        hoursByEmployee: {},
        total: 0,
        traces: [],
      };
      row.hoursByEmployee[employee.id] =
        (row.hoursByEmployee[employee.id] ?? 0) + entry.hours;
      row.total += entry.hours;
      row.traces.push(entry.trace);
      projects.set(key, row);
      if (!entry.approvedUncoded && entry.projectCode) {
        const set = descriptions.get(entry.projectCode) ?? new Set<string>();
        set.add(entry.description.trim());
        descriptions.set(entry.projectCode, set);
      }
    } else if (entry.classification === "internal") {
      const key = entry.projectCode
        ? `code:${entry.projectCode}`
        : `description:${normalise(entry.internalCategory ?? entry.description)}`;
      const row = internal.get(key) ?? {
        key,
        code: entry.projectCode,
        description: entry.internalCategory ?? entry.description,
        hoursByEmployee: {},
        total: 0,
        traces: [],
      };
      row.hoursByEmployee[employee.id] =
        (row.hoursByEmployee[employee.id] ?? 0) + entry.hours;
      row.total += entry.hours;
      row.traces.push(entry.trace);
      internal.set(key, row);
    }
  }

  const descriptionConflicts = [...descriptions.entries()]
    .filter(([, values]) => {
      const normalized = new Set([...values].map(normalise));
      return normalized.size > 1;
    })
    .map(([projectCode, values]) => ({
      projectCode,
      descriptions: [...values].sort(),
    }));
  const totals = reconcile(entries);
  const blockers: string[] = [];
  if (!totals.reconciles) blockers.push("Hours do not reconcile.");
  if (unknownEmployees.size)
    blockers.push(
      "Unknown employees must be resolved in the Employee Register.",
    );
  if (unresolved.length)
    blockers.push("Unresolved exceptions must be reviewed before export.");
  if (descriptionConflicts.length)
    blockers.push("Conflicting project descriptions must be resolved.");
  const collisions = abbreviationCollisions(register, month);
  if (collisions.length)
    blockers.push(`Abbreviation collisions: ${collisions.join(", ")}.`);

  return {
    month,
    employees,
    projects: [...projects.values()].sort((a, b) =>
      a.code && b.code
        ? Number(a.code) - Number(b.code)
        : a.code
          ? -1
          : b.code
            ? 1
            : a.description.localeCompare(b.description),
    ),
    internal: [...internal.values()].sort((a, b) =>
      a.code && b.code
        ? Number(a.code) - Number(b.code)
        : a.code
          ? -1
          : b.code
            ? 1
            : a.description.localeCompare(b.description),
    ),
    unresolved,
    unknownEmployees: [...unknownEmployees].sort(),
    descriptionConflicts,
    projectHours: totals.project,
    internalHours: totals.internal,
    exceptionHours: totals.exception,
    importedHours: totals.total,
    reconciles: totals.reconciles,
    sourceDiscrepancyCount: entries.filter((entry) => entry.hoursAudit?.differs)
      .length,
    canExport: blockers.length === 0,
    blockers,
  };
}
