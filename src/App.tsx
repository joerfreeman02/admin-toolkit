import { useEffect, useState } from "react";
import { AdminProcessing } from "./AdminProcessing";
import type { EmployeeRegister } from "./domain";
import { loadEmployeeRegister, saveEmployeeRegister } from "./employeeRegister";
import { PublicViewer } from "./PublicViewer";
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
      <p className="eyebrow">Protected workstation workflow</p>
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
            onChange={(event) => setToken(event.target.value)}
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

function About() {
  return (
    <section className="panel about-page">
      <p className="eyebrow">About the Toolkit</p>
      <h2>Operational automation with professional control</h2>
      <p>
        Sprint 1 consolidates timesheets locally, separates confidential
        internal hours, and generates controlled Excel outputs. Commercial
        invoice, rate and carryover decisions remain outside this sprint.
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
            <p className="eyebrow">
              Sprint 1 - operational development candidate
            </p>
            <h1>
              Monthly timesheets consolidated with every hour accounted for.
            </h1>
            <p>
              Maintain an effective-dated Employee Register, review exceptions,
              reconcile project and internal time, and generate separate Excel
              workbooks without uploading confidential files.
            </p>
            <div className="cards">
              <button onClick={nav("admin")}>
                <span>Protected</span>
                <strong>Monthly consolidation</strong>
                <small>
                  Employee Register, review, reconciliation and Excel outputs
                </small>
              </button>
              <button onClick={nav("viewer")}>
                <span>Public</span>
                <strong>Synthetic viewer</strong>
                <small>No real employee or project-hour publication</small>
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
              <dd>ADMIN-0.2.0</dd>
              <dt>Module</dt>
              <dd>TIME-0.2.0</dd>
              <dt>Build</dt>
              <dd>{__BUILD_ID__}</dd>
              <dt>Sprint</dt>
              <dd>Sprint 1</dd>
            </dl>
          </section>
        )}
      </main>
      <footer>
        <button onClick={nav("diagnostics")}>
          ADMIN-0.2.0 - TIME-0.2.0 - {__BUILD_ID__}
        </button>
        <span>Created by Joe Freeman</span>
        <span>Files remain on this workstation.</span>
      </footer>
    </>
  );
}
