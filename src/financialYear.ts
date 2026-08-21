import type {
  FinancialYearWorkbookRole,
  LatestMonthlyWorkbookInspection,
  StoredFinancialYearWorkbook,
} from "./domain";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function financialYearStartForMonth(month: string) {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw new Error(`Invalid reporting month: ${month}.`);
  const year = Number(match[1]);
  return Number(match[2]) >= 4 ? year : year - 1;
}

export function financialYearLabel(startYear: number) {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function financialYearForMonth(month: string) {
  const startYear = financialYearStartForMonth(month);
  return { startYear, label: financialYearLabel(startYear) };
}

export function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, value - 1, 1)));
}

export function isAprilProcessingMonth(month: string) {
  return month.endsWith("-04");
}

export interface RolloverPlan {
  processingFinancialYear: string;
  current?: StoredFinancialYearWorkbook;
  previous?: StoredFinancialYearWorkbook;
  needsInitialisation: boolean;
}

export function planFinancialYearRollover(
  processingMonth: string,
  workbooks: StoredFinancialYearWorkbook[],
): RolloverPlan {
  const { startYear, label } = financialYearForMonth(processingMonth);
  const current = workbooks.find((item) => item.financialYear === label);
  const previousLabel = financialYearLabel(startYear - 1);
  const previous = workbooks.find(
    (item) => item.financialYear === previousLabel,
  );
  return {
    processingFinancialYear: label,
    current,
    previous,
    needsInitialisation: isAprilProcessingMonth(processingMonth) && !current,
  };
}

export function workbookRoleForUpload(
  inspection: LatestMonthlyWorkbookInspection,
  processingMonth: string,
): FinancialYearWorkbookRole {
  return inspection.financialYear ===
    financialYearForMonth(processingMonth).label
    ? "current"
    : "historical";
}
