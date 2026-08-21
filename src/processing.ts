import JSZip from "jszip";
import * as XLSX from "xlsx";
import {
  INTERNAL_CATEGORY_NAMES,
  INTERNAL_CODE_MINIMUM,
  UNKNOWN_PROJECT_CODE,
} from "./config";
import type {
  Classification,
  ProcessingResult,
  PublicDataset,
  SourceTrace,
  TimeEntry,
} from "./domain";

type RawRow = Record<string, unknown>;
const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export function extractProjectCode(value: unknown): string | undefined {
  const match = String(value ?? "")
    .trim()
    .match(/\b(\d{3,})\b/);
  return match?.[1];
}

export function classify(
  code: string | undefined,
  description: string,
  category = "",
): Classification {
  const normalized = (category || description).trim().toLowerCase();
  if (code === UNKNOWN_PROJECT_CODE || normalized === "unknown project")
    return "exception";
  if (
    INTERNAL_CATEGORY_NAMES.has(normalized) ||
    (code && Number(code) >= INTERNAL_CODE_MINIMUM)
  )
    return "internal";
  if (code && Number(code) < INTERNAL_CODE_MINIMUM) return "project";
  return "exception";
}

function text(row: RawRow, ...keys: string[]): string {
  for (const key of keys)
    if (row[key] !== undefined) return String(row[key]).trim();
  return "";
}

function number(row: RawRow, ...keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== "") return Number(value);
  }
  return 0;
}

function employeeFromFilename(file: string): string | undefined {
  const base = file
    .split(/[\\/]/)
    .at(-1)
    ?.replace(/\.(xlsx|xlsm)$/i, "");
  const normalizedBase = base?.replace(/[-_]+/g, " ");
  if (!normalizedBase || !/\b(time\s*sheet)\b/i.test(normalizedBase))
    return undefined;
  const employee = normalizedBase
    .replace(/\b(time\s*sheet)\b/gi, "")
    .replace(/\b(?:19|20)?\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return employee || undefined;
}

function findEasMonthSheet(
  workbook: XLSX.WorkBook,
  requestedMonth: string,
): string | undefined {
  const [yearText, monthText] = requestedMonth.split("-");
  const month = Number(monthText);
  const year = Number(yearText);
  const namePattern = new RegExp(
    `\\b${MONTH_NAMES[month - 1].slice(0, 3)}[a-z]*\\b.*\\b(${year}|${String(year).slice(2)})\\b|\\b(${year}|${String(year).slice(2)})\\b.*\\b${MONTH_NAMES[month - 1].slice(0, 3)}[a-z]*\\b`,
    "i",
  );
  const byName = workbook.SheetNames.find((name) => namePattern.test(name));
  if (byName) return byName;
  return workbook.SheetNames.slice(1).find((name) => {
    const cell = workbook.Sheets[name]?.E2;
    if (!cell) return false;
    const date =
      cell.v instanceof Date
        ? cell.v
        : typeof cell.v === "number"
          ? XLSX.SSF.parse_date_code(cell.v)
          : undefined;
    return !!date && date.y === year && date.m === month;
  });
}

function parseEasMonthSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  file: string,
  requestedMonth: string,
) {
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const cellValue = (row: number, column: number) =>
    sheet[XLSX.utils.encode_cell({ r: row, c: column })]?.v;
  const employeeCell = cellValue(0, 2);
  const employee =
    employeeFromFilename(file) ??
    (typeof employeeCell === "string" && employeeCell.trim()
      ? employeeCell.trim()
      : undefined);
  const entries: TimeEntry[] = [];
  const warnings: string[] = [];
  for (let row = 4; row <= range.e.r; row++) {
    const rawCode = cellValue(row, 0);
    const code = extractProjectCode(rawCode);
    const rawDescription = cellValue(row, 1);
    const unknownDescription = cellValue(row, 2);
    const descriptionFromCode =
      typeof rawDescription === "string" ? rawDescription.trim() : "";
    const unknownText =
      typeof unknownDescription === "string" ? unknownDescription.trim() : "";
    const codeCellText =
      !code && typeof rawCode === "string" ? rawCode.trim() : "";
    const description =
      !code || code === UNKNOWN_PROJECT_CODE
        ? unknownText || descriptionFromCode || codeCellText
        : descriptionFromCode;
    const totalValue = cellValue(row, 3);
    const dailyHours: Record<string, number> = {};
    let dailyTotal = 0;
    for (let column = 4; column <= range.e.c; column++) {
      const value = cellValue(row, column);
      if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
        dailyHours[String(column - 3)] = value;
        dailyTotal += value;
      }
    }
    const hasNumericColumnD =
      typeof totalValue === "number" && Number.isFinite(totalValue);
    const hours = hasNumericColumnD ? totalValue : dailyTotal;
    if (!code && !description && hours === 0) continue;
    if (!Number.isFinite(hours) || hours < 0) {
      warnings.push(`${file} row ${row + 1}: invalid hours`);
      continue;
    }
    const differs = Math.abs(hours - dailyTotal) > 0.01 && dailyTotal !== 0;
    if (differs)
      warnings.push(
        `${file} row ${row + 1}: column-D total differs from daily hours; column D retained for audit-consistent processing`,
      );
    if (hours === 0 && dailyTotal === 0) continue;
    const trace: SourceTrace = { file, worksheet: sheetName, row: row + 1 };
    const surroundingRows = [];
    for (
      let nearby = Math.max(4, row - 2);
      nearby <= Math.min(range.e.r, row + 2);
      nearby++
    ) {
      const nearbyCode = extractProjectCode(cellValue(nearby, 0));
      const nearbyDescription = [cellValue(nearby, 1), cellValue(nearby, 2)]
        .filter((value) => typeof value === "string" && value.trim())
        .join(" — ");
      const nearbyHours = cellValue(nearby, 3);
      surroundingRows.push({
        row: nearby + 1,
        projectNumber: nearbyCode,
        description: nearbyDescription || undefined,
        hours:
          typeof nearbyHours === "number" && Number.isFinite(nearbyHours)
            ? nearbyHours
            : undefined,
      });
    }
    entries.push({
      employee: employee ?? "Unidentified employee",
      reportingMonth: requestedMonth,
      projectCode: code,
      description: description || "Uncoded entry",
      internalCategory:
        code && Number(code) >= INTERNAL_CODE_MINIMUM
          ? description || "Configured internal category"
          : undefined,
      hours,
      dailyHours,
      hoursAudit: {
        columnD: hasNumericColumnD ? totalValue : undefined,
        dailyTotal,
        authority: hasNumericColumnD ? "column-d" : "daily-sum",
        differs,
      },
      classification: classify(code, description),
      trace,
      sourceContext: {
        employee: employee ?? "Unidentified employee",
        month: requestedMonth,
        recordedHours: hours,
        originalProjectNumber: code,
        originalDescription: description || "Uncoded entry",
        dailyHours: Object.entries(dailyHours).map(([day, value]) => ({
          day,
          hours: value,
        })),
        adjacentValues: [descriptionFromCode, unknownText, codeCellText].filter(
          Boolean,
        ),
        surroundingRows,
      },
    });
  }
  return { entries, employee, warnings };
}

export function parseWorkbook(
  data: ArrayBuffer,
  file: string,
  requestedMonth: string,
): { entries: TimeEntry[]; employee?: string; warnings: string[] } {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { type: "array", cellDates: true });
  } catch {
    throw new Error(`Unable to parse workbook: ${file}`);
  }
  const sheetName = workbook.SheetNames.find((name) =>
    name.toLowerCase().includes("timesheet"),
  );
  if (!sheetName) {
    const monthSheet = findEasMonthSheet(workbook, requestedMonth);
    if (!monthSheet)
      throw new Error(`Requested month worksheet not found: ${file}`);
    return parseEasMonthSheet(workbook, monthSheet, file, requestedMonth);
  }
  const rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], {
    defval: "",
  });
  const employee = text(rows[0] ?? {}, "Employee", "employee");
  const entries: TimeEntry[] = [];
  const warnings: string[] = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const month = text(row, "Month", "Reporting Month");
    const hours = number(row, "Hours", "Total");
    const description = text(row, "Description", "Project", "Activity");
    if (month && month !== requestedMonth) continue;
    if (!description && hours === 0) continue;
    if (!Number.isFinite(hours) || hours < 0) {
      warnings.push(`${file} row ${index + 2}: invalid hours`);
      continue;
    }
    if (hours === 0) continue;
    const code = extractProjectCode(text(row, "Project Code", "Code"));
    const category = text(row, "Category", "Internal Category");
    const trace: SourceTrace = { file, worksheet: sheetName, row: index + 2 };
    entries.push({
      employee: employee || text(row, "Employee") || "Unidentified employee",
      reportingMonth: requestedMonth,
      projectCode: code,
      description: description || category || "Unspecified entry",
      internalCategory: category || undefined,
      hours,
      hoursAudit: {
        columnD: hours,
        dailyTotal: hours,
        authority: "tabular-total",
        differs: false,
      },
      classification: classify(code, description, category),
      trace,
      sourceContext: {
        employee: employee || text(row, "Employee") || "Unidentified employee",
        month: requestedMonth,
        recordedHours: hours,
        originalProjectNumber: code,
        originalDescription: description || category || "Unspecified entry",
        dailyHours: [],
        adjacentValues: [category].filter(Boolean),
        surroundingRows: [
          {
            row: index + 2,
            projectNumber: code,
            description: description || category || undefined,
            hours,
          },
        ],
      },
    });
  }
  if (
    !rows.some(
      (row) => text(row, "Month", "Reporting Month") === requestedMonth,
    )
  )
    warnings.push(`${file}: requested month not found`);
  return { entries, employee: employee || entries[0]?.employee, warnings };
}

export async function expandUploads(
  files: File[],
): Promise<{ name: string; data: ArrayBuffer }[]> {
  const readFile = (file: File): Promise<ArrayBuffer> => {
    if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () =>
        reject(new Error(`Unable to read file: ${file.name}`));
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(file);
    });
  };
  const expanded: { name: string; data: ArrayBuffer }[] = [];
  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(await readFile(file));
      for (const [name, entry] of Object.entries(zip.files))
        if (!entry.dir && /\.(xlsx|xlsm)$/i.test(name))
          expanded.push({ name, data: await entry.async("arraybuffer") });
    } else if (/\.(xlsx|xlsm)$/i.test(file.name))
      expanded.push({ name: file.name, data: await readFile(file) });
  }
  return expanded;
}

export async function processUploads(
  files: File[],
  month: string,
  expected: string[] = [],
): Promise<ProcessingResult> {
  const expanded = await expandUploads(files);
  const names = new Set<string>();
  const duplicateFiles: string[] = [];
  const entries: TimeEntry[] = [];
  const warnings: string[] = [];
  const fatalErrors: string[] = [];
  const found = new Set<string>();
  const blankTimesheets: string[] = [];
  for (const input of expanded) {
    const key = input.name.toLowerCase();
    if (names.has(key)) {
      duplicateFiles.push(input.name);
      warnings.push(`Duplicate source ignored: ${input.name}`);
      continue;
    }
    names.add(key);
    try {
      const result = parseWorkbook(input.data, input.name, month);
      warnings.push(...result.warnings);
      if (result.employee) found.add(result.employee);
      if (result.employee && result.entries.length === 0)
        blankTimesheets.push(result.employee);
      entries.push(...result.entries);
    } catch (error) {
      fatalErrors.push(
        error instanceof Error
          ? error.message
          : `Failed to parse ${input.name}`,
      );
    }
  }
  const missingEmployees = expected.filter((employee) => !found.has(employee));
  warnings.push(
    ...missingEmployees.map((employee) => `Missing timesheet: ${employee}`),
    ...blankTimesheets.map((employee) => `Blank timesheet: ${employee}`),
  );
  return {
    entries,
    filesSupplied: expanded.length,
    employees: [...found],
    missingEmployees,
    blankTimesheets,
    warnings,
    fatalErrors,
    duplicateFiles,
    sourceFiles: expanded,
  };
}

export function reconcile(entries: TimeEntry[]) {
  const sum = (kind?: Classification) =>
    entries
      .filter((entry) => !kind || entry.classification === kind)
      .reduce((total, entry) => total + entry.hours, 0);
  const project = sum("project"),
    internal = sum("internal"),
    timeInLieu = sum("time-in-lieu"),
    unknown = sum("unknown"),
    excluded = sum("excluded"),
    exception = sum("exception"),
    total = sum();
  return {
    project,
    internal,
    unknown,
    excluded,
    exception,
    total,
    reconciles:
      Math.abs(
        total -
          project -
          internal -
          timeInLieu -
          unknown -
          excluded -
          exception,
      ) < 1e-9,
    timeInLieu,
  };
}

export function toPublicDataset(
  entries: TimeEntry[],
  month: string,
): PublicDataset {
  const projects = new Map<string, PublicDataset["projects"][number]>();
  for (const entry of entries.filter(
    (item) => item.classification === "project",
  )) {
    const key = entry.projectCode ?? `uncoded:${entry.description}`;
    const project = projects.get(key) ?? {
      code: entry.projectCode,
      description: entry.description,
      contributors: [],
      total: 0,
    };
    const contributor = project.contributors.find(
      (item) => item.employee === entry.employee,
    );
    if (contributor) contributor.hours += entry.hours;
    else
      project.contributors.push({
        employee: entry.employee,
        hours: entry.hours,
      });
    project.total += entry.hours;
    projects.set(key, project);
  }
  return {
    month,
    projects: [...projects.values()].sort((a, b) =>
      a.code && b.code
        ? Number(a.code) - Number(b.code)
        : a.code
          ? -1
          : b.code
            ? 1
            : a.description.localeCompare(b.description),
    ),
    statuses: entries
      .filter(
        (entry) =>
          entry.classification === "unknown" ||
          entry.classification === "excluded",
      )
      .map((entry) => ({
        employee: entry.employee,
        kind:
          entry.classification === "unknown"
            ? ("unknown-project" as const)
            : ("excluded" as const),
        hours: entry.hours,
      })),
  };
}
