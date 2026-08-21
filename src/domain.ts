import { z } from "zod";

export const ClassificationSchema = z.enum([
  "project",
  "internal",
  "exception",
  "unknown",
  "excluded",
  "time-in-lieu",
]);
export type Classification = z.infer<typeof ClassificationSchema>;

export interface SourceTrace {
  file: string;
  worksheet: string;
  row: number;
}

export interface SourceEntryContext {
  employee: string;
  month: string;
  recordedHours: number;
  originalProjectNumber?: string;
  originalDescription: string;
  dailyHours: { day: string; hours: number }[];
  adjacentValues: string[];
  surroundingRows: {
    row: number;
    projectNumber?: string;
    description?: string;
    hours?: number;
  }[];
}

export interface SourceWorkbookFile {
  name: string;
  data: ArrayBuffer;
}

export interface SourceHoursAudit {
  columnD?: number;
  dailyTotal: number;
  authority: "column-d" | "daily-sum" | "tabular-total";
  differs: boolean;
}

export interface TimeEntry {
  employee: string;
  reportingMonth: string;
  projectCode?: string;
  description: string;
  internalCategory?: string;
  hours: number;
  dailyHours?: Record<string, number>;
  hoursAudit?: SourceHoursAudit;
  classification: Classification;
  approvedUncoded?: boolean;
  uncodedDecision?: UncodedReviewDecision;
  trace: SourceTrace;
  sourceContext?: SourceEntryContext;
}

export type UncodedReviewDecision =
  | {
      kind: "existing-project";
      projectCode: string;
      projectDescription: string;
    }
  | {
      kind: "genuine-uncoded";
      projectDescription: string;
    }
  | {
      kind: "internal";
      internalCode?: string;
      internalCategory: string;
    }
  | { kind: "time-in-lieu" }
  | { kind: "unknown-project" }
  | { kind: "excluded"; reason?: string };

export interface InternalCatalogueItem {
  code?: string;
  description: string;
  source: "current-timesheets" | "annual-workbook";
}

export interface ProjectCatalogueItem {
  code: string;
  description: string;
  client?: string;
  projectManager?: string;
  projectDirector?: string;
  sources: ("current-timesheets" | "annual-workbook" | "job-register")[];
}

export interface StoredJobRegister {
  version: 1;
  fileName: string;
  loadedAt: string;
  byteSize: number;
  fingerprint: string;
  projects: ProjectCatalogueItem[];
  warnings: string[];
}

export interface ProcessingResult {
  entries: TimeEntry[];
  filesSupplied: number;
  employees: string[];
  missingEmployees: string[];
  blankTimesheets: string[];
  warnings: string[];
  fatalErrors: string[];
  duplicateFiles: string[];
  sourceFiles: SourceWorkbookFile[];
}

export const DepartmentSchema = z.enum([
  "Drainage",
  "Transport",
  "Mixed",
  "Sustainability",
]);
export type Department = z.infer<typeof DepartmentSchema>;

export const GradeSchema = z.enum([
  "Director",
  "Associate Director",
  "Associate",
  "Principal Engineer",
  "Senior Engineer",
  "Engineer",
  "Graduate Engineer / Senior Technician",
  "Admin",
]);
export type Grade = z.infer<typeof GradeSchema>;

export const EmployeeAssignmentSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}$/),
  effectiveTo: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  department: DepartmentSchema,
  grade: GradeSchema,
  abbreviation: z.string().trim().min(1).max(12),
  withinBandOrder: z.number().int().nonnegative(),
  active: z.boolean(),
});
export type EmployeeAssignment = z.infer<typeof EmployeeAssignmentSchema>;

export const EmployeeRecordSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)).default([]),
  assignments: z.array(EmployeeAssignmentSchema).min(1),
});
export type EmployeeRecord = z.infer<typeof EmployeeRecordSchema>;

export const EmployeeRegisterSchema = z.object({
  version: z.literal(1),
  employees: z.array(EmployeeRecordSchema),
});
export type EmployeeRegister = z.infer<typeof EmployeeRegisterSchema>;

export interface EmployeeSnapshot {
  id: string;
  fullName: string;
  aliases: string[];
  department: Department;
  grade: Grade;
  abbreviation: string;
  withinBandOrder: number;
  active: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface ResolvedTimeEntry extends TimeEntry {
  employeeId: string;
  employeeAbbreviation: string;
}

export interface ProjectConsolidationRow {
  key: string;
  code?: string;
  description: string;
  approvedUncoded: boolean;
  hoursByEmployee: Record<string, number>;
  total: number;
  traces: SourceTrace[];
}

export interface InternalConsolidationRow {
  key: string;
  code?: string;
  description: string;
  hoursByEmployee: Record<string, number>;
  total: number;
  traces: SourceTrace[];
}

export interface DescriptionConflict {
  projectCode: string;
  descriptions: string[];
  sources: {
    description: string;
    traces: SourceTrace[];
  }[];
  canonicalDescription?: string;
  resolved: boolean;
}

export interface ConsolidationResult {
  month: string;
  employees: EmployeeSnapshot[];
  projects: ProjectConsolidationRow[];
  internal: InternalConsolidationRow[];
  unresolved: TimeEntry[];
  unknownEmployees: string[];
  descriptionConflicts: DescriptionConflict[];
  projectHours: number;
  internalHours: number;
  unknownHours: number;
  excludedHours: number;
  timeInLieuHours: number;
  unknownHoursByEmployee: Record<string, number>;
  excludedHoursByEmployee: Record<string, number>;
  timeInLieuHoursByEmployee: Record<string, number>;
  exceptionHours: number;
  importedHours: number;
  reconciles: boolean;
  sourceDiscrepancyCount: number;
  canExport: boolean;
  blockers: string[];
}

export interface MonthlyWorksheet {
  name: string;
  month: string;
  financialYear: string;
  headerRow: number;
  employeeColumns: number;
}

export type FinancialYearWorkbookRole = "current" | "historical";

export interface WorkbookSource {
  id: string;
  name: string;
  financialYear: string;
  savedAt: string;
  role: FinancialYearWorkbookRole;
}

export interface WorkbookCarryCandidate {
  projectCode?: string;
  projectDescription?: string;
  employeeAbbreviation: string;
  hours: number;
  originatingMonth: string;
  originatingYear: number;
  sourceWorkbook: string;
  sourceWorkbookId: string;
  sourceWorksheet: string;
  sourceRow: number;
  sourceColumn: number;
  sourceCell: string;
  status: "carry";
  fill: "#92D050";
}

export type WorkbookCommercialStatus =
  | "awaiting"
  | "invoiced"
  | "carry"
  | "closed";

export interface WorkbookProjectMonthState {
  projectCode?: string;
  projectDescription?: string;
  originatingMonth: string;
  sourceWorkbook: string;
  sourceWorkbookId: string;
  sourceWorksheet: string;
  sourceRow: number;
  statuses: WorkbookCommercialStatus[];
  carryReference?: string;
  notes?: string;
}

export type HistoricalCarryLifecycleStatus =
  | "active"
  | "closed"
  | "expired"
  | "retained-unknown"
  | "already-dealt-with";

export interface HistoricalCarryAuditRecord extends WorkbookCarryCandidate {
  lifecycleStatus: HistoricalCarryLifecycleStatus;
  lifecycleStatusMonth?: string;
  lifecycleEvidence: string;
  employeeId?: string;
  employee?: string;
  department?: Department;
}

export interface HistoricalCarryRecord extends WorkbookCarryCandidate {
  projectCode?: string;
  employeeId: string;
  employee: string;
  department?: Department;
}

export interface LatestMonthlyWorkbookInspection {
  financialYear: string;
  financialYearStart: number;
  updatedThrough: string;
  source: WorkbookSource;
  worksheets: MonthlyWorksheet[];
  carryCandidates: WorkbookCarryCandidate[];
  projectStates?: WorkbookProjectMonthState[];
  warnings: string[];
  errors: string[];
}

export interface StoredFinancialYearWorkbook {
  financialYear: string;
  role: FinancialYearWorkbookRole;
  fileName: string;
  savedAt: string;
  updatedThrough: string;
  data: ArrayBuffer;
  inspection: LatestMonthlyWorkbookInspection;
  projectCatalogue: ProjectCatalogueItem[];
  internalCatalogue?: InternalCatalogueItem[];
}

export type TpcMoneyValue =
  | { kind: "amount"; amount: number }
  | { kind: "text"; text: string }
  | { kind: "blank" };

export interface TpcWorksheet {
  name: string;
  month: string;
  financialYear: string;
  headerRow: number;
}

export interface TpcRecord {
  key: string;
  originatingDate?: string;
  originatingMonth: string;
  originatingYear: number;
  supplier: string;
  projectManager?: string;
  projectNumberRaw?: string;
  projectCode?: string;
  projectDescription?: string;
  description: string;
  net: TpcMoneyValue;
  vat: TpcMoneyValue;
  gross: TpcMoneyValue;
  notes?: string;
  sourceFinancialYear: string;
  sourceWorkbook: string;
  sourceWorkbookId: string;
  sourceWorksheet: string;
  sourceRow: number;
  status: "outstanding" | "invoiced";
  statusEvidence: "red-row" | "black-row";
  monetaryWarning?: string;
}

export interface TpcWorkbookInspection {
  financialYear: string;
  financialYearStart: number;
  updatedThrough: string;
  source: WorkbookSource;
  worksheets: TpcWorksheet[];
  records: TpcRecord[];
  warnings: string[];
  errors: string[];
}

export interface StoredTpcWorkbook {
  financialYear: string;
  role: FinancialYearWorkbookRole;
  fileName: string;
  savedAt: string;
  updatedThrough: string;
  data: ArrayBuffer;
  inspection: TpcWorkbookInspection;
}

export type TpcReviewDecision =
  | {
      kind: "project";
      projectCode: string;
      projectDescription: string;
    }
  | { kind: "non-project" }
  | { kind: "unallocated" };

export interface TpcReviewState {
  version: 1;
  decisions: Record<string, TpcReviewDecision>;
}

export interface ResolvedTpcRecord extends TpcRecord {
  resolution: "project" | "non-project" | "unallocated";
}

export interface TpcReviewIssue {
  key: string;
  record: TpcRecord;
}

export interface TpcResolution {
  loaded: boolean;
  records: ResolvedTpcRecord[];
  warningRecords: TpcRecord[];
  allocated: ResolvedTpcRecord[];
  unallocated: ResolvedTpcRecord[];
  nonProject: ResolvedTpcRecord[];
  issues: TpcReviewIssue[];
  warnings: string[];
}

export interface HistoricalCarryResolution {
  records: HistoricalCarryRecord[];
  audit: HistoricalCarryAuditRecord[];
  warnings: string[];
  errors: string[];
  issues: HistoricalReviewIssue[];
}

export type HistoricalIssueResolution =
  | {
      kind: "project";
      projectCode: string;
      projectDescription: string;
    }
  | { kind: "already-dealt-with" }
  | { kind: "unknown-project-carry" }
  | { kind: "exclude" };

export interface HistoricalReviewState {
  version: 1;
  employeeMappings: Record<string, string>;
  issueResolutions: Record<string, HistoricalIssueResolution>;
}

export interface HistoricalReviewIssue {
  key: string;
  kind: "employee" | "project" | "workbook-warning" | "workbook-error";
  sourceRole: FinancialYearWorkbookRole;
  title: string;
  summary: string;
  technicalEvidence: string;
  employeeAbbreviation?: string;
  candidate?: WorkbookCarryCandidate;
}

// Retained for backwards-compatible validation of legacy Sprint 0 payloads.
// NEXUS carry-over is derived from Latest Monthly Workbook formatting instead.
export const CarryoverSchema = z.object({
  employeeInitials: z.string().min(1).max(12),
  hours: z.number().positive(),
  projectCode: z.string().min(1),
  originatingMonth: z.string().regex(/^\d{4}-\d{2}$/),
  status: z.enum(["open", "closed"]),
});
export type Carryover = z.infer<typeof CarryoverSchema>;

export interface PublicProject {
  code?: string;
  description: string;
  contributors: { employee: string; department: Department; hours: number }[];
  carriedHours: {
    employee: string;
    department?: Department;
    originatingMonth: string;
    hours: number;
  }[];
  outstandingTpcs: PublicTpc[];
  total: number;
}

export interface PublicTpc {
  originatingDate?: string;
  originatingMonth: string;
  supplier: string;
  description: string;
  projectNumberRaw?: string;
  net: TpcMoneyValue;
  vat: TpcMoneyValue;
  gross: TpcMoneyValue;
}

export interface PublicDataset {
  month: string;
  employees: { employee: string; department: Department }[];
  projects: PublicProject[];
  statuses: {
    employee: string;
    kind: "unknown-project" | "excluded";
    hours: number;
    originatingMonth?: string;
  }[];
  tpcLoaded: boolean;
  unallocatedTpcs: PublicTpc[];
}

export interface EncryptedEmployeePublication {
  format: "eas-employee-publication";
  version: 1;
  month: string;
  kdf: {
    name: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
    salt: string;
  };
  cipher: {
    name: "AES-GCM";
    iv: string;
  };
  ciphertext: string;
}
