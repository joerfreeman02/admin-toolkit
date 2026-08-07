import { useEffect, useState } from "react";
import type {
  ConsolidationResult,
  EncryptedEmployeePublication,
} from "./domain";
import {
  EMPLOYEE_VIEWER_TOKEN_KEY,
  PBKDF2_ITERATIONS,
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
}: {
  result: ConsolidationResult;
  blocked?: boolean;
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
      "A new Employee Viewer token was generated. Save and distribute it securely.",
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
        createEmployeeDataset(result),
        configuredToken,
      );
      const fragment = encodePublicationFragment(next);
      const nextLink = `${location.origin}${location.pathname}${fragment}`;
      setPublication(next);
      setLink(nextLink);
      setMessage(
        "Approved project hours were encrypted locally. The link contains ciphertext only.",
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
      <h4>Employee Viewer Access</h4>
      <p>
        Create a separate shared pilot token, then publish only an explicitly
        approved project-hours month. The Admin token is never used here.
      </p>
      <button type="button" onClick={generateToken}>
        Generate secure employee token
      </button>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => changeRemember(event.target.checked)}
        />
        Remember on this workstation
      </label>
      {generatedToken && (
        <div className="one-time-token">
          <strong>
            Save this token now — it is shown only in this session
          </strong>
          <code>{generatedToken}</code>
          <button
            type="button"
            onClick={() =>
              copy(generatedToken, "Employee Viewer token copied.")
            }
          >
            Copy token
          </button>
        </div>
      )}
      {configuredToken && !generatedToken && (
        <p className="success">
          Employee Viewer token is configured on this workstation.
        </p>
      )}
      <label className="approval-confirmation">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        I confirm this month&apos;s project hours are approved for employee
        viewing.
      </label>
      <button
        className="primary"
        type="button"
        disabled={
          !result.canExport || blocked || !configuredToken || !confirmed || busy
        }
        onClick={publish}
      >
        {busy
          ? "Encrypting locally..."
          : "Publish approved month for employees"}
      </button>
      {(!result.canExport || blocked) && (
        <small>
          Publication remains blocked until every export control passes.
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
      <details>
        <summary>Interim pilot security details</summary>
        <p>
          Payloads use PBKDF2-HMAC-SHA-256 (
          {PBKDF2_ITERATIONS.toLocaleString("en-GB")} iterations), a random
          128-bit salt, AES-256-GCM and a random 96-bit IV. The URL fragment is
          not sent to GitHub Pages.
        </p>
        <p>
          This shared-token pilot has no individual identity, revocation or
          access audit. Anyone holding both the token and encrypted publication
          can open it. Proper company authentication and hosting must replace
          this interim mechanism.
        </p>
      </details>
    </article>
  );
}
