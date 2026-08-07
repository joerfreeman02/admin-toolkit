import { z } from "zod";

export const ClassificationSchema = z.enum([
  "project",
  "internal",
  "exception",
]);
export type Classification = z.infer<typeof ClassificationSchema>;

export interface SourceTrace {
  file: string;
  worksheet: string;
  row: number;
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
  trace: SourceTrace;
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
  exceptionHours: number;
  importedHours: number;
  reconciles: boolean;
  sourceDiscrepancyCount: number;
  canExport: boolean;
  blockers: string[];
}

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
  contributors: { employee: string; hours: number }[];
  total: number;
}

export interface PublicDataset {
  month: string;
  projects: PublicProject[];
}
