import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { EmployeeRegister, HistoricalReviewIssue } from "../src/domain";
import { HistoricalReviewPanel } from "../src/HistoricalReviewPanel";
import { historicalCandidateKey } from "../src/historicalReview";

const candidate = {
  employeeAbbreviation: "EA",
  hours: 3.5,
  originatingMonth: "2025-03",
  originatingYear: 2025,
  sourceWorkbook: "Previous FY.xlsx",
  sourceWorkbookId: "previous-fy",
  sourceWorksheet: "Mar 25",
  sourceRow: 12,
  sourceColumn: 4,
  sourceCell: "D12",
  status: "carry" as const,
  fill: "#92D050" as const,
};

const issue: HistoricalReviewIssue = {
  key: "source|2025/26|historical|error|legacy",
  kind: "workbook-error",
  sourceRole: "historical",
  title: "Check an older workbook entry",
  summary: "Legacy parser wording",
  technicalEvidence: "Legacy parser wording",
  candidate,
};

const register: EmployeeRegister = { version: 1, employees: [] };

it("defensively exposes completed carry decisions for a structured historical fallback item", () => {
  const onChange = vi.fn();
  render(
    <HistoricalReviewPanel
      issues={[issue]}
      state={{ version: 1, employeeMappings: {}, issueResolutions: {} }}
      register={register}
      catalogue={[]}
      onChange={onChange}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Review older items" }));
  expect(
    screen.getByRole("button", {
      name: "Already dealt with — don't carry forward",
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Keep as Unknown Project carry" }),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Already dealt with — don't carry forward",
    }),
  );
  expect(onChange).toHaveBeenCalledWith({
    version: 1,
    employeeMappings: {},
    issueResolutions: {
      [historicalCandidateKey(candidate)]: { kind: "already-dealt-with" },
    },
  });
});
