import { useMemo, useState } from "react";
import type {
  ProjectCatalogueItem,
  TimeEntry,
  UncodedReviewDecision,
} from "./domain";
import {
  isMeaningfulProjectDescription,
  suggestProjects,
} from "./projectCatalogue";

interface Props {
  entry: TimeEntry;
  catalogue: ProjectCatalogueItem[];
  decision?: UncodedReviewDecision;
  onDecision: (decision?: UncodedReviewDecision) => void;
}

export function UncodedReviewCard({
  entry,
  catalogue,
  decision,
  onDecision,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [uncodedName, setUncodedName] = useState(
    isMeaningfulProjectDescription(entry.description) ? entry.description : "",
  );
  const suggestions = useMemo(
    () => suggestProjects(entry.description, catalogue),
    [entry.description, catalogue],
  );
  const suggestion = suggestions[0]?.project;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return catalogue.slice(0, 100);
    return catalogue
      .filter(
        (project) =>
          project.code.includes(query) ||
          project.description.toLowerCase().includes(query),
      )
      .slice(0, 100);
  }, [catalogue, search]);
  const selected = catalogue.find(
    (project) => `${project.code}|${project.description}` === selectedKey,
  );

  return (
    <article
      className={`exception-card ${decision ? "resolved" : "unresolved"}`}
    >
      <div className="exception-heading">
        <div>
          <span>Employee entered</span>
          <strong>{entry.description}</strong>
        </div>
        <span className="decision-status">
          {decision ? "Decision recorded" : "Export blocker"}
        </span>
      </div>
      <dl className="exception-summary">
        <div>
          <dt>Employee</dt>
          <dd>{entry.employee}</dd>
        </div>
        <div>
          <dt>Hours</dt>
          <dd>{entry.hours.toFixed(2)}</dd>
        </div>
      </dl>
      {suggestion ? (
        <div className="suggestion-box">
          <span>Possible existing project</span>
          <strong>
            {suggestion.code} · {suggestion.description}
          </strong>
          <button
            className="primary"
            type="button"
            onClick={() =>
              onDecision({
                kind: "existing-project",
                projectCode: suggestion.code,
                projectDescription: suggestion.description,
              })
            }
          >
            Confirm this match
          </button>
          <small>
            This is an advisory suggestion only. Nothing is assigned until you
            confirm it.
          </small>
        </div>
      ) : (
        <p className="muted">No sufficiently close project suggestion found.</p>
      )}
      <details>
        <summary>Choose another existing project</summary>
        <div className="project-search">
          <label>
            Search by project number or name
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            Existing project
            <select
              value={selectedKey}
              onChange={(event) => setSelectedKey(event.target.value)}
            >
              <option value="">Select a project</option>
              {filtered.map((project) => {
                const value = `${project.code}|${project.description}`;
                return (
                  <option key={value} value={value}>
                    {project.code} · {project.description}
                  </option>
                );
              })}
            </select>
          </label>
          <button
            type="button"
            disabled={!selected}
            onClick={() =>
              selected &&
              onDecision({
                kind: "existing-project",
                projectCode: selected.code,
                projectDescription: selected.description,
              })
            }
          >
            Confirm selected project
          </button>
        </div>
      </details>
      <details>
        <summary>Keep as genuinely uncoded</summary>
        <p className="muted">
          Confirm a meaningful project name. Blank or generic entries cannot be
          combined without an explicit name.
        </p>
        <label>
          Approved uncoded project name
          <input
            value={uncodedName}
            onChange={(event) => setUncodedName(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!isMeaningfulProjectDescription(uncodedName)}
          onClick={() =>
            onDecision({
              kind: "genuine-uncoded",
              projectDescription: uncodedName.trim(),
            })
          }
        >
          Confirm genuinely uncoded
        </button>
      </details>
      {decision && (
        <div className="decision-record">
          <strong>Recorded decision</strong>
          <span>
            {decision.kind === "existing-project"
              ? `${decision.projectCode} · ${decision.projectDescription}`
              : `Genuinely uncoded · ${decision.projectDescription}`}
          </span>
          <button type="button" onClick={() => onDecision(undefined)}>
            Leave unresolved
          </button>
        </div>
      )}
      <details className="source-details">
        <summary>Show source details</summary>
        <p>
          {entry.trace.file} · {entry.trace.worksheet}, row {entry.trace.row}
        </p>
      </details>
    </article>
  );
}
