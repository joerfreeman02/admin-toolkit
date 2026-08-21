import { useMemo, useState } from "react";
import type { Department, EmployeeRegister, Grade } from "./domain";
import {
  DEPARTMENTS,
  GRADES,
  abbreviationCollisions,
  addEmployee,
  assignmentForMonth,
  changeAssignment,
  employeeSnapshot,
  nextWithinBandOrder,
  updateEmployeeIdentity,
  validateEmployeeRegister,
} from "./employeeRegister";

interface Props {
  register: EmployeeRegister;
  month: string;
  onChange: (register: EmployeeRegister) => void;
}

export function EmployeeRegisterPanel({ register, month, onChange }: Props) {
  const [editingId, setEditingId] = useState<string>();
  const [fullName, setFullName] = useState("");
  const [aliases, setAliases] = useState("");
  const [department, setDepartment] = useState<Department>("Drainage");
  const [grade, setGrade] = useState<Grade>("Engineer");
  const [abbreviation, setAbbreviation] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(month);
  const [withinBandOrder, setWithinBandOrder] = useState(0);
  const [message, setMessage] = useState("");
  const snapshots = useMemo(
    () => employeeSnapshot(register, month, true),
    [register, month],
  );
  const collisions = abbreviationCollisions(register, month);

  function clearForm() {
    setEditingId(undefined);
    setFullName("");
    setAliases("");
    setDepartment("Drainage");
    setGrade("Engineer");
    setAbbreviation("");
    setEffectiveFrom(month);
    setWithinBandOrder(0);
  }

  function beginEdit(id: string) {
    const record = register.employees.find((employee) => employee.id === id);
    const assignment = record && assignmentForMonth(record, month);
    if (!record || !assignment) return;
    setEditingId(id);
    setFullName(record.fullName);
    setAliases(record.aliases.join(", "));
    setDepartment(assignment.department);
    setGrade(assignment.grade);
    setAbbreviation(assignment.abbreviation);
    setEffectiveFrom(month);
    setWithinBandOrder(assignment.withinBandOrder);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!fullName.trim() || !abbreviation.trim()) return;
    const aliasList = aliases
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (editingId) {
      let next = updateEmployeeIdentity(
        register,
        editingId,
        fullName,
        aliasList,
      );
      next = changeAssignment(next, editingId, {
        effectiveFrom,
        department,
        grade,
        abbreviation,
        withinBandOrder,
        active: true,
      });
      onChange(next);
      setMessage("Employee change saved with an effective month.");
    } else {
      onChange(
        addEmployee(register, {
          fullName,
          aliases: aliasList,
          effectiveFrom,
          department,
          grade,
          abbreviation,
          withinBandOrder:
            withinBandOrder ||
            nextWithinBandOrder(register, effectiveFrom, department, grade),
        }),
      );
      setMessage("Employee added to the protected register.");
    }
    clearForm();
  }

  function deactivate(id: string) {
    const record = register.employees.find((employee) => employee.id === id);
    const assignment = record && assignmentForMonth(record, month);
    if (!assignment) return;
    onChange(
      changeAssignment(register, id, {
        effectiveFrom: month,
        department: assignment.department,
        grade: assignment.grade,
        abbreviation: assignment.abbreviation,
        withinBandOrder: assignment.withinBandOrder,
        active: false,
      }),
    );
    setMessage(
      "Employee deactivated from the selected month; history retained.",
    );
  }

  async function importRegister(file?: File) {
    if (!file) return;
    try {
      const parsed = validateEmployeeRegister(JSON.parse(await file.text()));
      onChange(parsed);
      setMessage("Employee Register imported and stored on this workstation.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Employee Register is invalid.",
      );
    }
  }

  function exportRegister() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(register, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "EAS Employee Register.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      className="workbook-area"
      aria-labelledby="employee-register-title"
    >
      <div className="section-heading">
        <div>
          <div>
            <h3 id="employee-register-title">Employee Register</h3>
          </div>
        </div>
        <strong className="persistence-status">
          {snapshots.filter((employee) => employee.active).length} employees —
          ready
        </strong>
      </div>
      <p className="muted">
        The list is saved on this workstation and is ready each month.
      </p>
      {collisions.length > 0 && (
        <p className="error" role="alert">
          Abbreviation collision: {collisions.join(", ")}. Resolve before
          export.
        </p>
      )}
      {message && <p className="status-message">{message}</p>}
      <details className="employee-manager">
        <summary>Manage employee list</summary>
        <details className="backup-restore">
          <summary>Manage / replace Employee Register</summary>
          <p className="muted">
            Download a backup before clearing browser storage or moving to a new
            workstation. Restore that backup once on the replacement
            workstation.
          </p>
          <div className="button-row">
            <label className="secondary-button file-button">
              Replace from backup
              <input
                aria-label="Import Employee Register"
                type="file"
                accept=".json,application/json"
                onChange={(event) => importRegister(event.target.files?.[0])}
              />
            </label>
            <button
              type="button"
              onClick={exportRegister}
              disabled={!register.employees.length}
            >
              Download backup
            </button>
          </div>
        </details>
        {snapshots.length ? (
          <div className="table-wrap register-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Abbreviation</th>
                  <th>Department</th>
                  <th>Grade</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.fullName}</td>
                    <td>{employee.abbreviation}</td>
                    <td>{employee.department}</td>
                    <td>{employee.grade}</td>
                    <td>{employee.active ? "Active" : "Inactive"}</td>
                    <td className="button-row">
                      <button
                        type="button"
                        onClick={() => beginEdit(employee.id)}
                      >
                        Edit
                      </button>
                      {employee.active && (
                        <button
                          type="button"
                          onClick={() => deactivate(employee.id)}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            No employees are configured for this month.
          </div>
        )}
        <details className="editor" open={!!editingId}>
          <summary>{editingId ? "Edit employee" : "Add employee"}</summary>
          <form className="form-grid" onSubmit={save}>
            <label>
              Full name
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </label>
            <label>
              Aliases / known names
              <input
                value={aliases}
                onChange={(event) => setAliases(event.target.value)}
                placeholder="Comma separated"
              />
            </label>
            <label>
              Department
              <select
                value={department}
                onChange={(event) =>
                  setDepartment(event.target.value as Department)
                }
              >
                {DEPARTMENTS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Grade
              <select
                value={grade}
                onChange={(event) => setGrade(event.target.value as Grade)}
              >
                {GRADES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Approved abbreviation
              <input
                value={abbreviation}
                onChange={(event) => setAbbreviation(event.target.value)}
                required
              />
            </label>
            <label>
              Effective month
              <input
                type="month"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                required
              />
            </label>
            <details className="advanced-field">
              <summary>Advanced ordering</summary>
              <label>
                Within-grade order
                <input
                  type="number"
                  min="0"
                  value={withinBandOrder}
                  onChange={(event) =>
                    setWithinBandOrder(Number(event.target.value))
                  }
                />
              </label>
            </details>
            <div className="button-row form-actions">
              <button className="primary" type="submit">
                {editingId ? "Save effective change" : "Add employee"}
              </button>
              <button type="button" onClick={clearForm}>
                Clear
              </button>
            </div>
          </form>
        </details>
      </details>
    </section>
  );
}
