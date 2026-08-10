import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { TimeEntry } from "../src/domain";
import {
  catalogueFromAnnualWorkbook,
  catalogueFromCurrentEntries,
  mergeProjectCatalogues,
  suggestProjects,
} from "../src/projectCatalogue";

function annualWorkbook() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [],
      [null, "Job Number", "Job Name"],
      [null, 4312, "Harbour Road Access"],
      [null, 10002, "Training"],
    ]),
    "Apr 26",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [],
      [null, 4312, "Harbour Road Access"],
      [null, 5120, "Riverside Survey"],
    ]),
    "May 26",
  );
  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;
}

function currentEntry(): TimeEntry {
  return {
    employee: "Employee Alpha",
    reportingMonth: "2026-07",
    projectCode: "6200",
    description: "Station Forecourt Study",
    hours: 1,
    classification: "project",
    trace: { file: "synthetic.xlsx", worksheet: "Jul 26", row: 5 },
  };
}

describe("project catalogue and conservative suggestions", () => {
  it("builds and deduplicates a catalogue from the annual workbook and current entries", () => {
    const annual = catalogueFromAnnualWorkbook(annualWorkbook());
    const current = catalogueFromCurrentEntries([currentEntry()]);
    const merged = mergeProjectCatalogues(annual, current);

    expect(
      merged.map(({ code, description }) => ({ code, description })),
    ).toEqual([
      { code: "4312", description: "Harbour Road Access" },
      { code: "5120", description: "Riverside Survey" },
      { code: "6200", description: "Station Forecourt Study" },
    ]);
    expect(merged[0].sources).toEqual(["annual-workbook"]);
  });

  it("offers a typo-tolerant suggestion without changing the source entry", () => {
    const source = "Harbour Roud";
    const catalogue = catalogueFromAnnualWorkbook(annualWorkbook());
    const suggestions = suggestProjects(source, catalogue);

    expect(suggestions[0].project).toMatchObject({
      code: "4312",
      description: "Harbour Road Access",
    });
    expect(source).toBe("Harbour Roud");
  });

  it("does not force a weak suggestion", () => {
    expect(
      suggestProjects(
        "Completely unrelated wording",
        catalogueFromAnnualWorkbook(annualWorkbook()),
      ),
    ).toEqual([]);
  });
});
