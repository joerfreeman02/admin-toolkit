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
export interface TimeEntry {
  employee: string;
  reportingMonth: string;
  projectCode?: string;
  description: string;
  internalCategory?: string;
  hours: number;
  dailyHours?: Record<string, number>;
  classification: Classification;
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
export const CarryoverSchema = z.object({
  employeeInitials: z.string().min(1).max(8),
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
