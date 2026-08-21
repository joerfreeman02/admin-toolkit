import { useEffect, useState } from "react";
import { AdminProcessing } from "./AdminProcessing";
import type { EmployeeRegister } from "./domain";
import { loadEmployeeRegister, saveEmployeeRegister } from "./employeeRegister";
import { PublicViewer } from "./PublicViewer";
import { migrateWorkstationStore } from "./workstationStore";
import creatorPortrait from "./assets/joe-freeman.png";
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

function AdminGate({ onAuthorise }: { onAuthorise: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const expected = import.meta.env.VITE_ADMIN_TOKEN_SHA256 as
      | string
      | undefined;
    if (!expected) {
      setError("NEXUS access is not configured on this computer.");
      return;
    }
    if ((await sha256(token)) !== expected) {
      setError("Access code not recognised.");
      return;
    }
    localStorage.setItem(AUTH_KEY, "true");
    onAuthorise();
  }
  return (
    <section className="panel gate">
      <p className="eyebrow">Protected workstation workflow</p>
      <h2>Administrative access</h2>
      <p>
        Enter the NEXUS access code for this computer. NEXUS will remember this
        authorised workstation until you sign out or reset access.
      </p>
      <form onSubmit={submit}>
        <label>
          Access code
          <input
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary">Unlock NEXUS</button>
      </form>
    </section>
  );
}

function About() {
  return (
    <section className="panel about-page">
      <p className="eyebrow">About NEXUS</p>
      <h2>Operational automation with professional control</h2>
      <p>
        NEXUS consolidates timesheets locally, separates confidential internal
        hours, and carries forward only the person-level historical hours that
        the saved financial-year workbooks still mark green. Invoice and rate
        decisions remain outside this sprint.
      </p>
      <section className="creator-section" aria-labelledby="creator-title">
        <img src={creatorPortrait} alt="Portrait of Joe Freeman" />
        <div>
          <p className="eyebrow">Creator</p>
          <h3 id="creator-title">Joe Freeman</h3>
          <p className="creator-role">
            Creator &amp; Product Owner — AI Engineering Toolkits
          </p>
          <p>
            Joe Freeman conceived and leads the development of the EAS AI
            Engineering Toolkits programme after identifying recurring
            consultancy tasks that were repetitive, time-consuming and capable
            of being improved through carefully controlled automation.
          </p>
          <p>
            Beginning with the Transport Planner Toolkit, the programme has
            expanded into drainage, flood risk and administrative workflows,
            with the aim of creating practical software designed around the way
            consultants actually work.
          </p>
          <p>
            Joe defines the real-world workflows and product requirements,
            directs the development programme and manually tests each release.
            The Toolkits are intended to improve efficiency, consistency,
            traceability and quality while keeping professional judgement at the
            centre of the consultancy process.
          </p>
          <strong>Created by Joe Freeman · EAS AI Engineering Toolkits</strong>
        </div>
      </section>
    </section>
  );
}

export default function App() {
  const [view, setView] = useState<View>(() =>
    location.hash.startsWith("#employee-viewer=") ? "viewer" : "home",
  );
  const [authorised, setAuthorised] = useState(
    localStorage.getItem(AUTH_KEY) === "true",
  );
  const [register, setRegister] = useState<EmployeeRegister>(() =>
    loadEmployeeRegister(),
  );
  useEffect(() => saveEmployeeRegister(register), [register]);
  useEffect(() => {
    void migrateWorkstationStore().catch(() => {
      // Persistence failures remain visible when a protected store is used.
    });
  }, []);
  useEffect(() => {
    const openEmployeePublication = () => {
      if (location.hash.startsWith("#employee-viewer=")) setView("viewer");
    };
    window.addEventListener("hashchange", openEmployeePublication);
    return () =>
      window.removeEventListener("hashchange", openEmployeePublication);
  }, []);
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
            <strong>NEXUS</strong>
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
            <p className="eyebrow">NEXUS 1.0A - controlled release candidate</p>
            <h1>Monthly timesheets turned into clear, ready-to-use reports.</h1>
            <p>
              NEXUS checks the month&apos;s timesheets, helps with anything it
              cannot identify, and creates the project-hours information staff
              need to prepare invoices.
            </p>
            <div className="cards">
              <button onClick={nav("admin")}>
                <span>Protected</span>
                <strong>Create monthly reports</strong>
                <small>
                  Check timesheets and download project and internal-hours files
                </small>
              </button>
              <button onClick={nav("viewer")}>
                <span>Employees</span>
                <strong>View approved project hours</strong>
                <small>Open information that has been approved for staff</small>
              </button>
            </div>
          </section>
        )}
        {view === "viewer" && <PublicViewer />}
        {view === "admin" &&
          (authorised ? (
            <AdminProcessing
              logout={logout}
              register={register}
              onRegisterChange={setRegister}
            />
          ) : (
            <AdminGate onAuthorise={() => setAuthorised(true)} />
          ))}
        {view === "about" && <About />}
        {view === "diagnostics" && (
          <section className="panel">
            <h2>Build information</h2>
            <dl>
              <dt>Product</dt>
              <dd>NEXUS-1.0.0-rc.2</dd>
              <dt>Module</dt>
              <dd>TIME-1.0.0-rc.2</dd>
              <dt>Build</dt>
              <dd>{__BUILD_ID__}</dd>
              <dt>Sprint</dt>
              <dd>Sprint 1.0A.3</dd>
            </dl>
          </section>
        )}
      </main>
      <footer>
        <button onClick={nav("diagnostics")}>
          NEXUS-1.0.0-rc.2 - TIME-1.0.0-rc.2 - {__BUILD_ID__}
        </button>
        <span>Created by Joe Freeman</span>
        <span>Files remain on this workstation.</span>
      </footer>
    </>
  );
}
