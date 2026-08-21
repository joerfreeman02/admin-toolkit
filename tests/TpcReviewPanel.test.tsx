import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import type { TpcReviewIssue } from "../src/domain";
import { TpcReviewPanel } from "../src/TpcReviewPanel";

function issue(projectManager?: string): TpcReviewIssue {
  return {
    key: "tpc|2026-07|Jul 2026|3",
    record: {
      key: "tpc|2026-07|Jul 2026|3",
      originatingMonth: "2026-07",
      originatingYear: 2026,
      supplier: "Review Supplier",
      projectManager,
      projectNumberRaw: "N/A",
      description: "Reviewable cost",
      net: { kind: "amount", amount: 100 },
      vat: { kind: "amount", amount: 20 },
      gross: { kind: "amount", amount: 120 },
      sourceFinancialYear: "2026/27",
      sourceWorkbook: "TPC.xlsx",
      sourceWorkbookId: "tpc-1",
      sourceWorksheet: "Jul 2026",
      sourceRow: 3,
      status: "outstanding",
      statusEvidence: "red-row",
    },
  };
}

function panel(
  projectManager?: string,
  warnings: string[] = [],
  warningRecords: TpcReviewIssue["record"][] = [],
) {
  return (
    <TpcReviewPanel
      issues={[issue(projectManager)]}
      state={{ version: 1, decisions: {} }}
      catalogue={[]}
      warnings={warnings}
      warningRecords={warningRecords}
      onChange={() => undefined}
    />
  );
}

it("shows reliable Project Manager context from an outstanding TPC source row", () => {
  render(panel("AB"));

  expect(screen.getByText("Project Manager: AB")).toBeVisible();
});

it("does not fabricate Project Manager context when the source row is blank", () => {
  render(panel());

  expect(screen.queryByText(/Project Manager:/)).not.toBeInTheDocument();
});

it("keeps amount warnings compact while exposing useful affected-cost context", () => {
  const record = issue("AB").record;
  render(panel("AB", ["Jul 2026 row 3: amounts do not reconcile"], [record]));

  fireEvent.click(
    screen.getByText("1 outstanding TPC amount may need checking"),
  );
  expect(
    screen.getByText(
      "These costs contain figures that don't add up exactly. NEXUS has kept the original amounts.",
    ),
  ).toBeVisible();
  fireEvent.click(screen.getByText("View affected costs"));
  expect(screen.getAllByText("Review Supplier")[0]).toBeVisible();
  expect(screen.getByText(/Project N\/A/)).toBeVisible();
  expect(
    screen.getByText(/Net 100\.00 · VAT 20\.00 · Gross 120\.00/),
  ).toBeVisible();
  expect(
    within(document.querySelector(".warning-summary")!).queryByText(/row 3/i),
  ).not.toBeInTheDocument();
});
