import { useMemo, useState } from "react";
import type {
  InternalCatalogueItem,
  ProjectCatalogueItem,
  TimeEntry,
  UncodedReviewDecision,
} from "./domain";
import {
  createProjectSearchIndex,
  searchProjects,
  suggestsTimeInLieu,
  suggestInternalCategories,
  suggestProjects,
} from "./projectCatalogue";
import { monthLabel } from "./financialYear";

interface Props {
  entry: TimeEntry;
  catalogue: ProjectCatalogueItem[];
  internalCatalogue: InternalCatalogueItem[];
  decision?: UncodedReviewDecision;
  onDecision: (decision?: UncodedReviewDecision) => void;
  onSkip: () => void;
  onDownloadOriginal?: () => void;
}

export function UncodedReviewCard({
  entry,
  catalogue,
  internalCatalogue,
  onDecision,
  onSkip,
  onDownloadOriginal,
}: Props) {
  const [search, setSearch] = useState("");
  const [excludeReason, setExcludeReason] = useState("");
  const [showRows, setShowRows] = useState(false);
  const projectIndex = useMemo(
    () => createProjectSearchIndex(catalogue),
    [catalogue],
  );
  const suggestions = useMemo(
    () => suggestProjects(entry.description, catalogue),
    [entry.description, catalogue],
  );
  const internalSuggestions = useMemo(
    () => suggestInternalCategories(entry.description, internalCatalogue),
    [entry.description, internalCatalogue],
  );
  const timeInLieuSuggested = useMemo(
    () => suggestsTimeInLieu(entry.description),
    [entry.description],
  );
  const searchResults = useMemo(
    () => searchProjects(projectIndex, search, 8),
    [projectIndex, search],
  );
  const context = entry.sourceContext;
  const strongestProject = suggestions[0];
  const showInternalFirst =
    !!internalSuggestions[0] &&
    (!strongestProject || strongestProject.score < 0.85);

  const acceptInternal = (item: InternalCatalogueItem) =>
    onDecision({
      kind: "internal",
      internalCode: item.code,
      internalCategory: item.description,
    });
  const acceptProject = (project: ProjectCatalogueItem) =>
    onDecision({
      kind: "existing-project",
      projectCode: project.code,
      projectDescription: project.description,
    });

  const timeInLieuBox = timeInLieuSuggested && (
    <div className="suggestion-box internal-suggestion">
      <span>Likely match</span>
      <strong>Time in Lieu</strong>
      <small>
        Suggested because the entry says “in lieu”. Nothing changes until you
        choose this action.
      </small>
      <button
        className="primary"
        type="button"
        onClick={() => onDecision({ kind: "time-in-lieu" })}
      >
        Use Time in Lieu
      </button>
    </div>
  );

  const internalBox = internalSuggestions[0] && (
    <div className="suggestion-box internal-suggestion">
      <span>Possible internal match</span>
      <strong>
        {internalSuggestions[0].item.code
          ? `${internalSuggestions[0].item.code} · `
          : ""}
        {internalSuggestions[0].item.description}
      </strong>
      <small>
        Suggested from the employee wording. Nothing is changed until you choose
        this action.
      </small>
      <button
        className="primary"
        type="button"
        onClick={() => acceptInternal(internalSuggestions[0].item)}
      >
        Use {internalSuggestions[0].item.description}
      </button>
    </div>
  );

  const projectBox = suggestions.length > 0 && (
    <div className="suggestion-box">
      <span>Suggested projects</span>
      {suggestions.map(({ project }, index) => (
        <div
          className="suggested-project"
          key={`${project.code}|${project.description}`}
        >
          <strong>
            {project.code} · {project.description}
          </strong>
          {(project.client ||
            project.projectManager ||
            project.projectDirector) && (
            <small>
              {[project.client, project.projectManager, project.projectDirector]
                .filter(Boolean)
                .join(" · ")}
            </small>
          )}
          <button
            className={
              index === 0 && !showInternalFirst ? "primary" : undefined
            }
            type="button"
            onClick={() => acceptProject(project)}
          >
            Use this project
          </button>
        </div>
      ))}
      <small>
        Suggestions are advisory and are never assigned automatically.
      </small>
    </div>
  );

  return (
    <article className="exception-card unresolved">
      <div className="exception-heading">
        <div>
          <span>
            {entry.employee} — {entry.hours.toFixed(2)}h
          </span>
          <strong>Entered as: {entry.description}</strong>
        </div>
        <span className="decision-status">Needs a decision</span>
      </div>

      {timeInLieuBox}
      {showInternalFirst ? internalBox : projectBox}
      {showInternalFirst ? projectBox : internalBox}
      {!suggestions.length &&
        !internalSuggestions.length &&
        !timeInLieuSuggested && (
          <p className="muted">No confident suggestion was found.</p>
        )}

      <details>
        <summary>Search projects</summary>
        <div className="project-search">
          <label>
            Project number, name, client or manager
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {search.trim() && !searchResults.length && (
            <p className="muted">No matching projects found.</p>
          )}
          <div className="project-search-results">
            {searchResults.map(({ project }) => (
              <button
                type="button"
                key={`${project.code}|${project.description}`}
                onClick={() => acceptProject(project)}
              >
                <strong>
                  {project.code} · {project.description}
                </strong>
                <span>
                  {[
                    project.client,
                    project.projectManager,
                    project.projectDirector,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            ))}
          </div>
        </div>
      </details>

      <div className="review-resolution-actions">
        <button
          type="button"
          onClick={() => onDecision({ kind: "unknown-project" })}
        >
          Leave as Unknown Project
        </button>
        <button
          type="button"
          onClick={() =>
            onDecision({
              kind: "excluded",
              reason: excludeReason.trim() || undefined,
            })
          }
        >
          Exclude these hours
        </button>
        <button className="skip-button" type="button" onClick={onSkip}>
          Skip for now
        </button>
      </div>
      <details>
        <summary>Add an exclusion reason (optional)</summary>
        <label>
          Reason retained in the private audit
          <input
            value={excludeReason}
            onChange={(event) => setExcludeReason(event.target.value)}
          />
        </label>
      </details>

      <details className="source-details">
        <summary>Open original entry</summary>
        <dl className="source-context-grid">
          <div>
            <dt>Employee</dt>
            <dd>{context?.employee ?? entry.employee}</dd>
          </div>
          <div>
            <dt>Month</dt>
            <dd>{monthLabel(context?.month ?? entry.reportingMonth)}</dd>
          </div>
          <div>
            <dt>Recorded hours</dt>
            <dd>{(context?.recordedHours ?? entry.hours).toFixed(2)}</dd>
          </div>
          <div>
            <dt>Project number</dt>
            <dd>{context?.originalProjectNumber ?? "Not provided"}</dd>
          </div>
          <div>
            <dt>Original wording</dt>
            <dd>{context?.originalDescription ?? entry.description}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              {entry.trace.file} · {entry.trace.worksheet}, row{" "}
              {entry.trace.row}
            </dd>
          </div>
        </dl>
        {!!context?.dailyHours.length && (
          <p>
            Recorded days:{" "}
            {context.dailyHours
              .map((item) => `day ${item.day}: ${item.hours}h`)
              .join(" · ")}
          </p>
        )}
        {!!context?.surroundingRows.length && (
          <>
            <button
              type="button"
              onClick={() => setShowRows((value) => !value)}
            >
              {showRows ? "Hide surrounding rows" : "View surrounding rows"}
            </button>
            {showRows && (
              <table className="source-row-context">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Project</th>
                    <th>Description</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {context.surroundingRows.map((row) => (
                    <tr key={row.row}>
                      <td>{row.row}</td>
                      <td>{row.projectNumber ?? "—"}</td>
                      <td>{row.description ?? "—"}</td>
                      <td>{row.hours ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
        {onDownloadOriginal && (
          <button type="button" onClick={onDownloadOriginal}>
            Download original timesheet
          </button>
        )}
      </details>
    </article>
  );
}
