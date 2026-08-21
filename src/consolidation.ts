import type {
  ConsolidationResult,
  EmployeeRegister,
  InternalConsolidationRow,
  ProjectConsolidationRow,
  TimeEntry,
  UncodedReviewDecision,
} from "./domain";
import {
  abbreviationCollisions,
  employeeSnapshot,
  resolveEmployee,
} from "./employeeRegister";
import { reconcile } from "./processing";
import { isMeaningfulProjectDescription } from "./projectCatalogue";

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
  return applyUncodedDecisions(
    entries,
    new Map(
      entries
        .filter((entry) => approvals.has(entryReviewKey(entry)))
        .map((entry) => [
          entryReviewKey(entry),
          {
            kind: "genuine-uncoded" as const,
            projectDescription: entry.description,
          },
        ]),
    ),
  );
}

export function applyUncodedDecisions(
  entries: TimeEntry[],
  decisions: ReadonlyMap<string, UncodedReviewDecision>,
): TimeEntry[] {
  return entries.map((entry) => {
    if (entry.classification !== "exception") return entry;
    const decision = decisions.get(entryReviewKey(entry));
    if (!decision) return entry;
    if (
      decision.kind === "existing-project" &&
      decision.projectCode &&
      isMeaningfulProjectDescription(decision.projectDescription)
    )
      return {
        ...entry,
        classification: "project",
        approvedUncoded: false,
        uncodedDecision: decision,
      };
    if (
      decision.kind === "genuine-uncoded" &&
      isMeaningfulProjectDescription(decision.projectDescription)
    )
      return {
        ...entry,
        classification: "project",
        approvedUncoded: true,
        uncodedDecision: decision,
      };
    if (decision.kind === "internal" && decision.internalCategory.trim())
      return {
        ...entry,
        projectCode: decision.internalCode,
        internalCategory: decision.internalCategory.trim(),
        classification: "internal",
        approvedUncoded: false,
        uncodedDecision: decision,
      };
    if (decision.kind === "time-in-lieu")
      return {
        ...entry,
        projectCode: undefined,
        internalCategory: "Time in Lieu",
        classification: "time-in-lieu",
        approvedUncoded: false,
        uncodedDecision: decision,
      };
    if (decision.kind === "unknown-project")
      return {
        ...entry,
        projectCode: undefined,
        classification: "unknown",
        approvedUncoded: false,
        uncodedDecision: decision,
      };
    if (decision.kind === "excluded")
      return {
        ...entry,
        projectCode: undefined,
        classification: "excluded",
        approvedUncoded: false,
        uncodedDecision: decision,
      };
    return entry;
  });
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
  descriptionResolutions: ReadonlyMap<string, string> = new Map(),
): ConsolidationResult {
  const employees = employeeSnapshot(register, month);
  const projects = new Map<string, ProjectConsolidationRow>();
  const internal = new Map<string, InternalConsolidationRow>();
  const descriptions = new Map<string, Map<string, TimeEntry["trace"][]>>();
  const unknownHoursByEmployee: Record<string, number> = {};
  const excludedHoursByEmployee: Record<string, number> = {};
  const timeInLieuHoursByEmployee: Record<string, number> = {};
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
      const matched =
        entry.uncodedDecision?.kind === "existing-project"
          ? entry.uncodedDecision
          : undefined;
      const genuine =
        entry.uncodedDecision?.kind === "genuine-uncoded"
          ? entry.uncodedDecision
          : undefined;
      const projectCode = matched?.projectCode ?? entry.projectCode;
      const projectDescription =
        matched?.projectDescription ??
        genuine?.projectDescription ??
        entry.description;
      const approvedUncoded = !!genuine || !!entry.approvedUncoded;
      const key = approvedUncoded
        ? `uncoded:${normalise(projectDescription)}`
        : `code:${projectCode}`;
      const row = projects.get(key) ?? {
        key,
        code: approvedUncoded ? undefined : projectCode,
        description: projectDescription,
        approvedUncoded,
        hoursByEmployee: {},
        total: 0,
        traces: [],
      };
      row.hoursByEmployee[employee.id] =
        (row.hoursByEmployee[employee.id] ?? 0) + entry.hours;
      row.total += entry.hours;
      row.traces.push(entry.trace);
      projects.set(key, row);
      if (!approvedUncoded && projectCode) {
        const values = descriptions.get(projectCode) ?? new Map();
        const description = projectDescription.trim();
        values.set(description, [
          ...(values.get(description) ?? []),
          entry.trace,
        ]);
        descriptions.set(projectCode, values);
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
    } else if (entry.classification === "unknown") {
      unknownHoursByEmployee[employee.id] =
        (unknownHoursByEmployee[employee.id] ?? 0) + entry.hours;
    } else if (entry.classification === "excluded") {
      excludedHoursByEmployee[employee.id] =
        (excludedHoursByEmployee[employee.id] ?? 0) + entry.hours;
    } else if (entry.classification === "time-in-lieu") {
      timeInLieuHoursByEmployee[employee.id] =
        (timeInLieuHoursByEmployee[employee.id] ?? 0) + entry.hours;
    }
  }

  const descriptionConflicts = [...descriptions.entries()]
    .filter(([, values]) => {
      const normalized = new Set([...values.keys()].map(normalise));
      return normalized.size > 1;
    })
    .map(([projectCode, values]) => {
      const observed = [...values.keys()].sort();
      const selected = descriptionResolutions.get(projectCode);
      const canonicalDescription =
        selected && observed.includes(selected) ? selected : undefined;
      if (canonicalDescription) {
        const project = projects.get(`code:${projectCode}`);
        if (project) project.description = canonicalDescription;
      }
      return {
        projectCode,
        descriptions: observed,
        sources: observed.map((description) => ({
          description,
          traces: values.get(description) ?? [],
        })),
        canonicalDescription,
        resolved: !!canonicalDescription,
      };
    });
  const totals = reconcile(entries);
  const blockers: string[] = [];
  if (!totals.reconciles) blockers.push("Hours do not reconcile.");
  if (unknownEmployees.size)
    blockers.push(
      "Unknown employees must be resolved in the Employee Register.",
    );
  if (unresolved.length)
    blockers.push("Some timesheet entries still need a decision.");
  if (descriptionConflicts.some((conflict) => !conflict.resolved))
    blockers.push("Some project names still need a decision.");
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
    unknownHours: totals.unknown,
    excludedHours: totals.excluded,
    timeInLieuHours: totals.timeInLieu,
    unknownHoursByEmployee,
    excludedHoursByEmployee,
    timeInLieuHoursByEmployee,
    exceptionHours: totals.exception,
    importedHours: totals.total,
    reconciles: totals.reconciles,
    sourceDiscrepancyCount: entries.filter((entry) => entry.hoursAudit?.differs)
      .length,
    canExport: blockers.length === 0,
    blockers,
  };
}
