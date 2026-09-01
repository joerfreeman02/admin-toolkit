import { useEffect, useState } from "react";
import type {
  ConsolidationResult,
  EncryptedEmployeePublication,
  HistoricalCarryRecord,
  TpcResolution,
} from "./domain";
import {
  createEmployeeDataset,
  employeeViewerUrl,
  encryptEmployeeDataset,
  generateEmployeePublicationId,
  generateEmployeeViewerToken,
  publicationFilename,
} from "./publication";
import {
  loadConfiguredEmployeeViewerAccessCode,
  saveConfiguredEmployeeViewerAccessCode,
} from "./employeeViewerAccess";
import {
  createPublishingSession,
  fetchPublishedEmployeePublication,
  uploadEmployeePublication,
} from "./publicationApi";

function downloadPublication(
  publication: EncryptedEmployeePublication,
  publicationId: string,
) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(publication)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = publicationFilename(publicationId);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function EmployeePublicationPanel({
  result,
  blocked = false,
  carries = [],
  tpcResolution,
  adminCode,
}: {
  result: ConsolidationResult;
  blocked?: boolean;
  carries?: HistoricalCarryRecord[];
  tpcResolution?: TpcResolution;
  adminCode?: string;
}) {
  const [configuredToken, setConfiguredToken] = useState(() =>
    loadConfiguredEmployeeViewerAccessCode(),
  );
  const [generatedToken, setGeneratedToken] = useState("");
  const [publishingCode, setPublishingCode] = useState("");
  const [needsPublishingCode, setNeedsPublishingCode] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [publication, setPublication] =
    useState<EncryptedEmployeePublication>();
  const [publicationId, setPublicationId] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setConfirmed(false);
    setPublication(undefined);
    setPublicationId("");
    setLink("");
  }, [result.month]);

  function generateToken() {
    const token = generateEmployeeViewerToken();
    setConfiguredToken(token);
    setGeneratedToken(token);
    setPublication(undefined);
    setPublicationId("");
    setLink("");
    saveConfiguredEmployeeViewerAccessCode(token);
    setMessage(
      "A new Employee Viewer access code is ready. Save it somewhere secure.",
    );
  }

  function showConfiguredToken() {
    setGeneratedToken(configuredToken);
    setMessage(
      "The configured Employee Viewer access code is shown for secure sharing.",
    );
  }

  async function copy(value: string, success: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(success);
    } catch {
      setMessage(
        "Clipboard access was unavailable. Select and copy the value manually.",
      );
    }
  }

  async function publish() {
    if (!confirmed || !configuredToken || !result.canExport || blocked) return;
    const activeAdminCode = adminCode ?? publishingCode;
    if (!activeAdminCode) {
      setNeedsPublishingCode(true);
      setMessage(
        "Enter the NEXUS admin code to publish. It is used only for this secure publishing session.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const next = await encryptEmployeeDataset(
        createEmployeeDataset(result, carries, tpcResolution),
        configuredToken,
      );
      const nextPublicationId = generateEmployeePublicationId(result.month);
      const nextLink = employeeViewerUrl(
        nextPublicationId,
        `${location.origin}${location.pathname}`,
      );
      const session = await createPublishingSession(activeAdminCode);
      await uploadEmployeePublication(nextPublicationId, next, session);
      const verified =
        await fetchPublishedEmployeePublication(nextPublicationId);
      if (JSON.stringify(verified) !== JSON.stringify(next))
        throw new Error(
          "The uploaded publication could not be verified. It has not been marked ready to share.",
        );
      setPublication(next);
      setPublicationId(nextPublicationId);
      setLink(nextLink);
      setMessage(
        "Employee Viewer published. The encrypted publication was retrieved and verified; the link is ready to share.",
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Publication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="employee-publication">
      <h4>Publish Employee Viewer</h4>
      <p>
        Use the stable Employee Viewer access code, confirm this month&apos;s
        project hours are ready, then publish the viewer.
      </p>
      {!configuredToken && (
        <button type="button" onClick={generateToken}>
          Create Employee Viewer access code
        </button>
      )}
      {configuredToken && (
        <div className="success">
          <strong>Employee Viewer access</strong>
          <p>✓ Access code configured on this workstation</p>
          <button type="button" onClick={showConfiguredToken}>
            Show / copy access code
          </button>
          <button type="button" onClick={generateToken}>
            Rotate Employee Viewer access code
          </button>
          <p className="muted">
            Rotation is exceptional: older publications continue to require the
            previous code unless they are republished.
          </p>
        </div>
      )}
      {generatedToken && (
        <div className="one-time-token">
          <strong>
            Save this access code now — share it separately from the link
          </strong>
          <code>{generatedToken}</code>
          <button
            type="button"
            onClick={() => copy(generatedToken, "Employee access code copied.")}
          >
            Copy access code
          </button>
        </div>
      )}
      {needsPublishingCode && !adminCode && (
        <label>
          NEXUS admin code
          <input
            aria-label="NEXUS admin code for publishing"
            type="password"
            value={publishingCode}
            onChange={(event) => setPublishingCode(event.target.value)}
          />
        </label>
      )}
      <label className="approval-confirmation">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        I confirm this month is ready to publish.
      </label>
      <button
        className="primary"
        type="button"
        disabled={
          !result.canExport || blocked || !configuredToken || !confirmed || busy
        }
        onClick={publish}
      >
        {busy ? "Publishing securely..." : "Publish Employee Viewer"}
      </button>
      {(!result.canExport || blocked) && (
        <small>
          Finish the remaining review items before publishing this month.
        </small>
      )}
      {link && publication && (
        <div className="publication-output">
          <label>
            Employee Viewer link
            <textarea
              aria-label="Encrypted employee-view link"
              readOnly
              value={link}
              rows={2}
            />
          </label>
          <div className="button-row">
            <button
              type="button"
              onClick={() => copy(link, "Employee-view link copied.")}
            >
              Copy employee-view link
            </button>
            <button
              type="button"
              onClick={() => downloadPublication(publication, publicationId)}
            >
              Download encrypted backup
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="status-message" role="status">
          {message}
        </p>
      )}
    </article>
  );
}
