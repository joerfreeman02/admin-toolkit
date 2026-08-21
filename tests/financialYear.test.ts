import { describe, expect, it } from "vitest";
import type { StoredFinancialYearWorkbook } from "../src/domain";
import {
  financialYearForMonth,
  financialYearLabel,
  planFinancialYearRollover,
} from "../src/financialYear";

function stored(financialYear: string, updatedThrough: string) {
  return {
    financialYear,
    role: "current",
    updatedThrough,
  } as StoredFinancialYearWorkbook;
}

describe("April-to-March financial years", () => {
  it("uses the selected processing month rather than today's date", () => {
    expect(financialYearForMonth("2027-03")).toEqual({
      startYear: 2026,
      label: "2026/27",
    });
    expect(financialYearForMonth("2027-04")).toEqual({
      startYear: 2027,
      label: "2027/28",
    });
  });

  it("plans March normally even when called during April", () => {
    const previous = stored("2026/27", "2027-03");
    const plan = planFinancialYearRollover("2027-03", [previous]);
    expect(plan.current).toBe(previous);
    expect(plan.needsInitialisation).toBe(false);
  });

  it("deliberately starts April while retaining the preceding year unchanged", () => {
    const previous = stored("2026/27", "2027-03");
    const before = { ...previous };
    const plan = planFinancialYearRollover("2027-04", [previous]);
    expect(plan.processingFinancialYear).toBe("2027/28");
    expect(plan.previous).toBe(previous);
    expect(plan.current).toBeUndefined();
    expect(plan.needsInitialisation).toBe(true);
    expect(previous).toEqual(before);
    expect(financialYearLabel(2027)).toBe("2027/28");
  });
});
