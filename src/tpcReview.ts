import type { TpcReviewState } from "./domain";

export const TPC_REVIEW_KEY = "eas-nexus-tpc-review-v1";

export function emptyTpcReviewState(): TpcReviewState {
  return { version: 1, decisions: {} };
}

export function loadTpcReviewState(): TpcReviewState {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(TPC_REVIEW_KEY) ?? "null",
    ) as Partial<TpcReviewState> | null;
    return parsed?.version === 1
      ? { version: 1, decisions: parsed.decisions ?? {} }
      : emptyTpcReviewState();
  } catch {
    return emptyTpcReviewState();
  }
}

export function saveTpcReviewState(state: TpcReviewState) {
  localStorage.setItem(TPC_REVIEW_KEY, JSON.stringify(state));
}
