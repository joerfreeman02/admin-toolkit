import type { HistoricalReviewState, WorkbookCarryCandidate } from "./domain";

export const HISTORICAL_REVIEW_KEY = "eas-nexus-historical-review-v1";

export function normaliseHistoricalAbbreviation(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function emptyHistoricalReviewState(): HistoricalReviewState {
  return { version: 1, employeeMappings: {}, issueResolutions: {} };
}

export function historicalCandidateKey(candidate: WorkbookCarryCandidate) {
  return [
    "carry",
    candidate.originatingMonth,
    candidate.sourceWorksheet,
    candidate.sourceCell,
    normaliseHistoricalAbbreviation(candidate.employeeAbbreviation),
    candidate.hours,
    candidate.projectCode ?? "missing-project",
    candidate.projectDescription?.trim().toLowerCase() ?? "",
  ].join("|");
}

export function historicalEmployeeKey(abbreviation: string) {
  return `employee|${normaliseHistoricalAbbreviation(abbreviation)}`;
}

export function formerEmployeeMapping(abbreviation: string) {
  return `historical-former:${normaliseHistoricalAbbreviation(abbreviation)}`;
}

export function formerEmployeeAbbreviation(mapping: string) {
  return mapping.startsWith("historical-former:")
    ? mapping.slice("historical-former:".length)
    : undefined;
}

export function historicalSourceIssueKey(
  financialYear: string,
  role: string,
  kind: string,
  evidence: string,
) {
  return ["source", financialYear, role, kind, evidence].join("|");
}

export function loadHistoricalReviewState(): HistoricalReviewState {
  try {
    const value = localStorage.getItem(HISTORICAL_REVIEW_KEY);
    if (!value) return emptyHistoricalReviewState();
    const parsed = JSON.parse(value) as Partial<HistoricalReviewState>;
    if (parsed.version !== 1) return emptyHistoricalReviewState();
    return {
      version: 1,
      employeeMappings: parsed.employeeMappings ?? {},
      issueResolutions: parsed.issueResolutions ?? {},
    };
  } catch {
    return emptyHistoricalReviewState();
  }
}

export function saveHistoricalReviewState(state: HistoricalReviewState) {
  localStorage.setItem(HISTORICAL_REVIEW_KEY, JSON.stringify(state));
}
