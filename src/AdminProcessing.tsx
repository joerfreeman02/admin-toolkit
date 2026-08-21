import { useEffect, useMemo, useState } from "react";
import type {
  Department,
  DescriptionConflict,
  EmployeeRegister,
  Grade,
  HistoricalReviewState,
  ProcessingResult,
  StoredFinancialYearWorkbook,
  StoredJobRegister,
  TimeEntry,
  UncodedReviewDecision,
} from "./domain";
import {
  applyUncodedDecisions,
  consolidateEntries,
  entryReviewKey,
  missingRegisteredEmployees,
} from "./consolidation";
import { LatestMonthlyWorkbookPanel } from "./LatestMonthlyWorkbookPanel";
import { JobRegisterPanel } from "./JobRegisterPanel";
import { HistoricalReviewPanel } from "./HistoricalReviewPanel";
import { EmployeePublicationPanel } from "./EmployeePublicationPanel";
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
  inspectLatestMonthlyWorkbook,
  resolveHistoricalCarry,
} from "./monthlyWorkbook";
import {
  financialYearForMonth,
  isAprilProcessingMonth,
  planFinancialYearRollover,
  workbookRoleForUpload,
  monthLabel,
} from "./financialYear";
import {
  loadHistoricalReviewState,
  saveHistoricalReviewState,
} from "./historicalReview";
import {
  listFinancialYearWorkbooks,
  loadJobRegister,
  saveJobRegister,
  saveFinancialYearWorkbook,
} from "./workstationStore";
import {
  catalogueFromAnnualWorkbook,
  catalogueFromCurrentEntries,
  internalCatalogueFromAnnualWorkbook,
  internalCatalogueFromEntries,
  mergeProjectCatalogues,
  mergeInternalCatalogues,
} from "./projectCatalogue";
import { parseJobRegister } from "./jobRegister";
import { UncodedReviewCard } from "./UncodedReviewCard";
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

type CurrentReviewItem =
  | { kind: "employee"; key: string; sourceName: string }
  | { kind: "uncoded"; key: string; entry: TimeEntry }
  | { kind: "description"; key: string; conflict: DescriptionConflict };

function operatorWarning(warning: string, entries: TimeEntry[]) {
  if (warning.includes("column-D total differs from daily hours")) {
    const row = warning.match(/row (\d+)/i)?.[1];
    const file = warning.split(" row ")[0];
    const entry = entries.find(
      (item) => item.trace.file === file && String(item.trace.row) === row,
    );
    return entry
      ? `${entry.employee}'s timesheet contains a total that does not match the daily entries. NEXUS has kept the recorded total. Open the original entry if you need to check it.`
      : "A timesheet contains a total that does not match the daily entries. NEXUS has kept the recorded total. Open the original entry if you need to check it.";
  }
  if (warning.includes("invalid hours"))
    return "A timesheet contains an hours value NEXUS could not read. Open the original entry and check the recorded hours.";
  if (warning.includes("requested month not found"))
    return "A supplied timesheet does not contain the selected month. Check that the correct file was added.";
  return "NEXUS found something in a supplied timesheet that may need checking. Open the details if you need the original file and row.";
}

function UnknownEmployeeResolver({
  sourceName,
  register,
  month,
  onChange,
  onResolved,
}: {
  sourceName: string;
  register: EmployeeRegister;
  month: string;
  onChange: (register: EmployeeRegister) => void;
  onResolved: () => void;
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
          onClick={() => {
            onChange(addAlias(register, matchId, sourceName));
            onResolved();
          }}
        >
          Save &amp; next
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
            onClick={() => {
              onChange(
                addEmployee(register, {
                  fullName: sourceName,
                  aliases: [sourceName],
                  effectiveFrom: month,
                  department,
                  grade,
                  abbreviation,
                }),
              );
              onResolved();
            }}
          >
            Save &amp; continue
          </button>
        </div>
      </details>
    </article>
  );
}

function DescriptionConflictReview({
  conflict,
  onSave,
  onSkip,
}: {
  conflict: DescriptionConflict;
  onSave: (description: string) => void;
  onSkip: () => void;
}) {
  const [description, setDescription] = useState("");
  return (
    <article className="guided-review-card">
      <h4>Choose the project name to use</h4>
      <p>
        Project {conflict.projectCode} appears with more than one name this
        month.
      </p>
      <label>
        Project name
        <select
          aria-label={`Canonical description for project ${conflict.projectCode}`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        >
          <option value="">Choose the correct name</option>
          {conflict.descriptions.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <div className="button-row">
        <button
          className="primary"
          type="button"
          disabled={!description}
          onClick={() => onSave(description)}
        >
          Save &amp; next
        </button>
        <button type="button" onClick={onSkip}>
          Skip for now
        </button>
      </div>
      <details>
        <summary>Open original entries</summary>
        {conflict.sources.map((source) => (
          <div className="conflict-source" key={source.description}>
            <strong>{source.description}</strong>
            <ul>
              {source.traces.map((trace) => (
                <li key={`${trace.file}|${trace.worksheet}|${trace.row}`}>
                  {trace.file} · {trace.worksheet}, row {trace.row}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </article>
  );
}

export function AdminProcessing({ logout, register, onRegisterChange }: Props) {
  const [month, setMonth] = useState("2026-07");
  const [files, setFiles] = useState<File[]>([]);
  const [workbooks, setWorkbooks] = useState<StoredFinancialYearWorkbook[]>([]);
  const [workbooksLoaded, setWorkbooksLoaded] = useState(false);
  const [workbookLoading, setWorkbookLoading] = useState(false);
  const [workbookMessage, setWorkbookMessage] = useState("");
  const [jobRegister, setJobRegister] = useState<StoredJobRegister>();
  const [jobRegisterLoaded, setJobRegisterLoaded] = useState(false);
  const [jobRegisterLoading, setJobRegisterLoading] = useState(false);
  const [jobRegisterMessage, setJobRegisterMessage] = useState("");
  const [result, setResult] = useState<ProcessingResult>();
  const [uncodedDecisions, setUncodedDecisions] = useState<
    Record<string, UncodedReviewDecision>
  >({});
  const [descriptionResolutions, setDescriptionResolutions] = useState<
    Record<string, string>
  >({});
  const [historicalReview, setHistoricalReview] =
    useState<HistoricalReviewState>(loadHistoricalReviewState);
  const [deferredReviewKeys, setDeferredReviewKeys] = useState<string[]>([]);
  const [reviewSession, setReviewSession] = useState({
    total: 0,
    visitedKeys: [] as string[],
  });
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"project" | "internal">();
  const [message, setMessage] = useState("");
  const rollover = useMemo(
    () => planFinancialYearRollover(month, workbooks),
    [month, workbooks],
  );
  const currentWorkbook = rollover.current;
  const historicalWorkbooks = useMemo(
    () =>
      workbooks
        .filter(
          (item) => item.financialYear !== rollover.processingFinancialYear,
        )
        .sort((a, b) => b.financialYear.localeCompare(a.financialYear)),
    [workbooks, rollover.processingFinancialYear],
  );
  const exportSource =
    currentWorkbook ??
    (rollover.needsInitialisation ? rollover.previous : undefined);
  const annualCatalogue = useMemo(
    () =>
      currentWorkbook?.projectCatalogue ?? exportSource?.projectCatalogue ?? [],
    [currentWorkbook, exportSource],
  );
  const annualInternalCatalogue = useMemo(
    () =>
      currentWorkbook?.internalCatalogue ??
      exportSource?.internalCatalogue ??
      [],
    [currentWorkbook, exportSource],
  );

  useEffect(() => {
    let active = true;
    listFinancialYearWorkbooks()
      .then((stored) => {
        if (active) setWorkbooks(stored);
      })
      .catch(() => {
        if (active)
          setWorkbookMessage(
            "Saved workbooks could not be opened. Refresh and try again.",
          );
      })
      .finally(() => {
        if (active) setWorkbooksLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    loadJobRegister()
      .then((stored) => {
        if (active) setJobRegister(stored);
      })
      .catch(() => {
        if (active)
          setJobRegisterMessage(
            "The saved Job Register could not be opened. Choose the latest copy again.",
          );
      })
      .finally(() => {
        if (active) setJobRegisterLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(
    () => saveHistoricalReviewState(historicalReview),
    [historicalReview],
  );
  const reviewedEntries = useMemo(
    () =>
      result
        ? applyUncodedDecisions(
            result.entries,
            new Map(Object.entries(uncodedDecisions)),
          )
        : [],
    [result, uncodedDecisions],
  );
  const exceptionEntries = useMemo(
    () =>
      result?.entries.filter((entry) => entry.classification === "exception") ??
      [],
    [result],
  );
  const projectCatalogue = useMemo(
    () =>
      mergeProjectCatalogues(
        catalogueFromCurrentEntries(result?.entries ?? []),
        annualCatalogue,
        jobRegister?.projects ?? [],
      ),
    [result, annualCatalogue, jobRegister],
  );
  const internalCatalogue = useMemo(
    () =>
      mergeInternalCatalogues(
        internalCatalogueFromEntries(result?.entries ?? []),
        annualInternalCatalogue,
      ),
    [result, annualInternalCatalogue],
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
  const carryResolution = useMemo(
    () =>
      resolveHistoricalCarry(
        workbooks.map((item) => item.inspection),
        register,
        month,
        historicalReview,
      ),
    [workbooks, register, month, historicalReview],
  );
  const currentReviewItems = useMemo<CurrentReviewItem[]>(
    () => [
      ...consolidated.unknownEmployees.map((sourceName) => ({
        kind: "employee" as const,
        key: `employee|${sourceName}`,
        sourceName,
      })),
      ...exceptionEntries
        .filter((entry) => !uncodedDecisions[entryReviewKey(entry)])
        .map((entry) => ({
          kind: "uncoded" as const,
          key: `uncoded|${entryReviewKey(entry)}`,
          entry,
        })),
      ...consolidated.descriptionConflicts
        .filter((conflict) => !conflict.resolved)
        .map((conflict) => ({
          kind: "description" as const,
          key: `description|${conflict.projectCode}`,
          conflict,
        })),
    ],
    [
      consolidated.unknownEmployees,
      consolidated.descriptionConflicts,
      exceptionEntries,
      uncodedDecisions,
    ],
  );
  const reviewItem =
    currentReviewItems.find((item) => !deferredReviewKeys.includes(item.key)) ??
    currentReviewItems[0];
  const reviewTotal = reviewSession.total || currentReviewItems.length;
  const reviewPosition = reviewItem
    ? Math.min(reviewSession.visitedKeys.length + 1, reviewTotal)
    : 0;
  const revisitingSkippedItem =
    !!reviewItem && reviewSession.visitedKeys.includes(reviewItem.key);

  useEffect(() => {
    if (!result) {
      setReviewSession({ total: 0, visitedKeys: [] });
      return;
    }
    setReviewSession((current) =>
      current.total
        ? current
        : { total: currentReviewItems.length, visitedKeys: [] },
    );
  }, [result, currentReviewItems]);

  async function run() {
    setBusy(true);
    setMessage("");
    setUncodedDecisions({});
    setDescriptionResolutions({});
    setDeferredReviewKeys([]);
    setReviewSession({ total: 0, visitedKeys: [] });
    try {
      setResult(await processUploads(files, month));
    } finally {
      setBusy(false);
    }
  }

  function skipCurrentReview() {
    if (!reviewItem) return;
    markReviewProgress(reviewItem.key);
    if (currentReviewItems.length > 1)
      setDeferredReviewKeys((current) =>
        current.includes(reviewItem.key)
          ? current
          : [...current, reviewItem.key],
      );
  }

  function markReviewProgress(key: string) {
    setReviewSession((current) =>
      current.visitedKeys.includes(key)
        ? current
        : { ...current, visitedKeys: [...current.visitedKeys, key] },
    );
  }

  function recordUncodedDecision(
    key: string,
    decision?: UncodedReviewDecision,
  ) {
    if (decision) markReviewProgress(key);
    setUncodedDecisions((current) => {
      const next = { ...current };
      if (decision) next[key] = decision;
      else delete next[key];
      return next;
    });
  }

  async function chooseJobRegister(file?: File) {
    if (!file) return;
    setJobRegisterLoading(true);
    setJobRegisterMessage("");
    try {
      const parsed = await parseJobRegister(
        await file.arrayBuffer(),
        file.name,
      );
      await saveJobRegister(parsed);
      setJobRegister(parsed);
      setJobRegisterMessage(
        `Latest Job Register saved — ${parsed.projects.length.toLocaleString("en-GB")} projects ready for search.`,
      );
    } catch (cause) {
      setJobRegisterMessage(
        cause instanceof Error
          ? cause.message
          : "The Job Register could not be checked.",
      );
    } finally {
      setJobRegisterLoading(false);
    }
  }

  async function chooseWorkbook(file: File | undefined, historical: boolean) {
    if (!file) return;
    setWorkbookLoading(true);
    setWorkbookMessage("");
    try {
      const data = await file.arrayBuffer();
      const savedAt = new Date().toISOString();
      const firstInspection = await inspectLatestMonthlyWorkbook(data, {
        name: file.name,
        savedAt,
      });
      const role = historical
        ? "historical"
        : workbookRoleForUpload(firstInspection, month);
      const expectedYear = financialYearForMonth(month).label;
      if (!historical && role !== "current")
        throw new Error(
          `This workbook is for ${firstInspection.financialYear}. Choose the ${expectedYear} workbook for the selected month, or add it under Previous years.`,
        );
      if (historical && firstInspection.financialYear >= expectedYear)
        throw new Error(
          `This workbook is for ${firstInspection.financialYear}. Choose an earlier financial year here.`,
        );
      const inspection = await inspectLatestMonthlyWorkbook(data, {
        id: `financial-year:${firstInspection.financialYear}:${savedAt}`,
        name: file.name,
        savedAt,
        role,
      });
      const catalogue = catalogueFromAnnualWorkbook(data);
      const internalCatalogue = internalCatalogueFromAnnualWorkbook(data);
      const stored: StoredFinancialYearWorkbook = {
        financialYear: inspection.financialYear,
        role,
        fileName: file.name,
        savedAt,
        updatedThrough: inspection.updatedThrough,
        data,
        inspection,
        projectCatalogue: catalogue,
        internalCatalogue,
      };
      await saveFinancialYearWorkbook(stored);
      setWorkbooks((current) => [
        ...current
          .filter((item) => item.financialYear !== stored.financialYear)
          .map((item) =>
            role === "current" && item.role === "current"
              ? {
                  ...item,
                  role: "historical" as const,
                  inspection: {
                    ...item.inspection,
                    source: {
                      ...item.inspection.source,
                      role: "historical" as const,
                    },
                  },
                }
              : item,
          ),
        stored,
      ]);
      setResult(undefined);
      setWorkbookMessage(
        `${inspection.financialYear} saved on this workstation, updated through ${monthLabel(inspection.updatedThrough)}.`,
      );
    } catch (cause) {
      setWorkbookMessage(
        cause instanceof Error
          ? cause.message
          : "The hours workbook could not be checked.",
      );
    } finally {
      setWorkbookLoading(false);
    }
  }

  const chooseLatestWorkbook = (file?: File) => chooseWorkbook(file, false);
  const chooseHistoricalWorkbook = (file?: File) => chooseWorkbook(file, true);

  async function exportProject() {
    if (
      !exportSource ||
      carryResolution.errors.length ||
      carryResolution.warnings.length
    )
      return;
    setExporting("project");
    setMessage("");
    try {
      const data = await generateProjectWorkbook(
        consolidated,
        exportSource.data,
        __BUILD_ID__,
        carryResolution.records,
      );
      if (rollover.needsInitialisation && isAprilProcessingMonth(month)) {
        const savedAt = new Date().toISOString();
        const fileName = projectWorkbookFilename(month);
        const inspection = await inspectLatestMonthlyWorkbook(data, {
          id: `financial-year:${rollover.processingFinancialYear}:${savedAt}`,
          name: fileName,
          savedAt,
          role: "current",
        });
        const initialised: StoredFinancialYearWorkbook = {
          financialYear: inspection.financialYear,
          role: "current",
          fileName,
          savedAt,
          updatedThrough: inspection.updatedThrough,
          data,
          inspection,
          projectCatalogue: catalogueFromAnnualWorkbook(data),
          internalCatalogue: internalCatalogueFromAnnualWorkbook(data),
        };
        await saveFinancialYearWorkbook(initialised);
        setWorkbooks((current) => [
          ...current.map((item) => ({
            ...item,
            role: "historical" as const,
            inspection: {
              ...item.inspection,
              source: {
                ...item.inspection.source,
                role: "historical" as const,
              },
            },
          })),
          initialised,
        ]);
      }
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
        carryResolution.records,
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

  function downloadOriginalTimesheet(entry: TimeEntry) {
    const source = result?.sourceFiles.find(
      (item) => item.name === entry.trace.file,
    );
    if (!source) return;
    const url = URL.createObjectURL(
      new Blob([source.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = source.name.split(/[\\/]/).at(-1) ?? "timesheet.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel admin-workflow">
      <div className="title-row">
        <div>
          <p className="eyebrow">Protected administrative area</p>
          <h2>Create this month&apos;s hours reports</h2>
          <p className="lead">
            Add the month&apos;s files, review anything NEXUS could not
            identify, then create the reports and employee viewer.
          </p>
        </div>
        <button onClick={logout}>Logout / reset</button>
      </div>
      <div className="notice">
        Confidential files stay on this workstation. Never upload source
        timesheets, employee records, generated outputs or rates to GitHub.
      </div>

      <section className="workflow-section" aria-labelledby="month-title">
        <div className="section-heading">
          <span className="step-number">1</span>
          <div>
            <p className="eyebrow">Step 1</p>
            <h3 id="month-title">Add this month&apos;s files</h3>
          </div>
        </div>
        <label className="field-width">
          Reporting month
          <strong className="current-month-label">{monthLabel(month)}</strong>
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

      <LatestMonthlyWorkbookPanel
        current={currentWorkbook}
        historical={historicalWorkbooks}
        processingFinancialYear={rollover.processingFinancialYear}
        loading={workbookLoading || !workbooksLoaded}
        message={workbookMessage}
        needsInitialisation={rollover.needsInitialisation}
        onChooseCurrent={chooseLatestWorkbook}
        onChooseHistorical={chooseHistoricalWorkbook}
      />

      <JobRegisterPanel
        value={jobRegister}
        loading={jobRegisterLoading || !jobRegisterLoaded}
        message={jobRegisterMessage}
        onChoose={chooseJobRegister}
      />

      <section className="workflow-section" aria-labelledby="timesheets-title">
        <h3 id="timesheets-title">Timesheets</h3>
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
            disabled={!files.length || !exportSource || busy}
            onClick={run}
          >
            {busy ? "Checking files…" : "Check files"}
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
        {!exportSource && (
          <small>Choose the current hours workbook before continuing.</small>
        )}
      </section>

      {result && (
        <>
          <section className="workflow-section" aria-labelledby="review-title">
            <div className="section-heading">
              <span className="step-number">2</span>
              <div>
                <p className="eyebrow">Step 2</p>
                <h3 id="review-title">
                  Review anything NEXUS couldn&apos;t identify
                </h3>
              </div>
            </div>
            <p
              className={currentReviewItems.length ? "warning-line" : "success"}
            >
              {currentReviewItems.length === 0
                ? "Nothing left to review."
                : `${currentReviewItems.length} item${currentReviewItems.length === 1 ? " still needs" : "s still need"} a decision`}
            </p>
            {reviewItem && (
              <div className="guided-review-queue">
                <div className="review-progress">
                  <span>
                    Item {reviewPosition} of {reviewTotal} ·{" "}
                    {currentReviewItems.length} remaining
                  </span>
                  <progress
                    aria-label="Current review progress"
                    max={reviewTotal}
                    value={reviewPosition}
                  />
                  {revisitingSkippedItem && (
                    <small>Returning to an item you skipped earlier.</small>
                  )}
                </div>
                {reviewItem.kind === "employee" && (
                  <div key={reviewItem.key}>
                    <UnknownEmployeeResolver
                      sourceName={reviewItem.sourceName}
                      register={register}
                      month={month}
                      onChange={onRegisterChange}
                      onResolved={() => markReviewProgress(reviewItem.key)}
                    />
                    <button type="button" onClick={skipCurrentReview}>
                      Skip for now
                    </button>
                  </div>
                )}
                {reviewItem.kind === "uncoded" && (
                  <UncodedReviewCard
                    key={reviewItem.key}
                    entry={reviewItem.entry}
                    catalogue={projectCatalogue}
                    internalCatalogue={internalCatalogue}
                    decision={
                      uncodedDecisions[entryReviewKey(reviewItem.entry)]
                    }
                    onDecision={(decision) =>
                      recordUncodedDecision(
                        entryReviewKey(reviewItem.entry),
                        decision,
                      )
                    }
                    onSkip={skipCurrentReview}
                    onDownloadOriginal={
                      result.sourceFiles.some(
                        (item) => item.name === reviewItem.entry.trace.file,
                      )
                        ? () => downloadOriginalTimesheet(reviewItem.entry)
                        : undefined
                    }
                  />
                )}
                {reviewItem.kind === "description" && (
                  <DescriptionConflictReview
                    key={reviewItem.key}
                    conflict={reviewItem.conflict}
                    onSave={(description) => {
                      markReviewProgress(reviewItem.key);
                      setDescriptionResolutions((current) => ({
                        ...current,
                        [reviewItem.conflict.projectCode]: description,
                      }));
                    }}
                    onSkip={skipCurrentReview}
                  />
                )}
              </div>
            )}
            {!!missingEmployees.length && (
              <div className="warning">
                <h4>Missing registered timesheets</h4>
                <p>{missingEmployees.join(", ")}</p>
              </div>
            )}
            {!!result.blankTimesheets.length && (
              <div className="warning">
                <h4>No hours recorded</h4>
                <p>{result.blankTimesheets.join(", ")}</p>
              </div>
            )}
            {!!result.warnings.length && (
              <div className="warning-summary">
                <strong>
                  {result.warnings.length} timesheet item
                  {result.warnings.length === 1 ? "" : "s"} may need checking
                </strong>
                <ul>
                  {result.warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>
                      {operatorWarning(warning, result.entries)}
                    </li>
                  ))}
                </ul>
                <details>
                  <summary>More details ({result.warnings.length})</summary>
                  <ul>
                    {result.warnings.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </details>
              </div>
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
          </section>

          {workbooks.length > 0 && (
            <HistoricalReviewPanel
              issues={carryResolution.issues}
              state={historicalReview}
              register={register}
              catalogue={projectCatalogue}
              onChange={setHistoricalReview}
            />
          )}

          <section
            className="workflow-section"
            aria-labelledby="reconciliation-title"
          >
            <div className="section-heading">
              <span className="step-number">3</span>
              <div>
                <p className="eyebrow">Step 3</p>
                <h3 id="reconciliation-title">Create monthly reports</h3>
              </div>
            </div>
            <div className="output-grid report-ready-grid">
              <article>
                <span className="report-kind">
                  Monthly project-hours report
                </span>
                <strong className="report-status">
                  {consolidated.canExport &&
                  !carryResolution.errors.length &&
                  !carryResolution.warnings.length
                    ? "Ready"
                    : "Needs review"}
                </strong>
                <p>
                  {consolidated.projects.length} identified projects ·{" "}
                  {consolidated.unknownHours.toFixed(2)} unknown hours ·{" "}
                  {consolidated.excludedHours.toFixed(2)} excluded hours
                </p>
                <button
                  className="primary"
                  disabled={
                    !consolidated.canExport ||
                    result.fatalErrors.length > 0 ||
                    !exportSource ||
                    carryResolution.errors.length > 0 ||
                    carryResolution.warnings.length > 0 ||
                    !!exporting
                  }
                  onClick={exportProject}
                >
                  {exporting === "project" ? "Preparing…" : "Download report"}
                </button>
                {!exportSource && (
                  <small>Choose the current hours workbook first.</small>
                )}
              </article>
              <article className="internal-output">
                <span className="report-kind">Internal hours report</span>
                <strong className="report-status">
                  {consolidated.canExport ? "Ready" : "Needs review"}
                </strong>
                <p>
                  {consolidated.internal.length} internal categories ·{" "}
                  {consolidated.timeInLieuHours.toFixed(2)} Time in Lieu hours ·{" "}
                  other non-project hours shown separately · private management
                  output
                </p>
                <button
                  className="primary"
                  disabled={
                    !consolidated.canExport ||
                    result.fatalErrors.length > 0 ||
                    !!exporting
                  }
                  onClick={exportInternal}
                >
                  {exporting === "internal"
                    ? "Preparing…"
                    : "Download directors' report"}
                </button>
              </article>
            </div>
            <details className="report-details">
              <summary>Report checks and totals</summary>
              <p className={consolidated.reconciles ? "success" : "error"}>
                Totals check:{" "}
                {consolidated.reconciles ? "passed" : "needs attention"}
              </p>
              <p>
                Project {consolidated.projectHours.toFixed(2)} · Internal{" "}
                {consolidated.internalHours.toFixed(2)} · Unknown{" "}
                {consolidated.unknownHours.toFixed(2)} · Excluded{" "}
                {consolidated.excludedHours.toFixed(2)} · Still to review{" "}
                {consolidated.exceptionHours.toFixed(2)} · Source total{" "}
                {consolidated.importedHours.toFixed(2)}
              </p>
            </details>
            {consolidated.sourceDiscrepancyCount > 0 && (
              <p className="warning-line">
                {consolidated.sourceDiscrepancyCount} timesheet total does not
                match its daily entries. NEXUS has kept the recorded total; open
                the item&apos;s details if it needs checking.
              </p>
            )}
            {!!consolidated.blockers.length && (
              <div className="error-box" role="alert">
                <h4>Reports aren&apos;t ready yet</h4>
                <p>
                  Finish the remaining review items before creating this
                  month&apos;s reports.
                </p>
                {currentReviewItems.length > 0 && (
                  <p>
                    {currentReviewItems.length} item
                    {currentReviewItems.length === 1 ? "" : "s"} still need a
                    decision.
                  </p>
                )}
                <details>
                  <summary>More details</summary>
                  <ul>
                    {consolidated.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
            {message && (
              <p className="status-message" role="status">
                {message}
              </p>
            )}
          </section>

          <section
            className="workflow-section"
            aria-labelledby="publication-title"
          >
            <div className="section-heading">
              <span className="step-number">4</span>
              <div>
                <p className="eyebrow">Step 4</p>
                <h3 id="publication-title">Publish employee viewer</h3>
              </div>
            </div>
            <div className="output-grid publication-grid">
              <EmployeePublicationPanel
                result={consolidated}
                blocked={result.fatalErrors.length > 0}
              />
            </div>
          </section>
        </>
      )}
    </section>
  );
}
