import { useMemo, useState } from "react";
import type {
  ProjectCatalogueItem,
  TpcReviewDecision,
  TpcReviewIssue,
  TpcReviewState,
} from "./domain";
import { createProjectSearchIndex, searchProjects } from "./projectCatalogue";
import { monthLabel } from "./financialYear";

interface Props {
  issues: TpcReviewIssue[];
  state: TpcReviewState;
  catalogue: ProjectCatalogueItem[];
  warnings: string[];
  warningRecords: TpcReviewIssue["record"][];
  onChange: (state: TpcReviewState) => void;
}

export function TpcReviewPanel({
  issues,
  state,
  catalogue,
  warnings,
  warningRecords,
  onChange,
}: Props) {
  const [deferred, setDeferred] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const issue =
    issues.find((item) => !deferred.includes(item.key)) ?? issues[0];
  const index = useMemo(() => createProjectSearchIndex(catalogue), [catalogue]);
  const results = useMemo(
    () => searchProjects(index, search, 8),
    [index, search],
  );

  function decide(decision: TpcReviewDecision) {
    if (!issue) return;
    onChange({
      version: 1,
      decisions: { ...state.decisions, [issue.key]: decision },
    });
    setDeferred((items) => items.filter((key) => key !== issue.key));
    setSearch("");
  }

  return (
    <section
      className="workflow-section historical-review-area"
      aria-labelledby="tpc-review-title"
    >
      <h3 id="tpc-review-title">Third Party Cost review</h3>
      <p className={issues.length ? "warning-line" : "success"}>
        {issues.length
          ? `${issues.length} TPC item${issues.length === 1 ? " needs" : "s need"} checking`
          : "No TPC items need checking."}
      </p>
      {!!warnings.length && (
        <details className="warning-summary">
          <summary>
            {warnings.length} outstanding TPC amount
            {warnings.length === 1 ? "" : "s"} may need checking
          </summary>
          <p>
            These costs contain figures that don&apos;t add up exactly. NEXUS
            has kept the original amounts.
          </p>
          <details>
            <summary>View affected costs</summary>
            <ul>
              {warningRecords.map((record) => (
                <li key={record.key}>
                  <strong>{record.supplier}</strong>
                  <p>
                    {record.originatingDate ??
                      monthLabel(record.originatingMonth)}
                    {record.projectNumberRaw
                      ? ` · Project ${record.projectNumberRaw}`
                      : ""}
                    {` · ${record.description}`}
                  </p>
                  <p>
                    Net {money(record.net)} · VAT {money(record.vat)} · Gross{" "}
                    {money(record.gross)}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        </details>
      )}
      {issue && (
        <article className="guided-review-card">
          <strong>{issue.record.supplier}</strong>
          <p>
            {monthLabel(issue.record.originatingMonth)} ·{" "}
            {issue.record.description}
          </p>
          {issue.record.projectManager && (
            <p>Project Manager: {issue.record.projectManager}</p>
          )}
          <p>
            Project number entered:{" "}
            {issue.record.projectNumberRaw ?? "Not provided"}
          </p>
          <details open>
            <summary>Assign to project</summary>
            <label>
              Project number, name, client or manager
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="project-search-results">
              {results.map(({ project }) => (
                <button
                  type="button"
                  key={`${project.code}|${project.description}`}
                  onClick={() =>
                    decide({
                      kind: "project",
                      projectCode: project.code,
                      projectDescription: project.description,
                    })
                  }
                >
                  <strong>
                    {project.code} · {project.description}
                  </strong>
                </button>
              ))}
            </div>
          </details>
          <div className="review-resolution-actions">
            <button
              type="button"
              onClick={() => decide({ kind: "non-project" })}
            >
              Mark as non-project cost
            </button>
            <button
              type="button"
              onClick={() => decide({ kind: "unallocated" })}
            >
              Leave unallocated
            </button>
            <button
              type="button"
              onClick={() =>
                setDeferred((items) =>
                  items.includes(issue.key) ? items : [...items, issue.key],
                )
              }
            >
              Skip for now
            </button>
          </div>
          <details className="source-details">
            <summary>View original entry</summary>
            <p>
              {issue.record.sourceWorkbook} · {issue.record.sourceWorksheet},
              row {issue.record.sourceRow}
            </p>
          </details>
        </article>
      )}
    </section>
  );
}

function money(value: TpcReviewIssue["record"]["net"]) {
  if (value.kind === "amount") return value.amount.toFixed(2);
  return value.kind === "text" ? value.text : "Not recorded";
}
