import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseJobRegister } from "../src/jobRegister";
import {
  createProjectSearchIndex,
  searchProjects,
  suggestProjects,
} from "../src/projectCatalogue";

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
});

function workbook(
  rows: unknown[][],
  sheetName = "Job Register",
  bookType: "xlsx" | "xlsm" = "xlsm",
) {
  const value = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(value, XLSX.utils.aoa_to_sheet(rows), sheetName);
  return XLSX.write(value, { bookType, type: "array" }) as ArrayBuffer;
}

function validRows(size = 3) {
  return [
    ["Helper heading", null, null],
    [
      "Project",
      "Project Name",
      "Client",
      "Project Manager",
      "Project Director",
      null,
      "Unrecognised helper",
    ],
    ...Array.from({ length: size }, (_, index) => [
      String(7000 + index),
      index === 0 ? "Mill Lane, Sawston" : `Project ${index}`,
      index === 0 ? "Bidwells" : `Client ${index % 10}`,
      index === 0 ? "Manager Alpha" : `Manager ${index % 20}`,
      index === 0 ? "Director Beta" : `Director ${index % 5}`,
      "helper value",
      "must not be indexed as a field",
    ]),
  ];
}

describe("read-only Job Register catalogue", () => {
  it("parses a macro-enabled workbook without mutating its bytes", async () => {
    const data = workbook(validRows());
    const before = new Uint8Array(data.slice(0));
    const parsed = await parseJobRegister(data, "synthetic-job-register.xlsm");

    expect(parsed.projects).toHaveLength(3);
    expect(parsed.projects[0]).toMatchObject({
      code: "7000",
      description: "Mill Lane, Sawston",
      client: "Bidwells",
      projectManager: "Manager Alpha",
      projectDirector: "Director Beta",
      sources: ["job-register"],
    });
    expect(parsed.projects[0]).not.toHaveProperty("Unrecognised helper");
    expect(new Uint8Array(data)).toEqual(before);
  });

  it("fails safely for a missing sheet or unexpected headings", async () => {
    await expect(
      parseJobRegister(workbook(validRows(), "Other"), "wrong.xlsm"),
    ).rejects.toThrow(/worksheet named "Job Register"/i);
    await expect(
      parseJobRegister(
        workbook([["Code", "Description"]], "Job Register"),
        "wrong.xlsm",
      ),
    ).rejects.toThrow(/Project and Project Name headings/i);
  });

  it("retains duplicate project numbers as an ambiguous shortlist", async () => {
    const parsed = await parseJobRegister(
      workbook([
        ["Project", "Project Name", "Client"],
        ["7005", "Mill Lane", "Client A"],
        ["7005", "Mill Lane Extension", "Client B"],
      ]),
      "duplicate.xlsm",
    );
    expect(parsed.projects).toHaveLength(2);
    expect(parsed.warnings.join(" ")).toMatch(/more than one name/i);
    expect(suggestProjects("7005", parsed.projects)).toHaveLength(2);
  });

  it("supports exact, partial, name, client, manager and director search", async () => {
    const parsed = await parseJobRegister(workbook(validRows()), "search.xlsm");
    const index = createProjectSearchIndex(parsed.projects);
    for (const query of [
      "7000",
      "700",
      "Mill Lane",
      "Bidwells",
      "Manager Alpha",
      "Director Beta",
    ])
      expect(searchProjects(index, query)[0].project.code).toBe("7000");
  });

  it("keeps an approximately 7,000-row catalogue responsive", async () => {
    const started = performance.now();
    const parsed = await parseJobRegister(
      workbook(validRows(7_000)),
      "large.xlsm",
    );
    const parseMilliseconds = performance.now() - started;
    const index = createProjectSearchIndex(parsed.projects);
    const searchStarted = performance.now();
    const result = searchProjects(index, "Project 6999");
    const searchMilliseconds = performance.now() - searchStarted;

    expect(parsed.projects).toHaveLength(7_000);
    expect(result[0].project.code).toBe("13999");
    expect(parseMilliseconds).toBeLessThan(5_000);
    expect(searchMilliseconds).toBeLessThan(100);
  }, 10_000);
});
