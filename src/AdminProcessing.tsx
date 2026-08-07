import { useMemo, useState } from "react";
import type {
  Department,
  EmployeeRegister,
  Grade,
  ProcessingResult,
} from "./domain";
import {
  applyUncodedApprovals,
  consolidateEntries,
  entryReviewKey,
  missingRegisteredEmployees,
} from "./consolidation";
import { EmployeeRegisterPanel } from "./EmployeeRegisterPanel";
import {
  DEPARTMENTS,
  GRADES,
  addAlias,
  addEmployee,
  employeeSnapshot,
} from "./employeeRegister";
import { processUploads } from "./processing";
import {
  downloadWorkbook,
  generateInternalWorkbook,
  generateProjectWorkbook,
  internalWorkbookFilename,
  projectWorkbookFilename,
} from "./workbookExport";

interface Props {
  logout: () => void;
  register: EmployeeRegister;
  onRegisterChange: (register: EmployeeRegister) => void;
}

function UnknownEmployeeResolver({
  sourceName,
  register,
  month,
  onChange,
}: {
  sourceName: string;
  register: EmployeeRegister;
  month: string;
  onChange: (register: EmployeeRegister) => void;
}) {
  const [matchId, setMatchId] = useState("");
  const [department, setDepartment] = useState<Department>("Drainage");
  const [grade, setGrade] = useState<Grade>("Engineer");
  const [abbreviation, setAbbreviation] = useState("");
  const existing = employeeSnapshot(register, month);
  return (
    <article className="resolution-card">
      <strong>New employee detected</strong>
      <p>{sourceName}</p>
      <div className="resolver-grid">
        <label>
          Match an existing employee
          <select
            value={matchId}
            onChange={(event) => setMatchId(event.target.value)}
          >
            <option value="">Select employee</option>
            {existing.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!matchId}
          onClick={() => onChange(addAlias(register, matchId, sourceName))}
        >
          Confirm match
        </button>
      </div>
      <details>
        <summary>Create a new register entry</summary>
        <div className="form-grid compact-form">
          <label>
            Department
            <select
              value={department}
              onChange={(event) =>
                setDepartment(event.target.value as Department)
              }
            >
              {DEPARTMENTS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Grade
            <select
              value={grade}
              onChange={(event) => setGrade(event.target.value as Grade)}
            >
              {GRADES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Approved abbreviation
            <input
              value={abbreviation}
              onChange={(event) => setAbbreviation(event.target.value)}
            />
          </label>
          <button
            className="primary"
            type="button"
            disabled={!abbreviation.trim()}
            onClick={() =>
              onChange(
                addEmployee(register, {
                  fullName: sourceName,
                  aliases: [sourceName],
                  effectiveFrom: month,
                  department,
                  grade,
                  abbreviation,
                }),
              )
            }
          >
            Create employee
          </button>
        </div>
      </details>
    </article>
  );
}

export function AdminProcessing({ logout, register, onRegisterChange }: Props) {
  const [month, setMonth] = useState("2026-07");
  const [files, setFiles] = useState<File[]>([]);
  const [template, setTemplate] = useState<File>();
  const [result, setResult] = useState<ProcessingResult>();
  const [approvals, setApprovals] = useState<Set<string>>(new Set());
  const [descriptionResolutions, setDescriptionResolutions] = useState<
    Record<string, string>
  >({});
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"project" | "internal">();
  const [message, setMessage] = useState("");
  const reviewedEntries = useMemo(
    () => (result ? applyUncodedApprovals(result.entries, approvals) : []),
    [result, approvals],
  );
  const exceptionEntries = useMemo(
    () =>
      result?.entries.filter((entry) => entry.classification === "exception") ??
      [],
    [result],
  );
  const consolidated = useMemo(
    () =>
      consolidateEntries(
        reviewedEntries,
        register,
        month,
        new Map(Object.entries(descriptionResolutions)),
      ),
    [reviewedEntries, register, month, descriptionResolutions],
  );
  const missingEmployees = useMemo(
    () =>
      result
        ? missingRegisteredEmployees(result.employees, register, month)
        : [],
    [result, register, month],
  );

  async function run() {
    setBusy(true);
    setMessage("");
    setApprovals(new Set());
    setDescriptionResolutions({});
    try {
      setResult(await processUploads(files, month));
    } finally {
      setBusy(false);
    }
  }

  function toggleApproval(key: string, approved: boolean) {
    setApprovals((current) => {
      const next = new Set(current);
      if (approved) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function exportProject() {
    if (!template) return;
    setExporting("project");
    setMessage("");
    try {
      const data = await generateProjectWorkbook(
        consolidated,
        await template.arrayBuffer(),
        __BUILD_ID__,
      );
      downloadWorkbook(data, projectWorkbookFilename(month));
      setMessage("Project-hours workbook generated locally.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Project export failed.",
      );
    } finally {
      setExporting(undefined);
    }
  }

  async function exportInternal() {
    setExporting("internal");
    setMessage("");
    try {
      const data = await generateInternalWorkbook(
        consolidated,
        reviewedEntries,
        register,
        __BUILD_ID__,
      );
      downloadWorkbook(data, internalWorkbookFilename(month));
      setMessage("Protected Internal Hours workbook generated locally.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Internal export failed.",
      );
    } finally {
      setExporting(undefined);
    }
  }

  return (
    <section className="panel admin-workflow">
      <div className="title-row">
        <div>
          <p className="eyebrow">Protected administrative area</p>
          <h2>Monthly timesheet consolidation</h2>
          <p className="lead">
            Process source files locally, review every exception, reconcile all
            hours, then generate separate project and internal workbooks.
          </p>
        </div>
        <button onClick={logout}>Logout / reset</button>
      </div>
      <div className="notice">
        Confidential files remain in this browser session. Never upload source
        timesheets, employee records, generated outputs or rates to GitHub.
      </div>

      <section className="workflow-section" aria-labelledby="month-title">
        <div className="section-heading">
          <span className="step-number">1</span>
          <div>
            <p className="eyebrow">Reporting period</p>
            <h3 id="month-title">Select reporting month</h3>
          </div>
        </div>
        <label className="field-width">
          Reporting month
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
      </section>

      <EmployeeRegisterPanel
        register={register}
        month={month}
        onChange={onRegisterChange}
      />

      <section className="workflow-section" aria-labelledby="template-title">
        <div className="section-heading">
          <span className="step-number">3</span>
          <div>
            <p className="eyebrow">Formatting reference</p>
            <h3 id="template-title">Select Hours for Invoicing workbook</h3>
          </div>
        </div>
        <label className="file-drop field-width">
          Workbook / template
          <input
            aria-label="Hours for Invoicing template"
            type="file"
            accept=".xlsx"
            onChange={(event) => setTemplate(event.target.files?.[0])}
          />
        </label>
        {template && (
          <p className="file-confirmed">Template selected: {template.name}</p>
        )}
      </section>

      <section className="workflow-section" aria-labelledby="timesheets-title">
        <div className="section-heading">
          <span className="step-number">4</span>
          <div>
            <p className="eyebrow">Local source files</p>
            <h3 id="timesheets-title">Upload timesheets or ZIP</h3>
          </div>
        </div>
        <div className="controls">
          <label className="file-drop">
            Timesheets or ZIP
            <input
              aria-label="Timesheets or ZIP"
              type="file"
              multiple
              accept=".xlsx,.zip"
              onChange={(event) => setFiles([...(event.target.files ?? [])])}
            />
          </label>
          <button
            className="primary"
            disabled={!files.length || busy}
            onClick={run}
          >
            {busy ? "Processing locally..." : "Process locally"}
          </button>
        </div>
        {!!files.length && (
          <ul className="file-list">
            {files.map((file) => (
              <li key={`${file.name}-${file.size}`}>
                <span>{file.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setFiles(files.filter((item) => item !== file))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {result && (
        <>
          <section className="workflow-section" aria-labelledby="review-title">
            <div className="section-heading">
              <span className="step-number">5-6</span>
              <div>
                <p className="eyebrow">Controlled review</p>
                <h3 id="review-title">
                  Review employees, warnings and exceptions
                </h3>
              </div>
            </div>
            {consolidated.unknownEmployees.map((sourceName) => (
              <UnknownEmployeeResolver
                key={sourceName}
                sourceName={sourceName}
                register={register}
                month={month}
                onChange={onRegisterChange}
              />
            ))}
            {!!missingEmployees.length && (
              <div className="warning">
                <h4>Missing registered timesheets</h4>
                <p>{missingEmployees.join(", ")}</p>
              </div>
            )}
            {!!result.blankTimesheets.length && (
              <div className="warning">
                <h4>Blank timesheets</h4>
                <p>{result.blankTimesheets.join(", ")}</p>
              </div>
            )}
            {!!result.warnings.length && (
              <details className="warning" open>
                <summary>
                  Processing warnings ({result.warnings.length})
                </summary>
                <ul>
                  {result.warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              </details>
            )}
            {!!result.fatalErrors.length && (
              <div className="error-box">
                <h4>Files that could not be processed</h4>
                <ul>
                  {result.fatalErrors.map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            {!!exceptionEntries.length && (
              <div className="exception-list">
                <h4>Uncoded entries requiring an explicit decision</h4>
                {exceptionEntries.map((entry) => {
                  const key = entryReviewKey(entry);
                  return (
                    <label key={key} className="exception-card">
                      <input
                        type="checkbox"
                        checked={approvals.has(key)}
                        onChange={(event) =>
                          toggleApproval(key, event.target.checked)
                        }
                      />
                      <span>
                        <strong>{entry.description}</strong>
                        <small>
                          {entry.employee} - {entry.hours.toFixed(2)} hours -{" "}
                          {entry.trace.worksheet}, row {entry.trace.row}
                        </small>
                        <span>
                          Approve as an uncoded project for this processing run
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {!!consolidated.descriptionConflicts.length && (
              <div className="description-conflicts">
                <h4>Resolve conflicting project descriptions</h4>
                <p>
                  Select the canonical description for this processing run.
                  Source records remain unchanged and are retained in the
                  protected audit workbook.
                </p>
                {consolidated.descriptionConflicts.map((conflict) => (
                  <article
                    className={`resolution-card conflict-resolution ${
                      conflict.resolved ? "resolved" : "unresolved"
                    }`}
                    key={conflict.projectCode}
                  >
                    <div className="conflict-heading">
                      <strong>Project {conflict.projectCode}</strong>
                      <span>
                        {conflict.resolved ? "Resolved" : "Export blocker"}
                      </span>
                    </div>
                    <label>
                      Canonical description
                      <select
                        aria-label={`Canonical description for project ${conflict.projectCode}`}
                        value={
                          descriptionResolutions[conflict.projectCode] ?? ""
                        }
                        onChange={(event) =>
                          setDescriptionResolutions((current) => ({
                            ...current,
                            [conflict.projectCode]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select an observed description</option>
                        {conflict.descriptions.map((description) => (
                          <option key={description} value={description}>
                            {description}
                          </option>
                        ))}
                      </select>
                    </label>
                    <details>
                      <summary>Protected source context</summary>
                      {conflict.sources.map((source) => (
                        <div
                          className="conflict-source"
                          key={source.description}
                        >
                          <strong>{source.description}</strong>
                          <ul>
                            {source.traces.map((trace) => (
                              <li
                                key={`${trace.file}|${trace.worksheet}|${trace.row}`}
                              >
                                {trace.file} - {trace.worksheet}, row{" "}
                                {trace.row}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </details>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section
            className="workflow-section"
            aria-labelledby="reconciliation-title"
          >
            <div className="section-heading">
              <span className="step-number">7</span>
              <div>
                <p className="eyebrow">Control total</p>
                <h3 id="reconciliation-title">Confirm reconciliation</h3>
              </div>
            </div>
            <div className="metrics">
              <article>
                <span>Files</span>
                <strong>{result.filesSupplied}</strong>
              </article>
              <article>
                <span>Employees</span>
                <strong>{result.employees.length}</strong>
              </article>
              <article>
                <span>Project</span>
                <strong>{consolidated.projectHours.toFixed(2)}</strong>
              </article>
              <article>
                <span>Internal</span>
                <strong>{consolidated.internalHours.toFixed(2)}</strong>
              </article>
              <article>
                <span>Exceptions</span>
                <strong>{consolidated.exceptionHours.toFixed(2)}</strong>
              </article>
              <article>
                <span>Total</span>
                <strong>{consolidated.importedHours.toFixed(2)}</strong>
              </article>
            </div>
            <p className={consolidated.reconciles ? "success" : "error"}>
              Reconciliation: {consolidated.reconciles ? "passed" : "failed"} -
              project + internal + exceptions = imported total
            </p>
            {consolidated.sourceDiscrepancyCount > 0 && (
              <p className="warning-line">
                {consolidated.sourceDiscrepancyCount} source row(s) have a
                column-D / daily-cell difference. Column D is retained as the
                audited source value; both values remain in protected trace
                data.
              </p>
            )}
            {!!consolidated.blockers.length && (
              <div className="error-box" role="alert">
                <h4>Export blockers</h4>
                <ul>
                  {consolidated.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="workflow-section" aria-labelledby="output-title">
            <div className="section-heading">
              <span className="step-number">8-9</span>
              <div>
                <p className="eyebrow">Separate protected outputs</p>
                <h3 id="output-title">Generate Excel workbooks</h3>
              </div>
            </div>
            <div className="output-grid">
              <article>
                <h4>Hours for Invoicing</h4>
                <p>
                  Coded projects followed by explicitly approved uncoded
                  projects. Internal hours never enter this workbook.
                </p>
                <button
                  className="primary"
                  disabled={!consolidated.canExport || !template || !!exporting}
                  onClick={exportProject}
                >
                  {exporting === "project"
                    ? "Generating..."
                    : "Generate Project Hours workbook"}
                </button>
                {!template && (
                  <small>Select the current workbook/template first.</small>
                )}
              </article>
              <article className="internal-output">
                <h4>Internal Hours</h4>
                <p>
                  Confidential internal categories, employee totals,
                  reconciliation and protected source audit.
                </p>
                <button
                  className="primary"
                  disabled={!consolidated.canExport || !!exporting}
                  onClick={exportInternal}
                >
                  {exporting === "internal"
                    ? "Generating..."
                    : "Generate Internal Hours workbook"}
                </button>
              </article>
            </div>
            {message && (
              <p className="status-message" role="status">
                {message}
              </p>
            )}
          </section>

          <section className="workflow-section preview-section">
            <h3>Protected consolidation preview</h3>
            <div className="split">
              <div>
                <h4>Project rows ({consolidated.projects.length})</h4>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Description</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consolidated.projects.map((project) => (
                        <tr key={project.key}>
                          <td>{project.code ?? "Approved uncoded"}</td>
                          <td>{project.description}</td>
                          <td>{project.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h4>Internal rows ({consolidated.internal.length})</h4>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Description</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consolidated.internal.map((item) => (
                        <tr key={item.key}>
                          <td>{item.code ?? "Configured"}</td>
                          <td>{item.description}</td>
                          <td>{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
