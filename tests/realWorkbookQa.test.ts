import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ConsolidationResult } from "../src/domain";
import { validateEmployeeRegister } from "../src/employeeRegister";
import { latestEmployeeSnapshot } from "../src/employeeRegister";
import {
  inspectLatestMonthlyWorkbook,
  resolveHistoricalCarry,
} from "../src/monthlyWorkbook";
import { generateProjectWorkbook } from "../src/workbookExport";

const registerPath = process.env.NEXUS_ACCEPTANCE_REGISTER;
const currentPath = process.env.NEXUS_ACCEPTANCE_WORKBOOK;
const previousPath = process.env.NEXUS_ACCEPTANCE_PREVIOUS_WORKBOOK;
const outputDir = process.env.NEXUS_ACCEPTANCE_QA_OUTPUT_DIR;
const fixturesAvailable = !!(
  registerPath &&
  currentPath &&
  previousPath &&
  outputDir
);

function asArrayBuffer(value: Uint8Array) {
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
}

describe.skipIf(!fixturesAvailable)(
  "renderable real-template workbook QA",
  () => {
    it("creates a neutral July project workbook with only active lifecycle carry", async () => {
      const register = validateEmployeeRegister(
        JSON.parse(await readFile(registerPath!, "utf8")),
      );
      const currentBytes = await readFile(currentPath!);
      const previousBytes = await readFile(previousPath!);
      const current = await inspectLatestMonthlyWorkbook(
        asArrayBuffer(currentBytes),
        { name: "current-fixture.xlsx", role: "current" },
      );
      const previous = await inspectLatestMonthlyWorkbook(
        asArrayBuffer(previousBytes),
        { name: "previous-fixture.xlsx", role: "historical" },
      );
      const carry = resolveHistoricalCarry(
        [previous, current],
        register,
        "2026-07",
      );
      const employees = latestEmployeeSnapshot(register, true);
      const ts = employees.find((employee) => employee.abbreviation === "TS")!;
      const first = employees[0];
      const result: ConsolidationResult = {
        month: "2026-07",
        employees,
        projects: [
          {
            key: "project:5752",
            code: "5752",
            description: "Starveacres, 16 Watford Road, Radlett",
            approvedUncoded: false,
            hoursByEmployee: { [ts.id]: 10.75 },
            total: 10.75,
            traces: [],
          },
        ],
        internal: [],
        unresolved: [],
        unknownEmployees: [],
        descriptionConflicts: [],
        projectHours: 10.75,
        internalHours: 0,
        unknownHours: 0.5,
        excludedHours: 0.25,
        timeInLieuHours: 0.75,
        unknownHoursByEmployee: { [first.id]: 0.5 },
        excludedHoursByEmployee: { [first.id]: 0.25 },
        timeInLieuHoursByEmployee: { [first.id]: 0.75 },
        exceptionHours: 0,
        importedHours: 12.25,
        reconciles: true,
        sourceDiscrepancyCount: 0,
        canExport: true,
        blockers: [],
      };
      const output = await generateProjectWorkbook(
        result,
        asArrayBuffer(currentBytes),
        "nexus-1.0.0-qa",
        carry.records,
        carry.audit,
      );
      await mkdir(outputDir!, { recursive: true });
      const outputPath = path.join(
        outputDir!,
        "NEXUS Hours for Invoicing - July 2026 QA.xlsx",
      );
      await writeFile(outputPath, new Uint8Array(output));
      expect(
        carry.records.some(
          (record) =>
            record.projectCode === "5752" &&
            ["2026-05", "2026-06"].includes(record.originatingMonth),
        ),
      ).toBe(false);
      expect(carry.records).toHaveLength(5);
    }, 30_000);
  },
);
