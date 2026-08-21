import type { Cell, Fill, Worksheet } from "exceljs";
import type {
  EmployeeRegister,
  FinancialYearWorkbookRole,
  HistoricalCarryRecord,
  HistoricalCarryResolution,
  HistoricalReviewIssue,
  HistoricalReviewState,
  LatestMonthlyWorkbookInspection,
  WorkbookCarryCandidate,
} from "./domain";
import { latestEmployeeSnapshot } from "./employeeRegister";
import { financialYearForMonth } from "./financialYear";
import { extractProjectCode } from "./processing";
import {
  emptyHistoricalReviewState,
  formerEmployeeAbbreviation,
  historicalCandidateKey,
  historicalEmployeeKey,
  historicalSourceIssueKey,
  normaliseHistoricalAbbreviation,
} from "./historicalReview";

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const CARRY_RGB = "92D050";

export interface WorkbookInspectionSource {
  id?: string;
  name?: string;
  savedAt?: string;
  role?: FinancialYearWorkbookRole;
}

export function monthFromSheetName(name: string) {
  const match = name
    .trim()
    .match(
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s*[-/]?\s*(\d{2}|\d{4})$/i,
    );
  if (!match) return undefined;
  const monthName =
    match[1].toLowerCase() === "sept" ? "sep" : match[1].toLowerCase();
  const month = MONTHS.indexOf(monthName) + 1;
  const rawYear = Number(match[2]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function fillKey(fill: Fill | undefined) {
  if (
    !fill ||
    fill.type !== "pattern" ||
    !fill.pattern ||
    fill.pattern === "none"
  )
    return "none";
  const color = fill.fgColor as
    | { argb?: string; theme?: number; tint?: number; indexed?: number }
    | undefined;
  if (color?.argb) return `rgb:${color.argb.slice(-6).toUpperCase()}`;
  if (color?.theme !== undefined)
    return `theme:${color.theme}:${color.tint ?? 0}`;
  if (color?.indexed !== undefined) return `indexed:${color.indexed}`;
  return `pattern:${fill.pattern}`;
}

function numericValue(cell: Cell) {
  if (typeof cell.value === "number") return cell.value;
  if (
    cell.value &&
    typeof cell.value === "object" &&
    "result" in cell.value &&
    typeof cell.value.result === "number"
  )
    return cell.value.result;
  return undefined;
}

function textValue(cell: Cell) {
  return typeof cell.value === "string" ? cell.value.trim() : "";
}

function findHeaderRow(sheet: Worksheet) {
  for (let row = 1; row <= Math.min(sheet.rowCount, 50); row++)
    if (textValue(sheet.getCell(row, 2)).toLowerCase().startsWith("job number"))
      return row;
  return undefined;
}

function legendFills(sheet: Worksheet, headerRow: number) {
  const values = new Map<string, string>();
  for (let row = 1; row <= headerRow; row++) {
    for (let column = 1; column <= sheet.columnCount; column++) {
      const cell = sheet.getCell(row, column);
      const text = textValue(cell).toLowerCase();
      if (text.includes("hrs to be invoiced"))
        values.set("awaiting", fillKey(cell.fill));
      else if (text.includes("invoices sent"))
        values.set("invoiced", fillKey(cell.fill));
      else if (text.includes("need to be carried"))
        values.set("carry", fillKey(cell.fill));
      else if (text.includes("carried but have now been invoiced"))
        values.set("closed", fillKey(cell.fill));
    }
  }
  return values;
}

function columnName(column: number) {
  let value = column;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function parseSheet(
  sheet: Worksheet,
  month: string,
  financialYear: string,
  source: { id: string; name: string },
  warnings: string[],
  errors: string[],
) {
  const headerRow = findHeaderRow(sheet);
  if (!headerRow) {
    errors.push(
      `${sheet.name}: this month cannot be read because the Job Number and Job Name headings are missing. Choose a corrected workbook and try again.`,
    );
    return undefined;
  }
  let carryColumn = 0;
  let notesColumn = 0;
  for (let column = 1; column <= sheet.columnCount; column++) {
    const header = textValue(sheet.getCell(headerRow, column)).toLowerCase();
    if (header.includes("carry") || header.includes("carried"))
      carryColumn = column;
    if (header === "notes") notesColumn = column;
  }
  if (!carryColumn || !notesColumn || carryColumn <= 4) {
    errors.push(
      `${sheet.name}: the carried-hours or notes columns are missing. Choose a corrected workbook and try again.`,
    );
    return undefined;
  }
  const legends = legendFills(sheet, headerRow);
  if (legends.get("carry") !== `rgb:${CARRY_RGB}`)
    errors.push(
      `${sheet.name}: the green carried-hours key is missing or has changed. Restore green #${CARRY_RGB}, then replace the workbook.`,
    );
  const knownStatusFills = new Set(["none", ...legends.values()]);
  const carryCandidates: WorkbookCarryCandidate[] = [];
  const warnedFills = new Set<string>();
  for (let row = headerRow + 2; row <= sheet.rowCount; row++) {
    const projectCode = extractProjectCode(sheet.getCell(row, 2).value);
    const projectDescription = textValue(sheet.getCell(row, 3)) || undefined;
    for (let column = 4; column < carryColumn; column++) {
      const cell = sheet.getCell(row, column);
      const hours = numericValue(cell);
      if (hours === undefined || hours <= 0) continue;
      const statusFill = fillKey(cell.fill);
      if (!knownStatusFills.has(statusFill) && !warnedFills.has(statusFill)) {
        warnings.push(
          `${sheet.name}: some hours use an unfamiliar colour. Open the original workbook, correct the colour, then replace it here.`,
        );
        warnedFills.add(statusFill);
      }
      if (statusFill !== `rgb:${CARRY_RGB}`) continue;
      const employeeAbbreviation = textValue(sheet.getCell(headerRow, column));
      const sourceCell = `${columnName(column)}${row}`;
      if (!employeeAbbreviation) {
        errors.push(
          `${sheet.name} ${sourceCell}: these carried hours have no employee heading. Add the heading, then replace the workbook.`,
        );
        continue;
      }
      if (!projectCode) {
        errors.push(
          `${sheet.name} ${sourceCell}: these carried hours have no project number. Add or correct the project number, then replace the workbook.`,
        );
      }
      carryCandidates.push({
        projectCode,
        projectDescription,
        employeeAbbreviation,
        hours,
        originatingMonth: month,
        originatingYear: Number(month.slice(0, 4)),
        sourceWorkbook: source.name,
        sourceWorkbookId: source.id,
        sourceWorksheet: sheet.name,
        sourceRow: row,
        sourceColumn: column,
        sourceCell,
        status: "carry",
        fill: "#92D050",
      });
    }
  }
  return {
    worksheet: {
      name: sheet.name,
      month,
      financialYear,
      headerRow,
      employeeColumns: carryColumn - 4,
    },
    carryCandidates,
  };
}

export async function inspectLatestMonthlyWorkbook(
  data: ArrayBuffer,
  sourceOptions: WorkbookInspectionSource = {},
): Promise<LatestMonthlyWorkbookInspection> {
  const module = await import("exceljs");
  const ExcelJS = module.default;
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(new Uint8Array(data) as never);
  } catch {
    throw new Error(
      "This is not a readable Excel workbook. Choose an .xlsx file.",
    );
  }
  const monthlySheets = workbook.worksheets.flatMap((sheet) => {
    const month = monthFromSheetName(sheet.name);
    return month ? [{ sheet, month }] : [];
  });
  if (!monthlySheets.length)
    throw new Error(
      "No monthly worksheets were found. Choose the colour-updated hours workbook.",
    );
  const financialYears = new Map(
    monthlySheets.map(({ month }) => {
      const year = financialYearForMonth(month);
      return [year.label, year.startYear] as const;
    }),
  );
  if (financialYears.size !== 1)
    throw new Error(
      "Monthly worksheets span more than one April-to-March financial year. Choose one financial-year workbook.",
    );
  const [financialYear, financialYearStart] = [...financialYears.entries()][0];
  const savedAt = sourceOptions.savedAt ?? new Date().toISOString();
  const source = {
    id: sourceOptions.id ?? `financial-year:${financialYear}:${savedAt}`,
    name: sourceOptions.name ?? "Selected hours workbook",
    financialYear,
    savedAt,
    role: sourceOptions.role ?? "current",
  } as const;
  const warnings: string[] = [];
  const errors: string[] = [];
  const parsed = monthlySheets.flatMap(({ sheet, month }) => {
    const value = parseSheet(
      sheet,
      month,
      financialYear,
      source,
      warnings,
      errors,
    );
    return value ? [value] : [];
  });
  if (!parsed.length)
    throw new Error(
      errors.join(" ") || "The monthly worksheets cannot be read.",
    );
  const duplicateMonths = parsed
    .map((item) => item.worksheet.month)
    .filter((month, index, values) => values.indexOf(month) !== index);
  for (const month of new Set(duplicateMonths))
    errors.push(
      `There is more than one worksheet for ${month}. Keep one, then replace the workbook.`,
    );
  parsed.sort((a, b) => a.worksheet.month.localeCompare(b.worksheet.month));
  return {
    financialYear,
    financialYearStart,
    updatedThrough: parsed.at(-1)!.worksheet.month,
    source,
    worksheets: parsed.map((item) => item.worksheet),
    carryCandidates: parsed.flatMap((item) => item.carryCandidates),
    warnings,
    errors,
  };
}

function normaliseAbbreviation(value: string) {
  return normaliseHistoricalAbbreviation(value);
}

function sourcePriority(inspection: LatestMonthlyWorkbookInspection) {
  return `${inspection.source.savedAt}|${inspection.source.role === "current" ? "1" : "0"}|${inspection.source.id}`;
}

export function authoritativeCarryCandidates(
  inspections: LatestMonthlyWorkbookInspection[],
) {
  const sourceByMonth = new Map<string, LatestMonthlyWorkbookInspection>();
  for (const inspection of inspections)
    for (const worksheet of inspection.worksheets) {
      const existing = sourceByMonth.get(worksheet.month);
      if (!existing || sourcePriority(inspection) > sourcePriority(existing))
        sourceByMonth.set(worksheet.month, inspection);
    }
  const seen = new Set<string>();
  return inspections
    .flatMap((inspection) => inspection.carryCandidates)
    .filter(
      (candidate) =>
        sourceByMonth.get(candidate.originatingMonth)?.source.id ===
        candidate.sourceWorkbookId,
    )
    .filter((candidate) => {
      const key = [
        candidate.originatingMonth,
        candidate.projectCode ?? "",
        normaliseAbbreviation(candidate.employeeAbbreviation),
        candidate.hours,
        candidate.projectDescription?.trim().toLowerCase() ?? "",
        candidate.sourceRow,
        candidate.sourceColumn,
      ].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function resolveHistoricalCarry(
  inspection:
    | LatestMonthlyWorkbookInspection
    | LatestMonthlyWorkbookInspection[]
    | undefined,
  register: EmployeeRegister,
  reportingMonth: string,
  reviewState: HistoricalReviewState = emptyHistoricalReviewState(),
): HistoricalCarryResolution {
  if (!inspection) return { records: [], warnings: [], errors: [], issues: [] };
  const inspections = Array.isArray(inspection) ? inspection : [inspection];
  const warnings: string[] = [];
  const errors: string[] = [];
  const issues: HistoricalReviewIssue[] = [];
  const records: HistoricalCarryRecord[] = [];
  const currentEmployees = latestEmployeeSnapshot(register, true);
  const sourceById = new Map(
    inspections.map((item) => [item.source.id, item] as const),
  );
  const candidateEvidence = new Set<string>();
  for (const candidate of authoritativeCarryCandidates(inspections)) {
    if (candidate.originatingMonth >= reportingMonth) continue;
    const source = sourceById.get(candidate.sourceWorkbookId);
    const sourceRole = source?.source.role ?? "historical";
    const candidateKey = historicalCandidateKey(candidate);
    const issueResolution = reviewState.issueResolutions[candidateKey];
    let projectCode = candidate.projectCode;
    let projectDescription = candidate.projectDescription;
    if (!projectCode && issueResolution?.kind === "project") {
      projectCode = issueResolution.projectCode;
      projectDescription = issueResolution.projectDescription;
    }
    const keepAsUnknownCarry =
      issueResolution?.kind === "unknown-project-carry";
    if (!projectCode && !keepAsUnknownCarry) {
      const evidence = `${candidate.sourceWorksheet} ${candidate.sourceCell}: these carried hours have no project number. Add or correct the project number, then replace the workbook.`;
      candidateEvidence.add(evidence);
      if (
        sourceRole === "historical" &&
        (issueResolution?.kind === "already-dealt-with" ||
          issueResolution?.kind === "exclude")
      )
        continue;
      errors.push(evidence);
      issues.push({
        key: candidateKey,
        kind: "project",
        sourceRole,
        title: "Choose what should happen to these carried hours",
        summary:
          sourceRole === "historical"
            ? "This older carried-hours entry does not have a project number. Choose what should happen to it."
            : `${candidate.hours.toFixed(2)} hours for ${candidate.employeeAbbreviation} need a project before they can be carried forward.`,
        technicalEvidence: evidence,
        candidate,
      });
      continue;
    }
    const target = normaliseAbbreviation(candidate.employeeAbbreviation);
    const mappedEmployeeId = reviewState.employeeMappings[target];
    const formerAbbreviation = mappedEmployeeId
      ? formerEmployeeAbbreviation(mappedEmployeeId)
      : undefined;
    if (formerAbbreviation) {
      records.push({
        ...candidate,
        projectCode,
        projectDescription,
        employeeId: mappedEmployeeId!,
        employee: `Former employee (${formerAbbreviation})`,
      });
      continue;
    }
    const matchingIds = new Set(
      register.employees
        .filter((employee) =>
          employee.assignments.some(
            (assignment) =>
              normaliseAbbreviation(assignment.abbreviation) === target,
          ),
        )
        .map((employee) => employee.id),
    );
    const matches = mappedEmployeeId
      ? currentEmployees.filter((employee) => employee.id === mappedEmployeeId)
      : currentEmployees.filter((employee) => matchingIds.has(employee.id));
    if (matches.length !== 1) {
      const evidence = `${candidate.sourceWorksheet} ${candidate.sourceCell}: employee heading ${candidate.employeeAbbreviation} cannot be matched to one current Employee Register entry. Assign the employee, then save and continue.`;
      const key = historicalEmployeeKey(candidate.employeeAbbreviation);
      errors.push(evidence);
      if (!issues.some((item) => item.key === key))
        issues.push({
          key,
          kind: "employee",
          sourceRole,
          title: `Identify ${candidate.employeeAbbreviation}`,
          summary: `${candidate.employeeAbbreviation} appears in an older hours workbook and needs matching to an employee.`,
          technicalEvidence: evidence,
          employeeAbbreviation: candidate.employeeAbbreviation,
          candidate,
        });
      continue;
    }
    const employee = matches[0];
    records.push({
      ...candidate,
      projectCode,
      projectDescription,
      employeeId: employee.id,
      employee: employee.fullName,
      department: employee.department,
    });
  }
  for (const item of inspections) {
    for (const warning of new Set(item.warnings)) {
      const key = historicalSourceIssueKey(
        item.financialYear,
        item.source.role,
        "warning",
        warning,
      );
      warnings.push(warning);
      issues.push({
        key,
        kind: "workbook-warning",
        sourceRole: item.source.role,
        title: "Review an older workbook entry",
        summary:
          "Some saved hours use a colour NEXUS does not recognise. Check the original workbook before carrying them forward.",
        technicalEvidence: warning,
      });
    }
    for (const error of new Set(item.errors)) {
      if (candidateEvidence.has(error)) continue;
      const key = historicalSourceIssueKey(
        item.financialYear,
        item.source.role,
        "error",
        error,
      );
      errors.push(error);
      issues.push({
        key,
        kind: "workbook-error",
        sourceRole: item.source.role,
        title: "Check an older workbook entry",
        summary:
          "NEXUS found an older workbook entry that needs checking before it can take part in carry-over.",
        technicalEvidence: error,
      });
    }
  }
  records.sort(
    (a, b) =>
      a.originatingMonth.localeCompare(b.originatingMonth) ||
      Number(a.projectCode ?? Number.MAX_SAFE_INTEGER) -
        Number(b.projectCode ?? Number.MAX_SAFE_INTEGER) ||
      a.employee.localeCompare(b.employee) ||
      a.sourceRow - b.sourceRow ||
      a.sourceColumn - b.sourceColumn,
  );
  return {
    records,
    warnings: [...new Set(warnings)],
    errors: [...new Set(errors)],
    issues,
  };
}
