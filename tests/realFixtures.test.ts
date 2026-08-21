import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { consolidateEntries } from "../src/consolidation";
import { validateEmployeeRegister } from "../src/employeeRegister";
import {
  inspectLatestMonthlyWorkbook,
  resolveHistoricalCarry,
} from "../src/monthlyWorkbook";
import { processUploads } from "../src/processing";
import { parseJobRegister } from "../src/jobRegister";

const registerPath = process.env.NEXUS_ACCEPTANCE_REGISTER;
const workbookPath = process.env.NEXUS_ACCEPTANCE_WORKBOOK;
const previousWorkbookPath = process.env.NEXUS_ACCEPTANCE_PREVIOUS_WORKBOOK;
const timesheetsPath = process.env.NEXUS_ACCEPTANCE_TIMESHEETS;
const jobRegisterPath = process.env.NEXUS_ACCEPTANCE_JOB_REGISTER;
const fixturesAvailable = !!(
  registerPath &&
  workbookPath &&
  previousWorkbookPath &&
  timesheetsPath &&
  jobRegisterPath
);

function asArrayBuffer(value: Uint8Array) {
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
}

describe.skipIf(!fixturesAvailable)(
  "read-only confidential acceptance fixtures",
  () => {
    it("validates the register, scans the full workbook, and processes all timesheets without copying fixture data", async () => {
      const register = validateEmployeeRegister(
        JSON.parse(await readFile(registerPath!, "utf8")),
      );
      const workbookBytes = await readFile(workbookPath!);
      const inspection = await inspectLatestMonthlyWorkbook(
        asArrayBuffer(workbookBytes),
        { name: "current-fixture.xlsx", role: "current" },
      );
      const previousWorkbookBytes = await readFile(previousWorkbookPath!);
      const previousInspection = await inspectLatestMonthlyWorkbook(
        asArrayBuffer(previousWorkbookBytes),
        { name: "previous-fixture.xlsx", role: "historical" },
      );
      const carry = resolveHistoricalCarry(
        [previousInspection, inspection],
        register,
        "2026-08",
      );
      const currentCarry = resolveHistoricalCarry(
        inspection,
        register,
        "2026-08",
      );
      const timesheetBytes = await readFile(timesheetsPath!);
      const jobRegisterBytes = await readFile(jobRegisterPath!);
      const jobRegisterHashBefore = createHash("sha256")
        .update(jobRegisterBytes)
        .digest("hex");
      const jobRegisterStarted = performance.now();
      const jobRegister = await parseJobRegister(
        asArrayBuffer(jobRegisterBytes),
        "acceptance-job-register.xlsm",
      );
      const jobRegisterMilliseconds = performance.now() - jobRegisterStarted;
      const jobRegisterHashAfter = createHash("sha256")
        .update(await readFile(jobRegisterPath!))
        .digest("hex");
      const processing = await processUploads(
        [
          new File(
            [asArrayBuffer(timesheetBytes)],
            "acceptance-timesheets.zip",
            {
              type: "application/zip",
            },
          ),
        ],
        "2026-07",
      );
      const consolidated = consolidateEntries(
        processing.entries,
        register,
        "2026-07",
      );
      const departments = new Set(
        register.employees.flatMap((employee) =>
          employee.assignments.map((assignment) => assignment.department),
        ),
      );

      expect(register.employees).toHaveLength(22);
      expect(departments).toEqual(
        new Set(["Transport", "Drainage", "Mixed", "Sustainability"]),
      );
      expect(inspection.worksheets.map((sheet) => sheet.name)).toEqual([
        "Apr 26",
        "May 26",
        "Jun 26",
        "Jul 26",
      ]);
      expect(previousInspection.financialYear).toBe("2025/26");
      expect(previousInspection.worksheets).toHaveLength(12);
      expect(previousInspection.carryCandidates).toHaveLength(713);
      expect(
        previousInspection.carryCandidates.filter(
          (candidate) => candidate.projectCode,
        ),
      ).toHaveLength(706);
      expect(previousInspection.errors).toHaveLength(7);
      expect(inspection.financialYear).toBe("2026/27");
      expect(currentCarry.records).toHaveLength(245);
      expect(currentCarry.errors).toEqual(inspection.errors);
      expect(inspection.carryCandidates.length).toBeGreaterThan(0);
      expect(inspection.warnings).toEqual([]);
      expect(
        inspection.errors.every((error) => /no project number/i.test(error)),
      ).toBe(true);
      expect(carry.records.length).toBeGreaterThan(0);
      expect(processing.filesSupplied).toBe(22);
      expect(processing.fatalErrors).toEqual([]);
      expect(processing.employees).toHaveLength(22);
      expect(consolidated.unknownEmployees).toEqual([]);
      expect(jobRegister.projects.length).toBeGreaterThan(6_500);
      expect(jobRegister.projects.length).toBeLessThan(7_500);
      expect(jobRegisterHashAfter).toBe(jobRegisterHashBefore);
      expect(jobRegisterMilliseconds).toBeLessThan(5_000);

      console.info(
        JSON.stringify({
          employeeRecords: register.employees.length,
          monthlyWorksheets: inspection.worksheets.length,
          historicalMonthlyWorksheets: previousInspection.worksheets.length,
          greenCarryCandidates: inspection.carryCandidates.length,
          greenCarryRecordsWithProject: inspection.carryCandidates.filter(
            (candidate) => candidate.projectCode,
          ).length,
          historicalGreenCarryCandidates:
            previousInspection.carryCandidates.length,
          historicalGreenCarryRecordsWithProject:
            previousInspection.carryCandidates.filter(
              (candidate) => candidate.projectCode,
            ).length,
          workbookCarryBlockers: inspection.errors.length,
          historicalWorkbookCarryBlockers: previousInspection.errors.length,
          resolvedCarryRecords: carry.records.length,
          carryResolutionErrors: carry.errors.length,
          timesheetsProcessed: processing.filesSupplied,
          parsedEntries: processing.entries.length,
          timesheetFatalErrors: processing.fatalErrors.length,
          unknownEmployees: consolidated.unknownEmployees.length,
          jobRegisterProjects: jobRegister.projects.length,
          jobRegisterWarnings: jobRegister.warnings.length,
          jobRegisterParseMilliseconds: Math.round(jobRegisterMilliseconds),
          jobRegisterSourceUnchanged:
            jobRegisterHashAfter === jobRegisterHashBefore,
        }),
      );
    }, 30_000);
  },
);
