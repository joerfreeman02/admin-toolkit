import { describe, expect, it } from "vitest";
import type { EmployeeRegister } from "../src/domain";
import {
  abbreviationCollisions,
  addEmployee,
  changeAssignment,
  employeeSnapshot,
  emptyEmployeeRegister,
  normaliseGrade,
  resolveEmployee,
} from "../src/employeeRegister";

function add(
  register: EmployeeRegister,
  name: string,
  abbreviation: string,
  department: "Drainage" | "Transport" | "Mixed" | "Sustainability",
  grade:
    | "Director"
    | "Associate Director"
    | "Associate"
    | "Principal Engineer"
    | "Senior Engineer"
    | "Engineer"
    | "Graduate Engineer / Senior Technician"
    | "Admin",
  order?: number,
) {
  return addEmployee(register, {
    fullName: name,
    aliases: [`${name} alias`],
    effectiveFrom: "2026-07",
    department,
    grade,
    abbreviation,
    withinBandOrder: order,
  });
}

describe("Employee Register", () => {
  it("adds and resolves a new employee without a software change", () => {
    const register = add(
      emptyEmployeeRegister(),
      "Employee Alpha",
      "EA",
      "Transport",
      "Engineer",
    );
    expect(
      resolveEmployee(register, "2026-07", "Employee Alpha")?.abbreviation,
    ).toBe("EA");
    expect(
      resolveEmployee(register, "2026-07", "Employee Alpha alias")?.id,
    ).toBe(register.employees[0].id);
  });

  it("normalises Consultant terminology without inventing other grades", () => {
    expect(normaliseGrade("Principal Consultant")).toBe("Principal Engineer");
    expect(normaliseGrade("Senior Consultant")).toBe("Senior Engineer");
    expect(normaliseGrade("Consultant")).toBe("Engineer");
    expect(normaliseGrade("Graduate Consultant")).toBe(
      "Graduate Engineer / Senior Technician",
    );
    expect(normaliseGrade("Expert Witness")).toBeUndefined();
  });

  it("orders departments before grades", () => {
    let register = emptyEmployeeRegister();
    register = add(
      register,
      "Sustainability Graduate",
      "SG",
      "Sustainability",
      "Graduate Engineer / Senior Technician",
    );
    register = add(
      register,
      "Transport Director",
      "TD",
      "Transport",
      "Director",
    );
    register = add(register, "Drainage Engineer", "DE", "Drainage", "Engineer");
    register = add(register, "Mixed Director", "MD", "Mixed", "Director");
    expect(
      employeeSnapshot(register, "2026-07").map(
        (employee) => employee.abbreviation,
      ),
    ).toEqual(["DE", "TD", "MD", "SG"]);
  });

  it("orders grades by seniority within a department", () => {
    let register = emptyEmployeeRegister();
    register = add(
      register,
      "Graduate",
      "G",
      "Drainage",
      "Graduate Engineer / Senior Technician",
    );
    register = add(register, "Director", "D", "Drainage", "Director");
    register = add(register, "Senior", "S", "Drainage", "Senior Engineer");
    register = add(register, "Associate", "A", "Drainage", "Associate");
    expect(
      employeeSnapshot(register, "2026-07").map(
        (employee) => employee.abbreviation,
      ),
    ).toEqual(["D", "A", "S", "G"]);
  });

  it("preserves configured same-grade ordering", () => {
    let register = emptyEmployeeRegister();
    register = add(register, "Second", "S", "Transport", "Engineer", 20);
    register = add(register, "First", "F", "Transport", "Engineer", 10);
    expect(
      employeeSnapshot(register, "2026-07").map(
        (employee) => employee.abbreviation,
      ),
    ).toEqual(["F", "S"]);
  });

  it("places a new employee after existing employees in the same band", () => {
    let register = emptyEmployeeRegister();
    register = add(register, "Existing One", "E1", "Transport", "Engineer");
    register = add(register, "Existing Two", "E2", "Transport", "Engineer");
    register = add(register, "New Starter", "NS", "Transport", "Engineer");
    expect(
      employeeSnapshot(register, "2026-07").map(
        (employee) => employee.abbreviation,
      ),
    ).toEqual(["E1", "E2", "NS"]);
  });

  it("detects abbreviation collisions case-insensitively", () => {
    let register = emptyEmployeeRegister();
    register = add(register, "Employee Alpha", "EA", "Drainage", "Engineer");
    register = add(register, "Employee Beta", "ea", "Transport", "Engineer");
    expect(abbreviationCollisions(register, "2026-07")).toEqual(["EA"]);
  });

  it("applies a future promotion without rewriting the historical snapshot", () => {
    let register = add(
      emptyEmployeeRegister(),
      "Employee Alpha",
      "EA",
      "Transport",
      "Engineer",
    );
    register = changeAssignment(register, register.employees[0].id, {
      effectiveFrom: "2026-09",
      department: "Transport",
      grade: "Senior Engineer",
      abbreviation: "EA",
      withinBandOrder: 0,
      active: true,
    });
    expect(employeeSnapshot(register, "2026-08")[0].grade).toBe("Engineer");
    expect(employeeSnapshot(register, "2026-09")[0].grade).toBe(
      "Senior Engineer",
    );
  });

  it("moves a future department while retaining the prior month", () => {
    let register = add(
      emptyEmployeeRegister(),
      "Employee Alpha",
      "EA",
      "Drainage",
      "Engineer",
    );
    register = changeAssignment(register, register.employees[0].id, {
      effectiveFrom: "2026-10",
      department: "Mixed",
      grade: "Engineer",
      abbreviation: "EA",
      withinBandOrder: 0,
      active: true,
    });
    expect(employeeSnapshot(register, "2026-09")[0].department).toBe(
      "Drainage",
    );
    expect(employeeSnapshot(register, "2026-10")[0].department).toBe("Mixed");
  });

  it("deactivates future months without deleting historic employees", () => {
    let register = add(
      emptyEmployeeRegister(),
      "Employee Alpha",
      "EA",
      "Transport",
      "Engineer",
    );
    register = changeAssignment(register, register.employees[0].id, {
      effectiveFrom: "2026-09",
      department: "Transport",
      grade: "Engineer",
      abbreviation: "EA",
      withinBandOrder: 0,
      active: false,
    });
    expect(employeeSnapshot(register, "2026-08")).toHaveLength(1);
    expect(employeeSnapshot(register, "2026-09")).toHaveLength(0);
    expect(register.employees).toHaveLength(1);
  });
});
