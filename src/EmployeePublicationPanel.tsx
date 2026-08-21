import { useEffect, useState } from "react";
import type {
  ConsolidationResult,
  EncryptedEmployeePublication,
  HistoricalCarryRecord,
  TpcResolution,
} from "./domain";
import {
  EMPLOYEE_VIEWER_TOKEN_KEY,
  createEmployeeDataset,
  encodePublicationFragment,
  encryptEmployeeDataset,
  generateEmployeeViewerToken,
} from "./publication";

function downloadPublication(
  publication: EncryptedEmployeePublication,
  month: string,
) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(publication)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `EAS Employee Hours - ${month}.easpub`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function EmployeePublicationPanel({
  result,
  blocked = false,
  carries = [],
  tpcResolution,
}: {
  result: ConsolidationResult;
  blocked?: boolean;
  carries?: HistoricalCarryRecord[];
  tpcResolution?: TpcResolution;
}) {
  const [configuredToken, setConfiguredToken] = useState(
    () => localStorage.getItem(EMPLOYEE_VIEWER_TOKEN_KEY) ?? "",
  );
  const [generatedToken, setGeneratedToken] = useState("");
  const [remember, setRemember] = useState(
    () => !!localStorage.getItem(EMPLOYEE_VIEWER_TOKEN_KEY),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [publication, setPublication] =
    useState<EncryptedEmployeePublication>();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setConfirmed(false);
    setPublication(undefined);
    setLink("");
  }, [result.month]);

  function generateToken() {
    const token = generateEmployeeViewerToken();
    setConfiguredToken(token);
    setGeneratedToken(token);
    setPublication(undefined);
    setLink("");
    setMessage(
      "A new employee access code is ready. Save it somewhere secure.",
    );
    if (remember) localStorage.setItem(EMPLOYEE_VIEWER_TOKEN_KEY, token);
  }

  function changeRemember(value: boolean) {
    setRemember(value);
    if (value && configuredToken)
      localStorage.setItem(EMPLOYEE_VIEWER_TOKEN_KEY, configuredToken);
    else localStorage.removeItem(EMPLOYEE_VIEWER_TOKEN_KEY);
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
    setBusy(true);
    setMessage("");
    try {
      const next = await encryptEmployeeDataset(
        createEmployeeDataset(result, carries, tpcResolution),
        configuredToken,
      );
      const fragment = encodePublicationFragment(next);
      const nextLink = `${location.origin}${location.pathname}${fragment}`;
      setPublication(next);
      setLink(nextLink);
      setMessage("The Employee Viewer is ready to share for this month.");
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
        Create the employee access code, confirm this month&apos;s project hours
        are ready, then publish the viewer.
      </p>
      <button type="button" onClick={generateToken}>
        Create employee access code
      </button>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => changeRemember(event.target.checked)}
        />
        Remember on this computer
      </label>
      {generatedToken && (
        <div className="one-time-token">
          <strong>
            Save this access code now — it is shown only in this session
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
      {configuredToken && !generatedToken && (
        <p className="success">
          An employee access code is ready on this computer.
        </p>
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
        {busy ? "Encrypting locally..." : "Publish Employee Viewer"}
      </button>
      {(!result.canExport || blocked) && (
        <small>
          Finish the remaining review items before publishing this month.
        </small>
      )}
      {link && publication && (
        <div className="publication-output">
          <label>
            Encrypted employee-view link
            <textarea readOnly value={link} rows={4} />
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
              onClick={() => downloadPublication(publication, result.month)}
            >
              Download encrypted publication file
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
