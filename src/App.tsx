import { useEffect, useState } from "react";
import { AdminProcessing } from "./AdminProcessing";
import type { EmployeeRegister } from "./domain";
import { loadEmployeeRegister, saveEmployeeRegister } from "./employeeRegister";
import { PublicViewer } from "./PublicViewer";
import {
  EMPLOYEE_VIEWER_DEMO_FRAGMENT,
  PUBLICATION_FRAGMENT_PREFIX,
} from "./publication";
import { migrateWorkstationStore } from "./workstationStore";
import creatorPortrait from "./assets/joe-freeman.png";
import "./styles.css";

const AUTH_KEY = "eas-admin-authorised";
type View = "home" | "viewer" | "admin" | "about" | "diagnostics";

function isEmployeeViewerRoute() {
  return (
    location.hash === EMPLOYEE_VIEWER_DEMO_FRAGMENT ||
    location.hash.startsWith(PUBLICATION_FRAGMENT_PREFIX)
  );
}

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
      <h2>Timesheet and Invoicing Hours</h2>
      <p>
        NEXUS brings monthly timesheets, carried hours, project information and
        outstanding Third Party Costs into one controlled workflow. It reduces
        Office Manager administration and gives employees one place to find the
        information they need when preparing invoices.
      </p>
      <h3>EAS FORGE</h3>
      <p>
        EAS FORGE is EAS&apos;s internal research and development programme for
        practical consultancy software. It develops focused tools that reduce
        repetitive administration, improve consistency and make established
        consultancy workflows faster while keeping professional judgement with
        EAS staff.
      </p>
      <section className="creator-section" aria-labelledby="creator-title">
        <img src={creatorPortrait} alt="Portrait of Joe Freeman" />
        <div>
          <p className="eyebrow">Creator</p>
          <h3 id="creator-title">Joe Freeman</h3>
          <p className="creator-role">
            Graduate Transport Planner · Creator of EAS FORGE
          </p>
          <p>
            Joe Freeman is a Graduate Transport Planner at EAS and the creator
            of the EAS FORGE internal software programme. Alongside transport
            planning work, he leads the development of practical internal tools
            through EAS&apos;s dedicated R&amp;D programme, working with
            management and end users to turn recurring consultancy and
            administrative workflows into controlled, tested software.
          </p>
          <strong>Created by Joe Freeman · EAS FORGE</strong>
        </div>
      </section>
    </section>
  );
}

export default function App() {
  const [view, setView] = useState<View>(() =>
    isEmployeeViewerRoute() ? "viewer" : "home",
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
      if (isEmployeeViewerRoute()) setView("viewer");
    };
    window.addEventListener("hashchange", openEmployeePublication);
    return () =>
      window.removeEventListener("hashchange", openEmployeePublication);
  }, []);
  const nav = (target: View) => () => {
    if (target === "viewer" && !isEmployeeViewerRoute())
      location.hash = EMPLOYEE_VIEWER_DEMO_FRAGMENT;
    setView(target);
  };
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
            <p className="eyebrow">NEXUS 1.0.1</p>
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
              <dd>NEXUS 1.0.1</dd>
              <dt>Module</dt>
              <dd>TIME 1.0.0</dd>
              <dt>Build</dt>
              <dd>{__BUILD_ID__}</dd>
              <dt>Release</dt>
              <dd>Production 1.0.1</dd>
            </dl>
          </section>
        )}
      </main>
      <footer>
        <button onClick={nav("diagnostics")}>
          NEXUS 1.0.1 · TIME 1.0.0 · {__BUILD_ID__}
        </button>
        <span>Created by Joe Freeman</span>
        <span>Files remain on this workstation.</span>
      </footer>
    </>
  );
}
