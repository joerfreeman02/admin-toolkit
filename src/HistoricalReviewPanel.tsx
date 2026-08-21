import { useMemo, useState } from "react";
import type {
  EmployeeRegister,
  HistoricalIssueResolution,
  HistoricalReviewIssue,
  HistoricalReviewState,
  ProjectCatalogueItem,
} from "./domain";
import { latestEmployeeSnapshot } from "./employeeRegister";
import {
  formerEmployeeMapping,
  historicalCandidateKey,
  isStructuredMissingProjectCarry,
  normaliseHistoricalAbbreviation,
} from "./historicalReview";
import {
  createProjectSearchIndex,
  searchProjects,
  suggestProjects,
} from "./projectCatalogue";
import { monthLabel } from "./financialYear";

interface IssueCardProps {
  issue: HistoricalReviewIssue;
  position: number;
  total: number;
  register: EmployeeRegister;
  catalogue: ProjectCatalogueItem[];
  onMapEmployee: (abbreviation: string, employeeId: string) => void;
  onTreatFormer: (abbreviation: string) => void;
  onResolve: (key: string, decision: HistoricalIssueResolution) => void;
  onSkip: () => void;
}

function HistoricalIssueCard({
  issue,
  position,
  total,
  register,
  catalogue,
  onMapEmployee,
  onTreatFormer,
  onResolve,
  onSkip,
}: IssueCardProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const employees = latestEmployeeSnapshot(register, true);
  const projectIndex = useMemo(
    () => createProjectSearchIndex(catalogue),
    [catalogue],
  );
  const projectResults = useMemo(
    () =>
      projectSearch.trim()
        ? searchProjects(projectIndex, projectSearch, 8)
        : suggestProjects(issue.candidate?.projectDescription ?? "", catalogue),
    [
      projectIndex,
      projectSearch,
      issue.candidate?.projectDescription,
      catalogue,
    ],
  );
  const structuredMissingProjectCarry = isStructuredMissingProjectCarry(
    issue.candidate,
  );
  const canResolveProject =
    issue.kind === "project" || structuredMissingProjectCarry;
  const resolutionKey = structuredMissingProjectCarry
    ? historicalCandidateKey(issue.candidate!)
    : issue.key;

  return (
    <article className="guided-review-card">
      <div className="review-progress">
        <span>
          Item {position} of {total}
        </span>
        <strong>
          {total} item{total === 1 ? "" : "s"} left to review
        </strong>
      </div>
      <h4>{issue.title}</h4>
      <p>{issue.summary}</p>
      {issue.candidate && (
        <p className="muted">
          {issue.candidate.employeeAbbreviation} ·{" "}
          {monthLabel(issue.candidate.originatingMonth)} ·{" "}
          {issue.candidate.hours.toFixed(2)}h
        </p>
      )}
      {issue.kind === "employee" && issue.employeeAbbreviation && (
        <div className="review-action">
          <label>
            Employee
            <select
              aria-label={`Employee for ${issue.employeeAbbreviation}`}
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="">Choose an employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                  {employee.active ? "" : " (former employee)"}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            type="button"
            disabled={!employeeId}
            onClick={() =>
              onMapEmployee(issue.employeeAbbreviation!, employeeId)
            }
          >
            Save &amp; next
          </button>
          <button
            type="button"
            onClick={() => onTreatFormer(issue.employeeAbbreviation!)}
          >
            Treat as former employee
          </button>
        </div>
      )}
      {canResolveProject && (
        <div className="review-action">
          <label>
            Search projects
            <input
              aria-label="Project for carried hours"
              value={projectSearch}
              onChange={(event) => setProjectSearch(event.target.value)}
            />
          </label>
          <div className="project-search-results">
            {projectResults.map(({ project }, index) => (
              <button
                className={index === 0 ? "primary" : undefined}
                type="button"
                key={`${project.code}|${project.description}`}
                onClick={() =>
                  onResolve(resolutionKey, {
                    kind: "project",
                    projectCode: project.code,
                    projectDescription: project.description,
                  })
                }
              >
                Use {project.code} · {project.description}
              </button>
            ))}
          </div>
          <div className="review-resolution-actions">
            {issue.sourceRole === "historical" && (
              <button
                className="primary"
                type="button"
                onClick={() =>
                  onResolve(resolutionKey, { kind: "already-dealt-with" })
                }
              >
                Already dealt with — don&apos;t carry forward
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                onResolve(resolutionKey, { kind: "unknown-project-carry" })
              }
            >
              Keep as Unknown Project carry
            </button>
          </div>
        </div>
      )}
      {(issue.kind === "workbook-warning" ||
        issue.kind === "workbook-error") && (
        <p className="warning-line">
          This saved workbook entry needs checking before it can take part in
          carry-over. Open the original entry for the source information.
        </p>
      )}
      <div className="review-card-footer">
        <button type="button" onClick={onSkip}>
          Skip for now
        </button>
        <details className="source-details">
          <summary>View original entry</summary>
          <p>{issue.technicalEvidence}</p>
        </details>
      </div>
    </article>
  );
}

function useReviewPosition(issues: HistoricalReviewIssue[]) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const available = issues.filter((issue) => !skipped.includes(issue.key));
  const current = available[0] ?? issues[0];
  const position = current
    ? Math.max(1, issues.findIndex((issue) => issue.key === current.key) + 1)
    : 0;
  return {
    current,
    position,
    skip: () =>
      current &&
      setSkipped((items) =>
        issues.length > 1 ? [...items, current.key] : items,
      ),
  };
}

interface Props {
  issues: HistoricalReviewIssue[];
  state: HistoricalReviewState;
  register: EmployeeRegister;
  catalogue: ProjectCatalogueItem[];
  onChange: (state: HistoricalReviewState) => void;
}

export function HistoricalReviewPanel({
  issues,
  state,
  register,
  catalogue,
  onChange,
}: Props) {
  const [openQueue, setOpenQueue] = useState<"current" | "historical">();
  const currentIssues = useMemo(
    () => issues.filter((issue) => issue.sourceRole === "current"),
    [issues],
  );
  const olderIssues = useMemo(
    () => issues.filter((issue) => issue.sourceRole === "historical"),
    [issues],
  );
  const currentQueue = useReviewPosition(currentIssues);
  const olderQueue = useReviewPosition(olderIssues);

  const mapEmployee = (abbreviation: string, employeeId: string) =>
    onChange({
      ...state,
      employeeMappings: {
        ...state.employeeMappings,
        [normaliseHistoricalAbbreviation(abbreviation)]: employeeId,
      },
    });
  const treatFormer = (abbreviation: string) =>
    mapEmployee(abbreviation, formerEmployeeMapping(abbreviation));
  const resolve = (key: string, decision: HistoricalIssueResolution) =>
    onChange({
      ...state,
      issueResolutions: { ...state.issueResolutions, [key]: decision },
    });

  return (
    <section className="historical-review-area" aria-label="Carry-over checks">
      <div className="historical-summary">
        <div>
          <p className="eyebrow">This financial year</p>
          <h3>Current-year carry-over checks</h3>
          <p>
            These entries are still marked to carry forward in the current hours
            workbook.
          </p>
          <p>
            {currentIssues.length
              ? `${currentIssues.length} item${currentIssues.length === 1 ? " needs" : "s need"} checking.`
              : "All current carry-over checks complete ✓"}
          </p>
        </div>
        {currentQueue.current && (
          <button
            className="secondary-button"
            type="button"
            aria-expanded={openQueue === "current"}
            onClick={() =>
              setOpenQueue((queue) =>
                queue === "current" ? undefined : "current",
              )
            }
          >
            {openQueue === "current"
              ? "Hide current items"
              : "Review current items"}
          </button>
        )}
        {openQueue === "current" && currentQueue.current && (
          <HistoricalIssueCard
            key={currentQueue.current.key}
            issue={currentQueue.current}
            position={currentQueue.position}
            total={currentIssues.length}
            register={register}
            catalogue={catalogue}
            onMapEmployee={mapEmployee}
            onTreatFormer={treatFormer}
            onResolve={resolve}
            onSkip={currentQueue.skip}
          />
        )}
      </div>
      <div className="historical-summary">
        <div>
          <p className="eyebrow">Previous financial years</p>
          <h3>Older carry-over checks</h3>
          <p>
            These are older records that may still affect carry-over. You only
            need to review them once.
          </p>
          <p>
            {olderIssues.length
              ? `${olderIssues.length} older item${olderIssues.length === 1 ? " needs" : "s need"} checking.`
              : "Older carry-over records — all previously reviewed ✓"}
          </p>
        </div>
        {olderQueue.current && (
          <button
            className="secondary-button"
            type="button"
            aria-expanded={openQueue === "historical"}
            onClick={() =>
              setOpenQueue((queue) =>
                queue === "historical" ? undefined : "historical",
              )
            }
          >
            {openQueue === "historical"
              ? "Hide older items"
              : "Review older items"}
          </button>
        )}
        {openQueue === "historical" && olderQueue.current && (
          <HistoricalIssueCard
            key={olderQueue.current.key}
            issue={olderQueue.current}
            position={olderQueue.position}
            total={olderIssues.length}
            register={register}
            catalogue={catalogue}
            onMapEmployee={mapEmployee}
            onTreatFormer={treatFormer}
            onResolve={resolve}
            onSkip={olderQueue.skip}
          />
        )}
      </div>
    </section>
  );
}
