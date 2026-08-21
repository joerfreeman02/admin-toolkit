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
import { inspectTpcWorkbook, resolveTpcRecords } from "../src/tpcWorkbook";

const registerPath = process.env.NEXUS_ACCEPTANCE_REGISTER;
const workbookPath = process.env.NEXUS_ACCEPTANCE_WORKBOOK;
const previousWorkbookPath = process.env.NEXUS_ACCEPTANCE_PREVIOUS_WORKBOOK;
const timesheetsPath = process.env.NEXUS_ACCEPTANCE_TIMESHEETS;
const jobRegisterPath = process.env.NEXUS_ACCEPTANCE_JOB_REGISTER;
const currentTpcPath = process.env.NEXUS_ACCEPTANCE_TPC_CURRENT;
const previousTpcPath = process.env.NEXUS_ACCEPTANCE_TPC_PREVIOUS;
const fixturesAvailable = !!(
  registerPath &&
  workbookPath &&
  previousWorkbookPath &&
  timesheetsPath &&
  jobRegisterPath
);
const tpcFixturesAvailable = !!(
  currentTpcPath &&
  previousTpcPath &&
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
      const previousCarry = resolveHistoricalCarry(
        previousInspection,
        register,
        "2026-07",
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
      expect(previousInspection.errors).toEqual([]);
      const previousMissingProjectIssues = previousCarry.issues.filter(
        (issue) => issue.kind === "project",
      );
      expect(
        previousMissingProjectIssues.every(
          (issue) =>
            issue.kind === "project" && issue.sourceRole === "historical",
        ),
      ).toBe(true);
      expect(previousCarry.issues).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "workbook-error" }),
        ]),
      );
      expect(inspection.financialYear).toBe("2026/27");
      expect(currentCarry.records.length).toBeLessThan(
        inspection.carryCandidates.length,
      );
      expect(currentCarry.issues).toHaveLength(currentCarry.errors.length);
      expect(
        currentCarry.issues.every(
          (issue) => issue.kind === "project" && issue.sourceRole === "current",
        ),
      ).toBe(true);
      expect(inspection.carryCandidates.length).toBeGreaterThan(0);
      expect(inspection.warnings).toEqual([]);
      expect(inspection.errors).toEqual([]);
      expect(carry.records.length).toBeGreaterThan(0);
      expect(
        carry.records.filter(
          (record) =>
            record.projectCode === "5752" &&
            ["2026-05", "2026-06"].includes(record.originatingMonth),
        ),
      ).toEqual([]);
      const starveacresAudit = carry.audit.filter(
        (record) =>
          record.projectCode === "5752" &&
          ["2026-05", "2026-06"].includes(record.originatingMonth),
      );
      expect(starveacresAudit.length).toBeGreaterThan(0);
      expect(
        starveacresAudit.every(
          (record) =>
            record.lifecycleStatus === "closed" &&
            record.lifecycleStatusMonth === "2026-07" &&
            /7575226/.test(record.lifecycleEvidence),
        ),
      ).toBe(true);
      expect(
        carry.records.find(
          (record) =>
            record.projectCode === "6526" &&
            record.employeeAbbreviation === "JF" &&
            record.originatingMonth === "2026-01",
        ),
      ).toBeUndefined();
      expect(
        carry.audit.find(
          (record) =>
            record.projectCode === "6526" &&
            record.employeeAbbreviation === "JF" &&
            record.originatingMonth === "2026-01",
        ),
      ).toMatchObject({
        lifecycleStatus: "closed",
        lifecycleStatusMonth: "2026-02",
      });
      expect(
        carry.audit.find(
          (record) =>
            record.projectCode === "6526" &&
            record.employeeAbbreviation === "MJ" &&
            record.originatingMonth === "2026-03",
        ),
      ).toMatchObject({
        lifecycleStatus: "expired",
        lifecycleStatusMonth: "2026-04",
      });
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
          activeCarryAuditRecords: carry.audit.filter(
            (record) => record.lifecycleStatus === "active",
          ).length,
          closedCarryAuditRecords: carry.audit.filter(
            (record) => record.lifecycleStatus === "closed",
          ).length,
          expiredCarryAuditRecords: carry.audit.filter(
            (record) => record.lifecycleStatus === "expired",
          ).length,
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

describe.skipIf(!tpcFixturesAvailable)(
  "read-only confidential TPC acceptance fixtures",
  () => {
    it("scans both financial years without changing either source", async () => {
      const [currentBytes, previousBytes, jobBytes] = await Promise.all([
        readFile(currentTpcPath!),
        readFile(previousTpcPath!),
        readFile(jobRegisterPath!),
      ]);
      const sourceHashes = [currentBytes, previousBytes].map((bytes) =>
        createHash("sha256").update(bytes).digest("hex"),
      );
      const [current, previous, jobRegister] = await Promise.all([
        inspectTpcWorkbook(asArrayBuffer(currentBytes), {
          name: "current-tpc-fixture.xlsx",
          role: "current",
          savedAt: "2026-08-21T10:00:00.000Z",
        }),
        inspectTpcWorkbook(asArrayBuffer(previousBytes), {
          name: "previous-tpc-fixture.xlsx",
          role: "historical",
          savedAt: "2026-08-21T09:00:00.000Z",
        }),
        parseJobRegister(
          asArrayBuffer(jobBytes),
          "acceptance-job-register.xlsm",
        ),
      ]);
      const resolution = resolveTpcRecords(
        [previous, current],
        { version: 1, decisions: {} },
        jobRegister.projects,
      );
      const records = [...previous.records, ...current.records];
      const outstanding = records.filter(
        (record) => record.status === "outstanding",
      );
      const numericRows = records.filter(
        (record) =>
          record.net.kind === "amount" &&
          record.vat.kind === "amount" &&
          record.gross.kind === "amount",
      ).length;
      const hashesAfter = await Promise.all(
        [currentTpcPath!, previousTpcPath!].map(async (path) =>
          createHash("sha256")
            .update(await readFile(path))
            .digest("hex"),
        ),
      );

      expect(current.financialYear).toBe("2026/27");
      expect(current.worksheets).toHaveLength(5);
      expect(previous.financialYear).toBe("2025/26");
      expect(previous.worksheets).toHaveLength(12);
      expect(records.length).toBeGreaterThan(0);
      expect(outstanding.length).toBeGreaterThan(0);
      expect(resolution.records).toHaveLength(outstanding.length);
      expect(
        resolution.records.every((record) => record.status === "outstanding"),
      ).toBe(true);
      expect(resolution.warnings).toEqual([]);
      expect(resolution.warningRecords).toEqual([]);
      expect(hashesAfter).toEqual(sourceHashes);

      console.info(
        JSON.stringify({
          tpcFinancialYears: [previous.financialYear, current.financialYear],
          tpcMonthlySheets: {
            previous: previous.worksheets.length,
            current: current.worksheets.length,
          },
          tpcCandidateRows: records.length,
          tpcOutstandingRed: outstanding.length,
          tpcInvoicedBlack: records.length - outstanding.length,
          tpcAllocatedOutstanding: resolution.allocated.length,
          tpcUnallocatedOutstanding: resolution.unallocated.length,
          tpcNumericMonetaryRows: numericRows,
          tpcNonNumericMonetaryRows: records.length - numericRows,
          tpcReconciliationWarnings: records.filter(
            (record) => record.monetaryWarning,
          ).length,
          tpcOutstandingReconciliationWarnings: resolution.records.filter(
            (record) => record.monetaryWarning,
          ).length,
          tpcAuthoritativeFinancialYears: 2,
          tpcSupersededCopiesIgnored: 0,
          tpcSourceFilesUnchanged: hashesAfter.every(
            (hash, index) => hash === sourceHashes[index],
          ),
        }),
      );
    }, 30_000);
  },
);
