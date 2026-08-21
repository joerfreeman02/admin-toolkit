import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  applyUncodedDecisions,
  consolidateEntries,
  entryReviewKey,
} from "../src/consolidation";
import type { EmployeeRegister, TimeEntry } from "../src/domain";
import { addEmployee, emptyEmployeeRegister } from "../src/employeeRegister";
import {
  EMPLOYEE_VIEWER_TOKEN_KEY,
  createEmployeeDataset,
  decodePublicationFragment,
  decryptEmployeePublication,
  encodePublicationFragment,
  encryptEmployeeDataset,
  generateEmployeeViewerToken,
} from "../src/publication";

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
});

function register(): EmployeeRegister {
  return addEmployee(emptyEmployeeRegister(), {
    fullName: "Employee Alpha",
    effectiveFrom: "2026-07",
    department: "Transport",
    grade: "Engineer",
    abbreviation: "EA",
  });
}

function entry(
  classification: TimeEntry["classification"] = "project",
): TimeEntry {
  return {
    employee: "Employee Alpha",
    reportingMonth: "2026-07",
    projectCode: classification === "project" ? "4312" : "10002",
    description:
      classification === "project" ? "Harbour Road Access" : "Training",
    hours: 2.25,
    classification,
    trace: { file: "private-source.xlsx", worksheet: "Jul 26", row: 5 },
  };
}

describe("encrypted Employee Viewer publication", () => {
  it("publishes only the approved project dataset and decrypts with the separate token", async () => {
    const result = consolidateEntries(
      [entry(), entry("internal")],
      register(),
      "2026-07",
    );
    const dataset = createEmployeeDataset(result);
    const token = generateEmployeeViewerToken();
    const publication = await encryptEmployeeDataset(dataset, token);
    const decrypted = await decryptEmployeePublication(publication, token);

    expect(decrypted).toEqual(dataset);
    expect(decrypted.projects).toHaveLength(1);
    expect(JSON.stringify(decrypted)).not.toMatch(
      /Training|private-source|trace/,
    );
    expect(EMPLOYEE_VIEWER_TOKEN_KEY).not.toBe("eas-admin-authorised");
  });

  it("keeps employee, project and hour values out of the encrypted package and fragment", async () => {
    const dataset = createEmployeeDataset(
      consolidateEntries([entry()], register(), "2026-07"),
    );
    const publication = await encryptEmployeeDataset(
      dataset,
      generateEmployeeViewerToken(),
    );
    const fragment = encodePublicationFragment(publication);

    expect(JSON.stringify(publication)).not.toMatch(
      /Employee Alpha|Harbour Road|2\.25/,
    );
    expect(fragment).not.toMatch(/Employee Alpha|Harbour Road|2\.25/);
    expect(decodePublicationFragment(fragment)).toEqual(publication);
  });

  it("publishes neutral Unknown and Excluded totals without protected source wording", () => {
    const unknown = {
      ...entry(),
      projectCode: undefined,
      description: "Sensitive client discussion that must stay private",
      classification: "exception" as const,
      trace: {
        file: "private-timesheet.xlsx",
        worksheet: "Jul 26",
        row: 22,
      },
    };
    const excluded = {
      ...unknown,
      description: "Private exclusion reason",
      hours: 1.25,
      trace: { ...unknown.trace, row: 23 },
    };
    const reviewed = applyUncodedDecisions(
      [unknown, excluded],
      new Map([
        [entryReviewKey(unknown), { kind: "unknown-project" as const }],
        [
          entryReviewKey(excluded),
          { kind: "excluded" as const, reason: "Management-only reason" },
        ],
      ]),
    );
    const dataset = createEmployeeDataset(
      consolidateEntries(reviewed, register(), "2026-07"),
    );
    expect(dataset.projects).toEqual([]);
    expect(dataset.statuses).toEqual([
      {
        employee: "Employee Alpha",
        kind: "unknown-project",
        hours: 2.25,
      },
      { employee: "Employee Alpha", kind: "excluded", hours: 1.25 },
    ]);
    expect(JSON.stringify(dataset)).not.toMatch(
      /Sensitive client|Private exclusion|Management-only|private-timesheet|row/,
    );
  });

  it("keeps Time in Lieu entirely out of the Employee Viewer dataset", () => {
    const timeInLieu = {
      ...entry("time-in-lieu"),
      projectCode: undefined,
      description: "17.25hrs in lieu from June",
      internalCategory: "Time in Lieu",
    };
    const dataset = createEmployeeDataset(
      consolidateEntries([timeInLieu], register(), "2026-07"),
    );
    expect(dataset).toMatchObject({ projects: [], statuses: [] });
    expect(JSON.stringify(dataset)).not.toMatch(/Time in Lieu|17\.25|lieu/i);
  });

  it("rejects a wrong token and authenticated-ciphertext tampering", async () => {
    const dataset = createEmployeeDataset(
      consolidateEntries([entry()], register(), "2026-07"),
    );
    const token = generateEmployeeViewerToken();
    const publication = await encryptEmployeeDataset(dataset, token);

    await expect(
      decryptEmployeePublication(publication, generateEmployeeViewerToken()),
    ).rejects.toThrow(/incorrect|damaged/);
    const tamperIndex = Math.floor(publication.ciphertext.length / 2);
    const tamperedCiphertext = `${publication.ciphertext.slice(0, tamperIndex)}${
      publication.ciphertext[tamperIndex] === "A" ? "B" : "A"
    }${publication.ciphertext.slice(tamperIndex + 1)}`;
    await expect(
      decryptEmployeePublication(
        {
          ...publication,
          ciphertext: tamperedCiphertext,
        },
        token,
      ),
    ).rejects.toThrow(/incorrect|damaged/);
  });

  it("blocks publication while any consolidation control is unresolved", () => {
    const unresolved = {
      ...entry(),
      projectCode: undefined,
      classification: "exception" as const,
    };
    const result = consolidateEntries([unresolved], register(), "2026-07");
    expect(() => createEmployeeDataset(result)).toThrow(/blocked/);
  });

  it("blocks publication for unknown employees and project-description conflicts", () => {
    const unknownEmployee = { ...entry(), employee: "Unregistered Person" };
    expect(() =>
      createEmployeeDataset(
        consolidateEntries([unknownEmployee], register(), "2026-07"),
      ),
    ).toThrow(/blocked/);

    const conflict = {
      ...entry(),
      description: "Alternative Synthetic Description",
      trace: { file: "second.xlsx", worksheet: "Jul 26", row: 6 },
    };
    expect(() =>
      createEmployeeDataset(
        consolidateEntries([entry(), conflict], register(), "2026-07"),
      ),
    ).toThrow(/blocked/);
  });

  it("blocks any result marked as unreconciled", () => {
    const result = consolidateEntries([entry()], register(), "2026-07");
    expect(() =>
      createEmployeeDataset({
        ...result,
        reconciles: false,
        canExport: false,
        blockers: ["Hours do not reconcile."],
      }),
    ).toThrow(/blocked/);
  });
});
