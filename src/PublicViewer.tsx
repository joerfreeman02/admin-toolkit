import { useEffect, useMemo, useState } from "react";
import { demoData } from "./demo";
import type {
  EncryptedEmployeePublication,
  PublicDataset,
  PublicProject,
} from "./domain";
import {
  EMPLOYEE_VIEWER_TOKEN_KEY,
  decodePublicationFragment,
  decryptEmployeePublication,
  parsePublicationFile,
} from "./publication";
import {
  listEncryptedPublications,
  saveEncryptedPublication,
} from "./workstationStore";

function DatasetViewer({
  dataset,
  encrypted,
}: {
  dataset: PublicDataset;
  encrypted: boolean;
}) {
  const employees = useMemo(
    () => [
      ...new Set(
        dataset.projects.flatMap((project) =>
          project.contributors.map((item) => item.employee),
        ),
      ),
    ],
    [dataset],
  );
  const [employee, setEmployee] = useState(employees[0] ?? "");
  const projects = dataset.projects.filter((project) =>
    project.contributors.some((item) => item.employee === employee),
  );
  const [selectedKey, setSelectedKey] = useState("");
  const selected =
    projects.find(
      (project) => (project.code ?? project.description) === selectedKey,
    ) ?? projects[0];

  useEffect(() => {
    setEmployee(employees[0] ?? "");
    setSelectedKey("");
  }, [dataset, employees]);

  return (
    <>
      <p className="eyebrow">
        {encrypted
          ? "Approved month · decrypted on this workstation"
          : "Public area · synthetic demonstration"}
      </p>
      <h2 id="viewer-title">Employee project-hours viewer</h2>
      {!encrypted && (
        <div className="notice">
          The base site contains fictional demonstration data only. Open an
          approved encrypted employee-view link to view a real published month.
        </div>
      )}
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
              setEmployee(event.target.value);
              setSelectedKey("");
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
              onClick={() =>
                setSelectedKey(project.code ?? project.description)
              }
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
        <ProjectDetail project={selected} />
      </div>
    </>
  );
}

function ProjectDetail({ project }: { project?: PublicProject }) {
  return (
    <div className="subpanel">
      <h3>{project?.description ?? "Select a project"}</h3>
      {project && (
        <table>
          <thead>
            <tr>
              <th>Contributor</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {project.contributors.map((item) => (
              <tr key={item.employee}>
                <td>{item.employee}</td>
                <td>{item.hours.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Project total</th>
              <th>{project.total.toFixed(2)}</th>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

export function PublicViewer() {
  const [publication, setPublication] =
    useState<EncryptedEmployeePublication>();
  const [library, setLibrary] = useState<EncryptedEmployeePublication[]>([]);
  const [dataset, setDataset] = useState<PublicDataset>();
  const [token, setToken] = useState(
    () => localStorage.getItem(EMPLOYEE_VIEWER_TOKEN_KEY) ?? "",
  );
  const [remember, setRemember] = useState(
    () => !!localStorage.getItem(EMPLOYEE_VIEWER_TOKEN_KEY),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function loadFromLink() {
      try {
        const fromLink = decodePublicationFragment(location.hash);
        if (fromLink) {
          setPublication(fromLink);
          setDataset(undefined);
          setError("");
        }
      } catch {
        setError("This employee-view link is invalid or incomplete.");
      }
    }
    loadFromLink();
    window.addEventListener("hashchange", loadFromLink);
    listEncryptedPublications()
      .then((items) =>
        setLibrary(items.sort((a, b) => b.month.localeCompare(a.month))),
      )
      .catch(() => undefined);
    return () => window.removeEventListener("hashchange", loadFromLink);
  }, []);

  async function unlock() {
    if (!publication) return;
    setBusy(true);
    setError("");
    try {
      const next = await decryptEmployeePublication(publication, token);
      setDataset(next);
      await saveEncryptedPublication(publication);
      setLibrary((current) => [
        publication,
        ...current.filter((item) => item.month !== publication.month),
      ]);
      if (remember) localStorage.setItem(EMPLOYEE_VIEWER_TOKEN_KEY, token);
      else localStorage.removeItem(EMPLOYEE_VIEWER_TOKEN_KEY);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This publication could not be opened.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function importPublication(file?: File) {
    if (!file) return;
    try {
      setPublication(parsePublicationFile(await file.text()));
      setDataset(undefined);
      setError("");
    } catch {
      setError("The selected encrypted publication file is invalid.");
    }
  }

  const shownDataset = dataset ?? (!publication ? demoData[0] : undefined);
  return (
    <section className="panel" aria-labelledby="viewer-title">
      {publication && !dataset && (
        <div className="viewer-unlock">
          <p className="eyebrow">Encrypted employee publication</p>
          <h2 id="viewer-title">Open approved project hours</h2>
          <p>
            Enter the Employee Viewer token supplied by the Office Manager.
            Decryption happens only in this browser.
          </p>
          <label>
            Employee Viewer token
            <input
              aria-label="Employee Viewer token"
              type="password"
              autoComplete="current-password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Remember this workstation
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary"
            type="button"
            disabled={!token || busy}
            onClick={unlock}
          >
            {busy ? "Opening securely..." : "Open approved month"}
          </button>
        </div>
      )}
      {shownDataset && (
        <DatasetViewer dataset={shownDataset} encrypted={!!dataset} />
      )}
      <details className="viewer-library">
        <summary>Previously opened months or encrypted file</summary>
        {!!library.length && (
          <label>
            Stored encrypted month
            <select
              value=""
              onChange={(event) => {
                const selected = library.find(
                  (item) => item.month === event.target.value,
                );
                if (selected) {
                  setPublication(selected);
                  setDataset(undefined);
                }
              }}
            >
              <option value="">Choose a month</option>
              {library.map((item) => (
                <option key={item.month} value={item.month}>
                  {item.month}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="secondary-button file-button">
          Open encrypted publication file
          <input
            aria-label="Open encrypted employee publication"
            type="file"
            accept=".easpub,application/json"
            onChange={(event) => importPublication(event.target.files?.[0])}
          />
        </label>
        <p className="muted">
          Stored months remain encrypted on this workstation. A new workstation
          must open the secure link or file again.
        </p>
      </details>
    </section>
  );
}
