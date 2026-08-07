import type { Fill, Style, Worksheet } from "exceljs";
import type {
  ConsolidationResult,
  EmployeeRegister,
  TimeEntry,
} from "./domain";
import { resolveEmployee } from "./employeeRegister";

const FALLBACK = {
  yellow: "FFFFFF00",
  orange: "FFFFC000",
  green: "FF92D050",
  grey: "FF95A6BD",
  navy: "FF174F43",
  lime: "FFBED747",
  line: "FF777777",
};

function clone<T>(value: T): T {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function asArrayBuffer(value: unknown): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  const bytes = value as Uint8Array;
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function monthSheetName(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${String(year).slice(2)}`;
}

function fileMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function columnLetter(column: number) {
  let result = "";
  for (let value = column; value > 0; value = Math.floor((value - 1) / 26))
    result = String.fromCharCode(((value - 1) % 26) + 65) + result;
  return result;
}

function solidFill(argb: string): Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

interface TemplateProfile {
  headerRow: number;
  firstDataRow: number;
  headerStyle: Partial<Style>;
  numberStyle: Partial<Style>;
  textStyle: Partial<Style>;
  legendFills: Fill[];
  widths: {
    job: number;
    name: number;
    employee: number;
    carry: number;
    notes: number;
  };
}

async function readTemplateProfile(
  template: ArrayBuffer,
  month: string,
): Promise<TemplateProfile> {
  const module = await import("exceljs");
  const ExcelJS = module.default;
  const workbook = new ExcelJS.Workbook();
  // ExcelJS's declared Buffer shape is narrower than the Uint8Array accepted
  // by its browser/JSZip runtime.
  await workbook.xlsx.load(new Uint8Array(template) as never);
  const requested = monthSheetName(month).toLowerCase();
  const sheet =
    workbook.worksheets.find(
      (item) => item.name.trim().toLowerCase() === requested,
    ) ?? workbook.worksheets.at(-1);
  if (!sheet) throw new Error("The supplied workbook contains no worksheet.");
  let headerRow = 0;
  sheet.eachRow((row, rowNumber) => {
    if (
      String(row.getCell(2).value ?? "")
        .trim()
        .toLowerCase()
        .startsWith("job number")
    )
      headerRow = rowNumber;
  });
  if (!headerRow)
    throw new Error(
      "The supplied workbook does not contain the expected Job Number / Job Name layout.",
    );
  const legendFills: Fill[] = [];
  const legendTerms = [
    "hrs to be invoiced",
    "invoices sent",
    "need to be carried",
    "carried but have now been invoiced",
  ];
  for (const term of legendTerms) {
    let found: Fill | undefined;
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        if (
          !found &&
          String(cell.value ?? "")
            .trim()
            .toLowerCase()
            .includes(term)
        )
          found = clone(cell.fill);
      }),
    );
    legendFills.push(found ?? solidFill(FALLBACK.yellow));
  }
  return {
    headerRow,
    firstDataRow: headerRow + 2,
    headerStyle: clone(sheet.getCell(headerRow, 2).style),
    numberStyle: clone(sheet.getCell(headerRow + 2, 4).style),
    textStyle: clone(sheet.getCell(headerRow + 2, 3).style),
    legendFills,
    widths: {
      job: sheet.getColumn(2).width ?? 12,
      name: sheet.getColumn(3).width ?? 54,
      employee: sheet.getColumn(4).width ?? 9,
      carry: sheet.getColumn(Math.max(4, sheet.columnCount - 1)).width ?? 24,
      notes: sheet.getColumn(sheet.columnCount).width ?? 28,
    },
  };
}

function applyBodyBorder(style: Partial<Style>) {
  return {
    ...clone(style),
    border: {
      top: { style: "thin", color: { argb: FALLBACK.line } },
      bottom: { style: "thin", color: { argb: FALLBACK.line } },
      left: { style: "thin", color: { argb: FALLBACK.line } },
      right: { style: "thin", color: { argb: FALLBACK.line } },
    },
  } as Partial<Style>;
}

function applyProjectLayout(
  sheet: Worksheet,
  result: ConsolidationResult,
  profile: TemplateProfile,
  buildId: string,
) {
  const firstEmployeeColumn = 4;
  const carryColumn = firstEmployeeColumn + result.employees.length;
  const notesColumn = carryColumn + 1;
  const { headerRow, firstDataRow } = profile;
  const lastColumn = notesColumn;
  sheet.views = [
    {
      state: "frozen",
      xSplit: 3,
      ySplit: firstDataRow - 1,
      topLeftCell: `D${firstDataRow}`,
    },
  ];
  sheet.properties.defaultRowHeight = 18;
  sheet.getColumn(1).width = 3;
  sheet.getColumn(2).width = profile.widths.job;
  sheet.getColumn(3).width = profile.widths.name;
  for (let column = firstEmployeeColumn; column < carryColumn; column++)
    sheet.getColumn(column).width = profile.widths.employee;
  sheet.getColumn(carryColumn).width = profile.widths.carry;
  sheet.getColumn(notesColumn).width = profile.widths.notes;

  const legend = [
    "HRS to be invoiced highlighted in yellow hatch",
    "Invoices sent",
    "These hours need to be carried over for invoicing",
    "These hours were carried but have now been invoiced",
  ];
  for (let index = 0; index < legend.length; index++) {
    const row = 3 + index;
    sheet.mergeCells(row, 3, row, Math.min(10, lastColumn));
    const cell = sheet.getCell(row, 3);
    cell.value = legend[index];
    cell.fill = clone(profile.legendFills[index]);
    cell.font = { name: "Arial", size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  sheet.getCell(2, 3).value =
    `Generated ${fileMonth(result.month)} current-month matrix - ${buildId}`;
  sheet.getCell(2, 3).font = { name: "Arial", size: 10, italic: true };
  sheet.getCell(7, 3).value =
    "Commercial status, invoice, carry and historic lifecycle decisions remain manual.";
  sheet.getCell(7, 3).font = { name: "Arial", size: 10, italic: true };

  const headers = [
    "Job Number",
    "Job Name",
    ...result.employees.map((employee) => employee.abbreviation),
    "Hours to be carried from previous months",
    "Notes",
  ];
  for (let index = 0; index < headers.length; index++) {
    const cell = sheet.getCell(headerRow, index + 2);
    cell.value = headers[index];
    cell.style = clone(profile.headerStyle);
    cell.font = { ...cell.font, bold: true };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
  }
  sheet.getRow(headerRow).height = 44;

  result.projects.forEach((project, index) => {
    const rowNumber = firstDataRow + index;
    const row = sheet.getRow(rowNumber);
    row.height = 19;
    const jobCell = row.getCell(2);
    jobCell.value = project.code ? Number(project.code) : "Uncoded";
    jobCell.style = applyBodyBorder(profile.textStyle);
    jobCell.alignment = { horizontal: "center", vertical: "middle" };
    const nameCell = row.getCell(3);
    nameCell.value = project.description;
    nameCell.style = applyBodyBorder(profile.textStyle);
    nameCell.alignment = { horizontal: "left", vertical: "middle" };
    result.employees.forEach((employee, employeeIndex) => {
      const cell = row.getCell(firstEmployeeColumn + employeeIndex);
      const hours = project.hoursByEmployee[employee.id];
      cell.value = hours || null;
      cell.style = applyBodyBorder(profile.numberStyle);
      cell.numFmt = "0.00";
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    const carry = row.getCell(carryColumn);
    carry.value = null;
    carry.style = applyBodyBorder(profile.textStyle);
    const notes = row.getCell(notesColumn);
    notes.value = project.approvedUncoded
      ? "Approved uncoded project - reviewed for this run"
      : null;
    notes.style = applyBodyBorder(profile.textStyle);
    if (project.approvedUncoded)
      for (let column = 2; column <= notesColumn; column++)
        row.getCell(column).fill = solidFill("FFFFF2CC");
  });
  sheet.autoFilter = {
    from: { row: headerRow, column: 2 },
    to: { row: headerRow, column: lastColumn },
  };
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };
}

export async function generateProjectWorkbook(
  result: ConsolidationResult,
  template: ArrayBuffer,
  buildId: string,
): Promise<ArrayBuffer> {
  if (!result.canExport)
    throw new Error(
      `Project workbook is blocked: ${result.blockers.join(" ")}`,
    );
  const module = await import("exceljs");
  const ExcelJS = module.default;
  const profile = await readTemplateProfile(template, result.month);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EAS Admin Toolkit - Created by Joe Freeman";
  workbook.created = new Date();
  workbook.modified = new Date();
  const sheet = workbook.addWorksheet(monthSheetName(result.month), {
    properties: { tabColor: { argb: FALLBACK.navy } },
  });
  applyProjectLayout(sheet, result, profile, buildId);
  const buffer = await workbook.xlsx.writeBuffer();
  return asArrayBuffer(buffer);
}

function styleHeader(row: import("exceljs").Row, from: number, to: number) {
  for (let column = from; column <= to; column++) {
    const cell = row.getCell(column);
    cell.fill = solidFill(FALLBACK.navy);
    cell.font = {
      name: "Aptos",
      size: 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: FALLBACK.line } },
      bottom: { style: "thin", color: { argb: FALLBACK.line } },
      left: { style: "thin", color: { argb: FALLBACK.line } },
      right: { style: "thin", color: { argb: FALLBACK.line } },
    };
  }
}

export async function generateInternalWorkbook(
  result: ConsolidationResult,
  entries: TimeEntry[],
  register: EmployeeRegister,
  buildId: string,
): Promise<ArrayBuffer> {
  if (!result.canExport)
    throw new Error(
      `Internal workbook is blocked: ${result.blockers.join(" ")}`,
    );
  const module = await import("exceljs");
  const ExcelJS = module.default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EAS Admin Toolkit - Created by Joe Freeman";
  workbook.created = new Date();
  workbook.modified = new Date();
  const sheet = workbook.addWorksheet("Internal Hours", {
    properties: { tabColor: { argb: "FFC68000" } },
  });
  const firstEmployeeColumn = 3;
  const totalColumn = firstEmployeeColumn + result.employees.length;
  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 6, topLeftCell: "C7" }];
  sheet.mergeCells(1, 1, 1, totalColumn);
  sheet.getCell(1, 1).value = `EAS Internal Hours - ${fileMonth(result.month)}`;
  sheet.getCell(1, 1).font = {
    name: "Aptos Display",
    size: 18,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getCell(1, 1).fill = solidFill(FALLBACK.navy);
  sheet.getCell(1, 1).alignment = { horizontal: "left", vertical: "middle" };
  sheet.getRow(1).height = 32;
  sheet.mergeCells(2, 1, 2, totalColumn);
  sheet.getCell(2, 1).value =
    "CONFIDENTIAL / INTERNAL - Office Manager and Director administrative use only";
  sheet.getCell(2, 1).font = { bold: true, color: { argb: "FF8B1E2D" } };
  sheet.getCell(3, 1).value = "Build";
  sheet.getCell(3, 2).value = buildId;
  sheet.getCell(4, 1).value = "Reconciliation";
  sheet.getCell(4, 2).value = result.reconciles ? "Passed" : "Failed";
  const headerRow = sheet.getRow(6);
  headerRow.values = [
    "Internal code / category",
    "Description",
    ...result.employees.map((employee) => employee.abbreviation),
    "Category total",
  ];
  headerRow.height = 36;
  styleHeader(headerRow, 1, totalColumn);
  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 34;
  for (let column = firstEmployeeColumn; column < totalColumn; column++)
    sheet.getColumn(column).width = 10;
  sheet.getColumn(totalColumn).width = 16;
  result.internal.forEach((item, index) => {
    const rowNumber = 7 + index;
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = item.code ? Number(item.code) : item.description;
    row.getCell(2).value = item.description;
    result.employees.forEach((employee, employeeIndex) => {
      const cell = row.getCell(firstEmployeeColumn + employeeIndex);
      cell.value = item.hoursByEmployee[employee.id] || null;
      cell.numFmt = "0.00";
      cell.alignment = { horizontal: "center" };
    });
    row.getCell(totalColumn).value = {
      formula: `SUM(${columnLetter(firstEmployeeColumn)}${rowNumber}:${columnLetter(totalColumn - 1)}${rowNumber})`,
      result: item.total,
    };
    row.getCell(totalColumn).numFmt = "0.00";
    for (let column = 1; column <= totalColumn; column++)
      row.getCell(column).border = {
        bottom: { style: "thin", color: { argb: "FFD5DDD9" } },
      };
  });
  const totalRowNumber = 7 + result.internal.length;
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.getCell(1).value = "Overall internal-hours total";
  totalRow.getCell(totalColumn).value = {
    formula: `SUM(${columnLetter(totalColumn)}7:${columnLetter(totalColumn)}${Math.max(7, totalRowNumber - 1)})`,
    result: result.internalHours,
  };
  totalRow.getCell(totalColumn).numFmt = "0.00";
  totalRow.font = { bold: true };
  totalRow.fill = solidFill("FFF4F8DF");
  sheet.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: 6, column: totalColumn },
  };

  const audit = workbook.addWorksheet("Audit Trace", {
    properties: { tabColor: { argb: FALLBACK.grey } },
  });
  const auditHeaders = [
    "Source file",
    "Worksheet",
    "Source row",
    "Employee",
    "Employee abbreviation",
    "Original code",
    "Description",
    "Column-D / source hours",
    "Daily-cell sum",
    "Variance",
    "Final classification",
    "Output destination",
  ];
  audit.getRow(1).values = auditHeaders;
  styleHeader(audit.getRow(1), 1, auditHeaders.length);
  audit.views = [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }];
  entries.forEach((entry, index) => {
    const employee = resolveEmployee(register, result.month, entry.employee);
    const destination =
      entry.classification === "internal"
        ? "Internal Hours workbook"
        : entry.classification === "project"
          ? "Hours for Invoicing workbook"
          : "Protected exception - no export";
    audit.getRow(index + 2).values = [
      entry.trace.file,
      entry.trace.worksheet,
      entry.trace.row,
      entry.employee,
      employee?.abbreviation ?? "Unresolved",
      entry.projectCode ?? "",
      entry.description,
      entry.hoursAudit?.columnD ?? entry.hours,
      entry.hoursAudit?.dailyTotal ?? entry.hours,
      (entry.hoursAudit?.columnD ?? entry.hours) -
        (entry.hoursAudit?.dailyTotal ?? entry.hours),
      entry.approvedUncoded ? "Approved uncoded project" : entry.classification,
      destination,
    ];
  });
  [24, 18, 11, 24, 18, 14, 34, 18, 16, 12, 24, 27].forEach(
    (width, index) => (audit.getColumn(index + 1).width = width),
  );
  audit.getColumn(8).numFmt = "0.00";
  audit.getColumn(9).numFmt = "0.00";
  audit.getColumn(10).numFmt = "0.00";
  audit.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: auditHeaders.length },
  };
  const buffer = await workbook.xlsx.writeBuffer();
  return asArrayBuffer(buffer);
}

export function downloadWorkbook(data: ArrayBuffer, filename: string) {
  const url = URL.createObjectURL(
    new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function projectWorkbookFilename(month: string) {
  return `EAS Hours for Invoicing - ${fileMonth(month)}.xlsx`;
}

export function internalWorkbookFilename(month: string) {
  return `EAS Internal Hours - ${fileMonth(month)}.xlsx`;
}
