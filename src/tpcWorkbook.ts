import type { Cell, Worksheet } from "exceljs";
import type {
  FinancialYearWorkbookRole,
  ProjectCatalogueItem,
  ResolvedTpcRecord,
  TpcMoneyValue,
  TpcRecord,
  TpcResolution,
  TpcReviewState,
  TpcWorkbookInspection,
} from "./domain";
import { financialYearForMonth } from "./financialYear";
import { monthFromSheetName } from "./monthlyWorkbook";

const REQUIRED_HEADERS = [
  "date",
  "company name",
  "project no",
  "what it was for",
  "net amount",
  "vat",
  "gross amount",
] as const;
const CURRENCY_TOLERANCE = 0.02;

export interface TpcInspectionSource {
  id?: string;
  name?: string;
  savedAt?: string;
  role?: FinancialYearWorkbookRole;
}

function normaliseHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cellValue(cell: Cell): unknown {
  const value = cell.value;
  if (value && typeof value === "object") {
    if ("result" in value) return value.result;
    if ("text" in value) return value.text;
    if ("richText" in value)
      return value.richText.map((part) => part.text).join("");
  }
  return value;
}

function cellText(cell: Cell) {
  const value = cellValue(cell);
  return value === null || value === undefined ? "" : String(value).trim();
}

function isRed(cell: Cell) {
  const color = cell.font?.color;
  return color?.argb?.slice(-6).toUpperCase() === "FF0000";
}

function money(cell: Cell): TpcMoneyValue {
  const value = cellValue(cell);
  if (typeof value === "number" && Number.isFinite(value))
    return { kind: "amount", amount: value };
  const text =
    value === null || value === undefined ? "" : String(value).trim();
  if (!text) return { kind: "blank" };
  if (/^-?£?\d[\d,]*(?:\.\d+)?$/.test(text)) {
    const amount = Number(text.replace(/[£,]/g, ""));
    if (Number.isFinite(amount)) return { kind: "amount", amount };
  }
  return { kind: "text", text };
}

function dateValue(cell: Cell) {
  const value = cellValue(cell);
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  const uk = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(text);
  if (uk) {
    const year = Number(uk[3]) < 100 ? 2000 + Number(uk[3]) : Number(uk[3]);
    return `${year}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  }
  return undefined;
}

function validProjectCode(value: string) {
  const compact = value.replace(/\.0+$/, "").trim();
  return /^\d{3,}$/.test(compact) ? compact : undefined;
}

function findHeaders(sheet: Worksheet) {
  for (let row = 1; row <= Math.min(sheet.rowCount, 30); row++) {
    const headers = new Map<string, number>();
    for (let column = 1; column <= sheet.columnCount; column++) {
      const header = normaliseHeader(cellValue(sheet.getCell(row, column)));
      if (header) headers.set(header, column);
    }
    if (REQUIRED_HEADERS.every((header) => headers.has(header)))
      return { row, headers };
  }
  return undefined;
}

function fingerprint(parts: unknown[]) {
  return parts
    .map((part) =>
      String(part ?? "")
        .trim()
        .toLowerCase(),
    )
    .join("|");
}

export function tpcRecordKey(
  record: Pick<
    TpcRecord,
    | "originatingMonth"
    | "sourceWorksheet"
    | "sourceRow"
    | "originatingDate"
    | "supplier"
    | "projectNumberRaw"
    | "description"
    | "net"
    | "vat"
    | "gross"
  >,
) {
  return fingerprint([
    "tpc",
    record.originatingMonth,
    record.sourceWorksheet,
    record.sourceRow,
    record.originatingDate,
    record.supplier,
    record.projectNumberRaw,
    record.description,
    JSON.stringify(record.net),
    JSON.stringify(record.vat),
    JSON.stringify(record.gross),
  ]);
}

function parseSheet(
  sheet: Worksheet,
  month: string,
  financialYear: string,
  source: { id: string; name: string },
  warnings: string[],
  errors: string[],
) {
  const found = findHeaders(sheet);
  if (!found) {
    errors.push(
      `${sheet.name}: the TPC headings cannot be safely identified. Choose a corrected workbook.`,
    );
    return undefined;
  }
  const column = (name: string) => found.headers.get(name) ?? 0;
  const records: TpcRecord[] = [];
  for (let row = found.row + 1; row <= sheet.rowCount; row++) {
    const dateCell = sheet.getCell(row, column("date"));
    const supplier = cellText(sheet.getCell(row, column("company name")));
    const projectManager = cellText(
      sheet.getCell(row, column("project manager")),
    );
    const projectNumberRaw = cellText(sheet.getCell(row, column("project no")));
    const description = cellText(sheet.getCell(row, column("what it was for")));
    const net = money(sheet.getCell(row, column("net amount")));
    const vat = money(sheet.getCell(row, column("vat")));
    const gross = money(sheet.getCell(row, column("gross amount")));
    const notes = cellText(sheet.getCell(row, column("notes")));
    const date = dateValue(dateCell);
    const hasBusinessValue =
      !!date ||
      !!supplier ||
      !!projectNumberRaw ||
      !!description ||
      net.kind !== "blank" ||
      vat.kind !== "blank" ||
      gross.kind !== "blank";
    if (!hasBusinessValue) continue;
    const coreColumns = [
      "date",
      "company name",
      "project manager",
      "project no",
      "what it was for",
      "net amount",
      "vat",
      "gross amount",
    ];
    const redCoreCells = coreColumns.filter((name) =>
      isRed(sheet.getCell(row, column(name))),
    ).length;
    const outstanding = isRed(dateCell) || (!date && redCoreCells >= 3);
    const monetaryWarning =
      net.kind === "amount" &&
      vat.kind === "amount" &&
      gross.kind === "amount" &&
      Math.abs(net.amount + vat.amount - gross.amount) > CURRENCY_TOLERANCE
        ? "This cost's Net + VAT doesn't match the Gross amount. Check the original TPC entry if needed."
        : undefined;
    const base = {
      originatingDate: date,
      originatingMonth: month,
      originatingYear: Number(month.slice(0, 4)),
      supplier: supplier || "Supplier not recorded",
      projectManager: projectManager || undefined,
      projectNumberRaw: projectNumberRaw || undefined,
      projectCode: validProjectCode(projectNumberRaw),
      description: description || "Description not recorded",
      net,
      vat,
      gross,
      notes: notes || undefined,
      sourceFinancialYear: financialYear,
      sourceWorkbook: source.name,
      sourceWorkbookId: source.id,
      sourceWorksheet: sheet.name,
      sourceRow: row,
      status: outstanding ? ("outstanding" as const) : ("invoiced" as const),
      statusEvidence: outstanding
        ? ("red-row" as const)
        : ("black-row" as const),
      monetaryWarning,
    };
    const record: TpcRecord = { ...base, key: "" };
    record.key = tpcRecordKey(record);
    records.push(record);
    if (monetaryWarning)
      warnings.push(`${sheet.name} row ${row}: ${monetaryWarning}`);
  }
  return {
    worksheet: {
      name: sheet.name,
      month,
      financialYear,
      headerRow: found.row,
    },
    records,
  };
}

export async function inspectTpcWorkbook(
  data: ArrayBuffer,
  sourceOptions: TpcInspectionSource = {},
): Promise<TpcWorkbookInspection> {
  const module = await import("exceljs");
  const ExcelJS = module.default;
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(new Uint8Array(data) as never);
  } catch {
    throw new Error(
      "This is not a readable TPC workbook. Choose an .xlsx file.",
    );
  }
  const monthly = workbook.worksheets.flatMap((sheet) => {
    const month = monthFromSheetName(sheet.name);
    return month ? [{ sheet, month }] : [];
  });
  if (!monthly.length)
    throw new Error("No monthly TPC worksheets were found in this workbook.");
  const financialYears = new Set(
    monthly.map(({ month }) => financialYearForMonth(month).label),
  );
  if (financialYears.size !== 1)
    throw new Error(
      "The TPC worksheets span more than one April-to-March financial year.",
    );
  const financialYear = [...financialYears][0];
  const financialYearStart = financialYearForMonth(monthly[0].month).startYear;
  const savedAt = sourceOptions.savedAt ?? new Date().toISOString();
  const source = {
    id: sourceOptions.id ?? `tpc:${financialYear}:${savedAt}`,
    name: sourceOptions.name ?? "Selected TPC workbook",
    financialYear,
    savedAt,
    role: sourceOptions.role ?? "current",
  } as const;
  const warnings: string[] = [];
  const errors: string[] = [];
  const parsed = monthly.flatMap(({ sheet, month }) => {
    const result = parseSheet(
      sheet,
      month,
      financialYear,
      source,
      warnings,
      errors,
    );
    return result ? [result] : [];
  });
  if (!parsed.length || errors.length === monthly.length)
    throw new Error(
      errors.join(" ") || "The TPC workbook cannot be read safely.",
    );
  parsed.sort((a, b) => a.worksheet.month.localeCompare(b.worksheet.month));
  return {
    financialYear,
    financialYearStart,
    updatedThrough: parsed.at(-1)!.worksheet.month,
    source,
    worksheets: parsed.map((item) => item.worksheet),
    records: parsed.flatMap((item) => item.records),
    warnings,
    errors,
  };
}

export function resolveTpcRecords(
  inspections: TpcWorkbookInspection[],
  reviewState: TpcReviewState,
  catalogue: ProjectCatalogueItem[],
): TpcResolution {
  const authoritative = new Map<string, TpcWorkbookInspection>();
  for (const inspection of inspections) {
    const existing = authoritative.get(inspection.financialYear);
    if (!existing || inspection.source.savedAt > existing.source.savedAt)
      authoritative.set(inspection.financialYear, inspection);
  }
  const catalogueByCode = new Map(catalogue.map((item) => [item.code, item]));
  const records: ResolvedTpcRecord[] = [];
  const warningRecords: TpcRecord[] = [];
  const issues: TpcResolution["issues"] = [];
  const warnings: string[] = [];
  for (const inspection of authoritative.values()) {
    for (const source of inspection.records) {
      if (source.status !== "outstanding") continue;
      if (source.monetaryWarning) {
        warningRecords.push(source);
        warnings.push(
          `${source.sourceWorksheet} row ${source.sourceRow}: ${source.monetaryWarning}`,
        );
      }
      const decision = reviewState.decisions[source.key];
      const projectCode =
        decision?.kind === "project"
          ? decision.projectCode
          : source.projectCode;
      const project = projectCode
        ? catalogueByCode.get(projectCode)
        : undefined;
      const resolution =
        decision?.kind === "non-project"
          ? "non-project"
          : projectCode
            ? "project"
            : "unallocated";
      const record: ResolvedTpcRecord = {
        ...source,
        projectCode,
        projectDescription:
          decision?.kind === "project"
            ? decision.projectDescription
            : project?.description,
        resolution,
      };
      records.push(record);
      if (!source.projectCode && !decision)
        issues.push({ key: source.key, record });
    }
  }
  records.sort(
    (a, b) =>
      a.originatingMonth.localeCompare(b.originatingMonth) ||
      (a.originatingDate ?? "").localeCompare(b.originatingDate ?? "") ||
      a.sourceRow - b.sourceRow,
  );
  return {
    loaded: inspections.length > 0,
    records,
    warningRecords,
    allocated: records.filter((record) => record.resolution === "project"),
    unallocated: records.filter(
      (record) => record.resolution === "unallocated",
    ),
    nonProject: records.filter((record) => record.resolution === "non-project"),
    issues,
    warnings: [...new Set(warnings)],
  };
}
