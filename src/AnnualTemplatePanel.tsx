import type { StoredAnnualTemplate } from "./workstationStore";

interface Props {
  template?: StoredAnnualTemplate;
  loading: boolean;
  message: string;
  onChoose: (file?: File) => void;
  onRemove: () => void;
}

export function AnnualTemplatePanel({
  template,
  loading,
  message,
  onChoose,
  onRemove,
}: Props) {
  return (
    <section className="workflow-section" aria-labelledby="template-title">
      <div className="section-heading">
        <span className="step-number">3</span>
        <div>
          <p className="eyebrow">Approved annual formatting reference</p>
          <h3 id="template-title">Annual Hours for Invoicing workbook</h3>
        </div>
      </div>
      {loading ? (
        <p>Checking this workstation...</p>
      ) : template ? (
        <div className="stored-template">
          <strong>Approved annual workbook stored on this workstation</strong>
          <span>{template.name}</span>
          <div className="button-row">
            <label className="secondary-button file-button">
              Replace workbook
              <input
                aria-label="Replace Hours for Invoicing template"
                type="file"
                accept=".xlsx"
                onChange={(event) => onChoose(event.target.files?.[0])}
              />
            </label>
            <button type="button" onClick={onRemove}>
              Remove local workbook
            </button>
          </div>
        </div>
      ) : (
        <label className="file-drop field-width">
          Choose annual Hours for Invoicing workbook
          <input
            aria-label="Hours for Invoicing template"
            type="file"
            accept=".xlsx"
            onChange={(event) => onChoose(event.target.files?.[0])}
          />
        </label>
      )}
      <p className="muted">
        The approved workbook is stored in this browser and protected by the
        workstation&apos;s security; it is never uploaded. Replace it once when
        a new April-to-March annual workbook is approved.
      </p>
      {message && <p className="status-message">{message}</p>}
    </section>
  );
}
