import type { StoredJobRegister } from "./domain";

export function JobRegisterPanel({
  value,
  loading,
  message,
  onChoose,
}: {
  value?: StoredJobRegister;
  loading: boolean;
  message: string;
  onChoose: (file?: File) => void;
}) {
  return (
    <section className="workflow-section compact-input-status">
      <div>
        <h3>Job Register</h3>
        <p className={value ? "success" : "muted"}>
          {loading
            ? "Opening the saved copy…"
            : value
              ? `Latest copy — ready · ${value.projects.length.toLocaleString("en-GB")} projects`
              : "Add the latest company Job Register for project suggestions."}
        </p>
      </div>
      <label className="secondary-button file-button">
        {value ? "Replace with latest Job Register" : "Choose Job Register"}
        <input
          aria-label={
            value ? "Replace with latest Job Register" : "Choose Job Register"
          }
          type="file"
          accept=".xlsm,.xlsx"
          disabled={loading}
          onChange={(event) => onChoose(event.target.files?.[0])}
        />
      </label>
      {message && (
        <p className="status-message" role="status">
          {message}
        </p>
      )}
      {!!value?.warnings.length && (
        <details>
          <summary>
            {value.warnings.length} Job Register item
            {value.warnings.length === 1 ? "" : "s"} to be aware of
          </summary>
          <ul>
            {value.warnings.slice(0, 20).map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
          {value.warnings.length > 20 && (
            <p>{value.warnings.length - 20} more items are hidden here.</p>
          )}
        </details>
      )}
    </section>
  );
}
