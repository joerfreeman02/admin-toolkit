import type { StoredFinancialYearWorkbook } from "./domain";
import { monthLabel } from "./financialYear";

interface Props {
  current?: StoredFinancialYearWorkbook;
  historical: StoredFinancialYearWorkbook[];
  processingFinancialYear: string;
  loading: boolean;
  message: string;
  needsInitialisation: boolean;
  onChooseCurrent: (file?: File) => void;
  onChooseHistorical: (file?: File) => void;
}

export function LatestMonthlyWorkbookPanel({
  current,
  historical,
  processingFinancialYear,
  loading,
  message,
  needsInitialisation,
  onChooseCurrent,
  onChooseHistorical,
}: Props) {
  return (
    <section className="workbook-area" aria-labelledby="hours-workbook-title">
      <h4 id="hours-workbook-title">Hours workbook</h4>
      {loading ? (
        <p>Checking the workbook on this workstation…</p>
      ) : current ? (
        <div className="stored-template">
          <strong>
            Current hours workbook: {current.financialYear} — updated through{" "}
            {monthLabel(current.updatedThrough)}
          </strong>
          <span>{current.fileName}</span>
          <label className="secondary-button file-button">
            Replace workbook
            <input
              aria-label="Replace current hours workbook"
              type="file"
              accept=".xlsx"
              onChange={(event) => onChooseCurrent(event.target.files?.[0])}
            />
          </label>
        </div>
      ) : (
        <div className="stored-template">
          <strong>
            Current hours workbook: {processingFinancialYear} — not added yet
          </strong>
          <label className="secondary-button file-button">
            Choose current workbook
            <input
              aria-label="Current hours workbook"
              type="file"
              accept=".xlsx"
              onChange={(event) => onChooseCurrent(event.target.files?.[0])}
            />
          </label>
        </div>
      )}

      {historical.length > 0 && (
        <div className="workbook-history" aria-label="Previous hours workbooks">
          {historical.map((item) => (
            <p key={item.financialYear}>
              <strong>Previous year: {item.financialYear} — retained</strong>
              <span> · updated through {monthLabel(item.updatedThrough)}</span>
            </p>
          ))}
        </div>
      )}

      {needsInitialisation && (
        <div className="notice rollover-guidance">
          <strong>Starting a new financial year</strong>
          <p>
            April starts {processingFinancialYear}. NEXUS will keep the previous
            year unchanged, include any hours still marked green, and start the
            new workbook when you create April&apos;s report.
          </p>
        </div>
      )}

      <details className="backup-restore">
        <summary>Manage previous years</summary>
        <p>
          Add an earlier April-to-March workbook if it may contain hours still
          marked green. Saved previous years are kept unchanged.
        </p>
        <label className="secondary-button file-button">
          Add previous year workbook
          <input
            aria-label="Previous year hours workbook"
            type="file"
            accept=".xlsx"
            onChange={(event) => onChooseHistorical(event.target.files?.[0])}
          />
        </label>
      </details>

      <p className="muted">
        The latest valid copy is saved on this workstation and replaces the
        earlier copy for the same financial year.
      </p>
      {message && (
        <p className="status-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
