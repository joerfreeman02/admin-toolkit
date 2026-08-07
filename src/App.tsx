import { useMemo, useState } from "react";
import { demoData } from "./demo";
import type { ProcessingResult } from "./domain";
import { processUploads, reconcile, toPublicDataset } from "./processing";
import "./styles.css";

const AUTH_KEY = "eas-admin-authorised";
type View = "home" | "viewer" | "admin" | "about" | "diagnostics";

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function PublicViewer() {
  const dataset = demoData[0];
  const employees = [
    ...new Set(
      dataset.projects.flatMap((project) =>
        project.contributors.map((item) => item.employee),
      ),
    ),
  ];
  const [employee, setEmployee] = useState(employees[0]);
  const [selected, setSelected] = useState(
    dataset.projects.find((project) =>
      project.contributors.some((item) => item.employee === employee),
    ),
  );
  const projects = dataset.projects.filter((project) =>
    project.contributors.some((item) => item.employee === employee),
  );
  return (
    <section className="panel" aria-labelledby="viewer-title">
      <p className="eyebrow">Public area · synthetic data only</p>
      <h2 id="viewer-title">Employee project-hours viewer</h2>
      <div className="controls">
        <label>
          Reporting month
          <select value={dataset.month} disabled>
            <option>{dataset.month}</option>
          </select>
        </label>
        <label>
          Employee
          <select
            value={employee}
            onChange={(event) => {
              const name = event.target.value;
              setEmployee(name);
              setSelected(
                dataset.projects.find((project) =>
                  project.contributors.some((item) => item.employee === name),
                ),
              );
            }}
          >
            {employees.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="split">
        <div>
          <h3>Projects worked</h3>
          {projects.map((project) => (
            <button
              className="project-button"
              key={project.code ?? project.description}
              onClick={() => setSelected(project)}
            >
              <span>
                {project.code ?? "Uncoded"} · {project.description}
              </span>
              <strong>
                {project.contributors
                  .find((item) => item.employee === employee)
                  ?.hours.toFixed(2)}{" "}
                hrs
              </strong>
            </button>
          ))}
        </div>
        <div className="subpanel">
          <h3>{selected?.description ?? "Select a project"}</h3>
          {selected && (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Contributor</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.contributors.map((item) => (
                    <tr key={item.employee}>
                      <td>{item.employee}</td>
                      <td>{item.hours.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Project total</th>
                    <th>{selected.total.toFixed(2)}</th>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function AdminGate({ onAuthorise }: { onAuthorise: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const expected = import.meta.env.VITE_ADMIN_TOKEN_SHA256 as
      | string
      | undefined;
    if (!expected) {
      setError("Administrative access is not configured in this build.");
      return;
    }
    if ((await sha256(token)) !== expected) {
      setError("Token not recognised.");
      return;
    }
    localStorage.setItem(AUTH_KEY, "true");
    onAuthorise();
  }
  return (
    <section className="panel gate">
      <p className="eyebrow">Protected prototype</p>
      <h2>Administrative access</h2>
      <p>
        This browser-only workstation gate is not server-grade authentication.
        Confidentiality depends on keeping source and internal data out of the
        public deployment.
      </p>
      <form onSubmit={submit}>
        <label>
          Administrative token
          <input
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary">Authorise this workstation</button>
      </form>
    </section>
  );
}

function AdminProcessing({ logout }: { logout: () => void }) {
  const [month, setMonth] = useState("2026-07");
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ProcessingResult>();
  const [busy, setBusy] = useState(false);
  const totals = useMemo(
    () => (result ? reconcile(result.entries) : undefined),
    [result],
  );
  const publicPreview = useMemo(
    () => (result ? toPublicDataset(result.entries, month) : undefined),
    [result, month],
  );
  async function run() {
    setBusy(true);
    try {
      setResult(await processUploads(files, month));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="title-row">
        <div>
          <p className="eyebrow">Protected administrative area</p>
          <h2>Timesheet processing</h2>
        </div>
        <button onClick={logout}>Logout / reset</button>
      </div>
      <div className="notice">
        Timesheet files are processed locally in the browser. Do not publish or
        commit confidential timesheet files or internal-hours outputs.
      </div>
      <div className="controls">
        <label>
          Reporting month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label className="file-drop">
          Timesheets or ZIP
          <input
            aria-label="Timesheets or ZIP"
            type="file"
            multiple
            accept=".xlsx,.zip"
            onChange={(e) => setFiles([...(e.target.files ?? [])])}
          />
        </label>
        <button
          className="primary"
          disabled={!files.length || busy}
          onClick={run}
        >
          {busy ? "Processing…" : "Process locally"}
        </button>
      </div>
      {!!files.length && (
        <div>
          <h3>Files ready</h3>
          <ul>
            {files.map((file) => (
              <li key={`${file.name}-${file.size}`}>
                {file.name}{" "}
                <button
                  onClick={() =>
                    setFiles(files.filter((item) => item !== file))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result && totals && (
        <>
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
              <strong>{totals.project.toFixed(2)}</strong>
            </article>
            <article>
              <span>Internal</span>
              <strong>{totals.internal.toFixed(2)}</strong>
            </article>
            <article>
              <span>Exceptions</span>
              <strong>{totals.exception.toFixed(2)}</strong>
            </article>
            <article>
              <span>Total</span>
              <strong>{totals.total.toFixed(2)}</strong>
            </article>
          </div>
          <p className={totals.reconciles ? "success" : "error"}>
            Reconciliation: {totals.reconciles ? "passed" : "failed"}
          </p>
          {!!result.warnings.length && (
            <div className="warning">
              <h3>Non-blocking warnings</h3>
              <ul>
                {result.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {!!result.fatalErrors.length && (
            <div className="error-box">
              <h3>Fatal errors</h3>
              <ul>
                {result.fatalErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="split">
            <div>
              <h3>Project and exception preview</h3>
              <EntryTable
                entries={result.entries.filter(
                  (entry) => entry.classification !== "internal",
                )}
              />
            </div>
            <div>
              <h3>Protected internal-hours preview</h3>
              <EntryTable
                entries={result.entries.filter(
                  (entry) => entry.classification === "internal",
                )}
              />
            </div>
          </div>
          <details>
            <summary>
              Public sanitisation preview ({publicPreview?.projects.length ?? 0}{" "}
              projects)
            </summary>
            <p>
              Only coded project records enter this derived dataset. Internal
              and unresolved exception records, including unknown uncoded work,
              remain protected. Source filenames are excluded.
            </p>
          </details>
        </>
      )}
    </section>
  );
}

function EntryTable({ entries }: { entries: ProcessingResult["entries"] }) {
  const sorted = [...entries].sort((a, b) =>
    a.projectCode && b.projectCode
      ? Number(a.projectCode) - Number(b.projectCode)
      : a.projectCode
        ? -1
        : b.projectCode
          ? 1
          : 0,
  );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Description</th>
            <th>Employee</th>
            <th>Hours</th>
            <th>Source trace</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => (
            <tr key={i}>
              <td>{entry.projectCode ?? "Uncoded"}</td>
              <td>{entry.description}</td>
              <td>{entry.employee}</td>
              <td>{entry.hours.toFixed(2)}</td>
              <td>
                {entry.trace.file} · {entry.trace.worksheet} · row{" "}
                {entry.trace.row}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("home");
  const [authorised, setAuthorised] = useState(
    localStorage.getItem(AUTH_KEY) === "true",
  );
  const nav = (target: View) => () => setView(target);
  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setAuthorised(false);
    setView("admin");
  };
  return (
    <>
      <header>
        <div className="brand">
          <div className="mark">EAS</div>
          <div>
            <strong>EAS Admin Toolkit</strong>
            <span>Timesheet and Invoicing Hours</span>
          </div>
        </div>
        <nav aria-label="Primary">
          <button onClick={nav("home")}>Dashboard</button>
          <button onClick={nav("viewer")}>Public Employee Viewer</button>
          <button onClick={nav("admin")}>Admin Processing</button>
          <button onClick={nav("about")}>About</button>
        </nav>
      </header>
      <main>
        {view === "home" && (
          <section className="hero">
            <p className="eyebrow">Sprint 0 · prototype foundation</p>
            <h1>
              Controlled timesheet ingestion, with public data separated by
              design.
            </h1>
            <p>
              Process structurally representative workbooks locally, reconcile
              every hour, and publish only an approved project-hours view.
            </p>
            <div className="cards">
              <button onClick={nav("viewer")}>
                <span>Public</span>
                <strong>Employee viewer</strong>
                <small>Synthetic project hours only</small>
              </button>
              <button onClick={nav("admin")}>
                <span>Protected</span>
                <strong>Admin processing</strong>
                <small>Local workbook classification</small>
              </button>
            </div>
          </section>
        )}
        {view === "viewer" && <PublicViewer />}
        {view === "admin" &&
          (authorised ? (
            <AdminProcessing logout={logout} />
          ) : (
            <AdminGate onAuthorise={() => setAuthorised(true)} />
          ))}
        {view === "about" && (
          <section className="panel">
            <p className="eyebrow">About and limitations</p>
            <h2>Prototype, not a production consolidator</h2>
            <p>
              Sprint 0 proves local parsing, classification, reconciliation and
              strict public/internal separation with synthetic data. It does not
              generate the final invoicing workbook, apply commercial decisions,
              or provide server authentication.
            </p>
          </section>
        )}
        {view === "diagnostics" && (
          <section className="panel">
            <h2>Build information</h2>
            <dl>
              <dt>Product</dt>
              <dd>ADMIN-0.1.1</dd>
              <dt>Module</dt>
              <dd>TIME-0.1.1</dd>
              <dt>Build</dt>
              <dd>{__BUILD_ID__}</dd>
              <dt>Sprint</dt>
              <dd>Sprint 0</dd>
            </dl>
          </section>
        )}
      </main>
      <footer>
        <button onClick={nav("diagnostics")}>
          ADMIN-0.1.1 · TIME-0.1.1 · {__BUILD_ID__}
        </button>
        <span>Files remain on this workstation.</span>
      </footer>
    </>
  );
}
