import * as XLSX from "xlsx";
import type { ProjectCatalogueItem, StoredJobRegister } from "./domain";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ROWS = 100_000;
const REQUIRED_HEADERS = ["project", "project name"] as const;
const OPTIONAL_HEADERS = [
  "client",
  "client lead",
  "project director",
  "project manager",
] as const;

function normaliseHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cellText(cell: XLSX.CellObject | undefined) {
  if (!cell || cell.t === "e" || cell.v === undefined || cell.v === null)
    return "";
  return String(cell.v).trim();
}

function cellAt(sheet: XLSX.WorkSheet, row: number, column: number) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: column })];
}

function findHeader(sheet: XLSX.WorkSheet, lastColumn: number) {
  for (
    let row = 0;
    row <= Math.min(49, XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1").e.r);
    row++
  ) {
    const columns = new Map<string, number>();
    for (let column = 0; column <= lastColumn; column++) {
      const header = normaliseHeader(cellText(cellAt(sheet, row, column)));
      if ([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS].includes(header as never))
        columns.set(header, column);
    }
    if (REQUIRED_HEADERS.every((header) => columns.has(header)))
      return { row, columns };
  }
  return undefined;
}

async function sha256(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data.slice(0));
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function parseJobRegister(
  data: ArrayBuffer,
  fileName: string,
  loadedAt = new Date().toISOString(),
): Promise<StoredJobRegister> {
  if (!/\.xlsm$/i.test(fileName) && !/\.xlsx$/i.test(fileName))
    throw new Error(
      "Choose the latest Job Register workbook (.xlsm or .xlsx). ",
    );
  if (data.byteLength > MAX_BYTES)
    throw new Error(
      "This Job Register is unusually large. Check that the correct workbook was selected.",
    );
  let workbook: XLSX.WorkBook;
  try {
    // SheetJS reads cached workbook values; it does not execute VBA macros.
    workbook = XLSX.read(new Uint8Array(data), {
      type: "array",
      cellDates: true,
    });
  } catch {
    throw new Error(
      "NEXUS could not read this Job Register. Choose a fresh copy of the workbook.",
    );
  }
  const sheetName = workbook.SheetNames.find(
    (name) => name.trim().toLowerCase() === "job register",
  );
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet)
    throw new Error(
      'This workbook does not contain a worksheet named "Job Register".',
    );
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  if (range.e.r + 1 > MAX_ROWS)
    throw new Error(
      "This Job Register contains too many rows to check safely. Ask the workbook owner for a current trimmed copy.",
    );
  const header = findHeader(sheet, range.e.c);
  if (!header)
    throw new Error(
      "NEXUS could not find the Project and Project Name headings in the Job Register.",
    );

  const warnings: string[] = [];
  const projects: ProjectCatalogueItem[] = [];
  const seen = new Set<string>();
  const descriptionsByCode = new Map<string, Set<string>>();
  const column = (name: string) => header.columns.get(name);
  const read = (row: number, name: string) => {
    const index = column(name);
    return index === undefined ? "" : cellText(cellAt(sheet, row, index));
  };

  for (let row = header.row + 1; row <= range.e.r; row++) {
    const projectCell = cellAt(sheet, row, column("project")!);
    const nameCell = cellAt(sheet, row, column("project name")!);
    const code = cellText(projectCell);
    const description = cellText(nameCell);
    if (!code && !description) continue;
    if (projectCell?.t === "e" || nameCell?.t === "e") {
      warnings.push(
        `Row ${row + 1} contains a workbook error and was not added.`,
      );
      continue;
    }
    if (projectCell?.f || nameCell?.f)
      warnings.push(
        `Row ${row + 1} uses a formula; its displayed value was checked.`,
      );
    if (!code) {
      warnings.push(`Row ${row + 1} has no project number and was not added.`);
      continue;
    }
    if (!description) {
      warnings.push(`Project ${code} has no project name and was not added.`);
      continue;
    }
    const key = `${code.toLowerCase()}|${description.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const descriptions = descriptionsByCode.get(code) ?? new Set<string>();
    descriptions.add(description.toLowerCase());
    descriptionsByCode.set(code, descriptions);
    projects.push({
      code,
      description,
      client: read(row, "client") || read(row, "client lead") || undefined,
      projectManager: read(row, "project manager") || undefined,
      projectDirector: read(row, "project director") || undefined,
      sources: ["job-register"],
    });
  }
  for (const [code, descriptions] of descriptionsByCode)
    if (descriptions.size > 1)
      warnings.push(
        `Project ${code} appears with more than one name. NEXUS will show a shortlist rather than choose automatically.`,
      );
  if (!projects.length)
    throw new Error(
      "No usable projects were found. Check that this is the latest Job Register.",
    );

  return {
    version: 1,
    fileName,
    loadedAt,
    byteSize: data.byteLength,
    fingerprint: await sha256(data),
    projects,
    warnings,
  };
}
