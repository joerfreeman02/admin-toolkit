import { useEffect, useMemo, useState } from "react";
import { demoData } from "./demo";
import type {
  EncryptedEmployeePublication,
  PublicDataset,
  PublicProject,
} from "./domain";
import {
  decryptEmployeePublication,
  parseEmployeeViewerLink,
  parsePublicationFile,
} from "./publication";
import {
  forgetRememberedEmployeeViewerTokens,
  loadRememberedEmployeeViewerTokens,
  rememberEmployeeViewerToken,
} from "./employeeViewerAccess";
import { fetchPublishedEmployeePublication } from "./publicationApi";
import {
  listEncryptedPublications,
  saveEncryptedPublication,
  type StoredEncryptedPublication,
} from "./workstationStore";

function DatasetViewer({
  dataset,
  encrypted,
}: {
  dataset: PublicDataset;
  encrypted: boolean;
}) {
  const employees = useMemo(
    () =>
      dataset.employees.length
        ? dataset.employees
        : [
            ...new Set([
              ...dataset.projects.flatMap((project) =>
                project.contributors.map((item) => item.employee),
              ),
              ...dataset.statuses.map((status) => status.employee),
            ]),
          ].map((employee) => ({ employee, department: "Mixed" as const })),
    [dataset],
  );
  const [employee, setEmployee] = useState(employees[0]?.employee ?? "");
  const [allDepartments, setAllDepartments] = useState(false);
  const employeeDepartment = employees.find(
    (item) => item.employee === employee,
  )?.department;
  const projects = dataset.projects.filter(
    (project) =>
      project.contributors.some((item) => item.employee === employee) ||
      project.carriedHours.some((item) => item.employee === employee),
  );
  const [selectedKey, setSelectedKey] = useState("");
  const selected =
    projects.find(
      (project) => (project.code ?? project.description) === selectedKey,
    ) ?? projects[0];
  const statuses = dataset.statuses.filter(
    (status) => status.employee === employee,
  );

  useEffect(() => {
    setEmployee(employees[0]?.employee ?? "");
    setSelectedKey("");
  }, [dataset, employees]);

  return (
    <>
      <p className="eyebrow">
        {encrypted
          ? "Approved month · decrypted on this workstation"
          : "Employee Viewer demonstration"}
      </p>
      <h2 id="viewer-title">Employee project-hours viewer</h2>
      {!encrypted && (
        <div className="notice">
          This page contains fictional example data. Open an approved employee
          link to view a published month.
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
            {employees.map((item) => (
              <option key={item.employee}>{item.employee}</option>
            ))}
          </select>
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={allDepartments}
            onChange={(event) => setAllDepartments(event.target.checked)}
          />
          View all departments
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
                {(
                  (project.contributors.find(
                    (item) => item.employee === employee,
                  )?.hours ?? 0) +
                  project.carriedHours
                    .filter((item) => item.employee === employee)
                    .reduce((sum, item) => sum + item.hours, 0)
                ).toFixed(2)}{" "}
                hrs relevant
              </strong>
            </button>
          ))}
          {statuses.some((status) => status.kind === "unknown-project") && (
            <section className="employee-status-summary">
              <h3>Hours needing clarification</h3>
              {statuses
                .filter((status) => status.kind === "unknown-project")
                .map((status, index) => (
                  <p key={`unknown-${index}`}>
                    {status.originatingMonth ?? dataset.month} —{" "}
                    {status.hours.toFixed(2)}h — Unknown Project
                  </p>
                ))}
            </section>
          )}
          {statuses.some((status) => status.kind === "excluded") && (
            <section className="employee-status-summary">
              <h3>Excluded hours</h3>
              {statuses
                .filter((status) => status.kind === "excluded")
                .map((status, index) => (
                  <p key={`excluded-${index}`}>
                    {status.originatingMonth ?? dataset.month} —{" "}
                    {status.hours.toFixed(2)}h — Excluded from allocation
                  </p>
                ))}
            </section>
          )}
        </div>
        <ProjectDetail
          project={selected}
          employee={employee}
          department={employeeDepartment}
          allDepartments={allDepartments}
        />
      </div>
      {!dataset.tpcLoaded && (
        <p className="notice">TPC information not loaded for this month.</p>
      )}
      {dataset.tpcLoaded && (
        <details className="unallocated-tpcs">
          <summary>Show unallocated TPCs</summary>
          <p>
            These costs have not yet been linked to a project. If you recognise
            one, tell the Office Manager.
          </p>
          {dataset.unallocatedTpcs.length ? (
            dataset.unallocatedTpcs.map((item, index) => (
              <TpcDetail
                key={`${item.originatingMonth}|${item.supplier}|${index}`}
                item={item}
              />
            ))
          ) : (
            <p className="muted">
              There are no outstanding unallocated TPCs in the loaded workbooks.
            </p>
          )}
        </details>
      )}
    </>
  );
}

function money(value: PublicProject["outstandingTpcs"][number]["gross"]) {
  if (value.kind === "amount")
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(value.amount);
  if (value.kind === "text") return value.text;
  return "Not recorded";
}

function TpcDetail({
  item,
}: {
  item: PublicProject["outstandingTpcs"][number];
}) {
  return (
    <article className="tpc-item">
      <strong>{item.supplier}</strong>
      <span>
        {item.originatingDate ?? item.originatingMonth} · {item.description}
      </span>
      {item.projectNumberRaw && (
        <span>Project number entered: {item.projectNumberRaw}</span>
      )}
      <span>
        Net {money(item.net)} · VAT {money(item.vat)} · Gross{" "}
        {money(item.gross)}
      </span>
    </article>
  );
}

function ProjectDetail({
  project,
  employee,
  department,
  allDepartments,
}: {
  project?: PublicProject;
  employee: string;
  department?: string;
  allDepartments: boolean;
}) {
  const visible =
    project?.contributors.filter(
      (item) =>
        allDepartments ||
        item.employee === employee ||
        item.department === "Mixed" ||
        item.department === department,
    ) ?? [];
  const current =
    project?.contributors.find((item) => item.employee === employee)?.hours ??
    0;
  const carried =
    project?.carriedHours.filter((item) => item.employee === employee) ?? [];
  const totalRelevant =
    current + carried.reduce((sum, item) => sum + item.hours, 0);
  const grossTotal =
    project?.outstandingTpcs.reduce(
      (sum, item) =>
        sum + (item.gross.kind === "amount" ? item.gross.amount : 0),
      0,
    ) ?? 0;
  const numericGrossCount =
    project?.outstandingTpcs.filter((item) => item.gross.kind === "amount")
      .length ?? 0;
  return (
    <div className="subpanel">
      <h3>{project?.description ?? "Select a project"}</h3>
      {project && (
        <>
          <h4>Current month hours</h4>
          <p>
            {employee}: {current.toFixed(2)}h
          </p>
          {!!visible.filter((item) => item.employee !== employee).length && (
            <>
              <h4>Relevant colleagues</h4>
              <ul>
                {visible
                  .filter((item) => item.employee !== employee)
                  .map((item) => (
                    <li key={item.employee}>
                      {item.employee} — {item.hours.toFixed(2)}h
                    </li>
                  ))}
              </ul>
            </>
          )}
          {!!carried.length && (
            <>
              <h4>Historical carried hours</h4>
              {carried.map((item, index) => (
                <p key={`${item.originatingMonth}|${index}`}>
                  Carried from {item.originatingMonth} — {item.hours.toFixed(2)}
                  h
                </p>
              ))}
            </>
          )}
          <p>
            <strong>Total relevant hours — {totalRelevant.toFixed(2)}h</strong>
          </p>
          <h4>Outstanding Third Party Costs</h4>
          {project.outstandingTpcs.length ? (
            <>
              {project.outstandingTpcs.map((item, index) => (
                <TpcDetail
                  key={`${item.originatingMonth}|${item.supplier}|${index}`}
                  item={item}
                />
              ))}
              {numericGrossCount > 0 && (
                <p>
                  <strong>
                    Outstanding TPC total:{" "}
                    {money({ kind: "amount", amount: grossTotal })} gross
                  </strong>
                </p>
              )}
            </>
          ) : (
            <p className="muted">No outstanding project TPCs are shown.</p>
          )}
        </>
      )}
    </div>
  );
}

export function PublicViewer() {
  const [publication, setPublication] =
    useState<EncryptedEmployeePublication>();
  const [publicationId, setPublicationId] = useState<string>();
  const [library, setLibrary] = useState<StoredEncryptedPublication[]>([]);
  const [dataset, setDataset] = useState<PublicDataset>();
  const [demo, setDemo] = useState(false);
  const [token, setToken] = useState("");
  const [rememberedTokens, setRememberedTokens] = useState(() =>
    loadRememberedEmployeeViewerTokens(),
  );
  const [remember, setRemember] = useState(() => rememberedTokens.length > 0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    async function loadFromLink() {
      const link = parseEmployeeViewerLink(location.hash);
      setDataset(undefined);
      setPublication(undefined);
      setPublicationId(undefined);
      setDemo(link.kind === "demo" || link.kind === "none");
      setError("");
      if (link.kind === "legacy") {
        setPublication(link.publication);
        return;
      }
      if (link.kind === "invalid") {
        setError("This Employee Viewer link is invalid or incomplete.");
        return;
      }
      if (link.kind !== "publication") return;
      setPublicationId(link.publicationId);
      try {
        const next = await fetchPublishedEmployeePublication(
          link.publicationId,
        );
        if (current) setPublication(next);
      } catch (cause) {
        if (!current) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "The encrypted publication could not be opened.",
        );
      }
    }
    void loadFromLink();
    window.addEventListener("hashchange", loadFromLink);
    listEncryptedPublications()
      .then((items) =>
        setLibrary(
          items.sort((a, b) =>
            b.publication.month.localeCompare(a.publication.month),
          ),
        ),
      )
      .catch(() => undefined);
    return () => {
      current = false;
      window.removeEventListener("hashchange", loadFromLink);
    };
  }, []);

  useEffect(() => {
    let current = true;
    async function unlockWithRememberedToken() {
      if (!publication || dataset || !rememberedTokens.length) return;
      setBusy(true);
      for (const candidate of rememberedTokens) {
        try {
          const next = await decryptEmployeePublication(publication, candidate);
          if (!current) return;
          setToken(candidate);
          setDataset(next);
          await saveEncryptedPublication(publication, publicationId);
          if (current) setBusy(false);
          return;
        } catch {
          // A keyring can contain a code for another historic publication.
        }
      }
      if (current) setBusy(false);
    }
    void unlockWithRememberedToken();
    return () => {
      current = false;
    };
  }, [dataset, publication, publicationId, rememberedTokens]);

  async function unlock() {
    if (!publication) return;
    setBusy(true);
    setError("");
    try {
      const next = await decryptEmployeePublication(publication, token);
      setDataset(next);
      await saveEncryptedPublication(publication, publicationId);
      setLibrary((current) => [
        { id: publicationId ?? publication.month, publication },
        ...current.filter(
          (item) => item.id !== (publicationId ?? publication.month),
        ),
      ]);
      if (remember) setRememberedTokens(rememberEmployeeViewerToken(token));
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
      setPublicationId(undefined);
      setDataset(undefined);
      setDemo(false);
      setError("");
    } catch {
      setError("The selected encrypted publication file is invalid.");
    }
  }

  const shownDataset = dataset ?? (demo ? demoData[0] : undefined);
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
          {!!rememberedTokens.length && (
            <button
              type="button"
              onClick={() => {
                forgetRememberedEmployeeViewerTokens();
                setRememberedTokens([]);
                setRemember(false);
              }}
            >
              Forget remembered Employee Viewer access codes
            </button>
          )}
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
      {!publication && !shownDataset && error && (
        <p className="error" role="alert">
          {error}
        </p>
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
                  (item) => item.id === event.target.value,
                );
                if (selected) {
                  setPublication(selected.publication);
                  setPublicationId(selected.id);
                  setDataset(undefined);
                  setDemo(false);
                  setError("");
                }
              }}
            >
              <option value="">Choose a month</option>
              {library.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.publication.month}
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
