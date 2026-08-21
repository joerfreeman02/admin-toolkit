import type { StoredTpcWorkbook } from "./domain";
import { monthLabel } from "./financialYear";

interface Props {
  current?: StoredTpcWorkbook;
  historical: StoredTpcWorkbook[];
  processingFinancialYear: string;
  loading: boolean;
  message: string;
  onChooseCurrent: (file?: File) => void;
  onChooseHistorical: (file?: File) => void;
}

export function TpcWorkbookPanel({
  current,
  historical,
  processingFinancialYear,
  loading,
  message,
  onChooseCurrent,
  onChooseHistorical,
}: Props) {
  return (
    <section
      className="workbook-area tpc-workbook-area"
      aria-labelledby="tpc-workbook-title"
    >
      <h4 id="tpc-workbook-title">Third Party Costs</h4>
      {loading ? (
        <p>Checking saved TPC workbooks…</p>
      ) : (
        <div className="stored-template">
          <strong>
            Current TPC workbook:{" "}
            {current?.financialYear ?? processingFinancialYear}
            {current
              ? ` — updated through ${monthLabel(current.updatedThrough)}`
              : " — not added yet"}
          </strong>
          {current && <span>{current.fileName}</span>}
          <label className="secondary-button file-button">
            {current ? "Replace TPC workbook" : "Choose current TPC workbook"}
            <input
              aria-label={
                current
                  ? "Replace current TPC workbook"
                  : "Current TPC workbook"
              }
              type="file"
              accept=".xlsx"
              onChange={(event) => onChooseCurrent(event.target.files?.[0])}
            />
          </label>
        </div>
      )}
      {!!historical.length && (
        <div className="workbook-history" aria-label="Previous TPC workbooks">
          {historical.map((item) => (
            <p key={item.financialYear}>
              <strong>
                Previous TPC year: {item.financialYear} — retained
              </strong>
              <span> · updated through {monthLabel(item.updatedThrough)}</span>
            </p>
          ))}
        </div>
      )}
      <details className="backup-restore">
        <summary>Manage previous TPC years</summary>
        <p>
          Add or replace an earlier April-to-March TPC workbook. The latest
          valid copy for that year is used.
        </p>
        <label className="secondary-button file-button">
          Add previous TPC workbook
          <input
            aria-label="Previous TPC workbook"
            type="file"
            accept=".xlsx"
            onChange={(event) => onChooseHistorical(event.target.files?.[0])}
          />
        </label>
      </details>
      <p className="muted">
        TPC workbooks are optional for producing hours reports.
      </p>
      {message && (
        <p className="status-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
