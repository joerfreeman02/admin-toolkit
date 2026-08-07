import {
  EmployeeRegisterSchema,
  type Department,
  type EmployeeAssignment,
  type EmployeeRecord,
  type EmployeeRegister,
  type EmployeeSnapshot,
  type Grade,
} from "./domain";

export const EMPLOYEE_REGISTER_KEY = "eas-admin-employee-register-v1";
export const DEPARTMENTS: Department[] = [
  "Drainage",
  "Transport",
  "Mixed",
  "Sustainability",
];
export const GRADES: Grade[] = [
  "Director",
  "Associate Director",
  "Associate",
  "Principal Engineer",
  "Senior Engineer",
  "Engineer",
  "Graduate Engineer / Senior Technician",
  "Admin",
];

const GRADE_ALIASES: Record<string, Grade> = {
  director: "Director",
  "associate director": "Associate Director",
  associate: "Associate",
  "principal engineer": "Principal Engineer",
  "principal consultant": "Principal Engineer",
  "senior engineer": "Senior Engineer",
  "senior consultant": "Senior Engineer",
  engineer: "Engineer",
  consultant: "Engineer",
  "graduate engineer": "Graduate Engineer / Senior Technician",
  "graduate consultant": "Graduate Engineer / Senior Technician",
  "senior technician": "Graduate Engineer / Senior Technician",
  technician: "Graduate Engineer / Senior Technician",
  admin: "Admin",
};

export function normaliseGrade(value: string): Grade | undefined {
  return GRADE_ALIASES[value.trim().toLowerCase()];
}

export function emptyEmployeeRegister(): EmployeeRegister {
  return { version: 1, employees: [] };
}

export function previousMonth(month: string): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function applies(assignment: EmployeeAssignment, month: string) {
  return (
    assignment.effectiveFrom <= month &&
    (!assignment.effectiveTo || assignment.effectiveTo >= month)
  );
}

export function assignmentForMonth(
  employee: EmployeeRecord,
  month: string,
): EmployeeAssignment | undefined {
  return [...employee.assignments]
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
    .find((assignment) => applies(assignment, month));
}

export function employeeSnapshot(
  register: EmployeeRegister,
  month: string,
  includeInactive = false,
): EmployeeSnapshot[] {
  return register.employees
    .flatMap((employee) => {
      const assignment = assignmentForMonth(employee, month);
      if (!assignment || (!assignment.active && !includeInactive)) return [];
      return [
        {
          id: employee.id,
          fullName: employee.fullName,
          aliases: employee.aliases,
          ...assignment,
        },
      ];
    })
    .sort(compareEmployees);
}

export function compareEmployees(a: EmployeeSnapshot, b: EmployeeSnapshot) {
  return (
    DEPARTMENTS.indexOf(a.department) - DEPARTMENTS.indexOf(b.department) ||
    GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade) ||
    a.withinBandOrder - b.withinBandOrder ||
    a.fullName.localeCompare(b.fullName)
  );
}

function normaliseName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveEmployee(
  register: EmployeeRegister,
  month: string,
  sourceName: string,
): EmployeeSnapshot | undefined {
  const target = normaliseName(sourceName);
  return employeeSnapshot(register, month).find(
    (employee) =>
      normaliseName(employee.fullName) === target ||
      employee.aliases.some((alias) => normaliseName(alias) === target),
  );
}

export function abbreviationCollisions(
  register: EmployeeRegister,
  month: string,
): string[] {
  const groups = new Map<string, EmployeeSnapshot[]>();
  for (const employee of employeeSnapshot(register, month)) {
    const key = employee.abbreviation.trim().toUpperCase();
    groups.set(key, [...(groups.get(key) ?? []), employee]);
  }
  return [...groups.entries()]
    .filter(([, employees]) => employees.length > 1)
    .map(([abbreviation]) => abbreviation);
}

export function nextWithinBandOrder(
  register: EmployeeRegister,
  month: string,
  department: Department,
  grade: Grade,
) {
  return (
    Math.max(
      -1,
      ...employeeSnapshot(register, month, true)
        .filter(
          (employee) =>
            employee.department === department && employee.grade === grade,
        )
        .map((employee) => employee.withinBandOrder),
    ) + 1
  );
}

export interface EmployeeDraft {
  fullName: string;
  aliases?: string[];
  effectiveFrom: string;
  department: Department;
  grade: Grade;
  abbreviation: string;
  withinBandOrder?: number;
}

export function addEmployee(
  register: EmployeeRegister,
  draft: EmployeeDraft,
): EmployeeRegister {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `employee-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const withinBandOrder =
    draft.withinBandOrder ??
    nextWithinBandOrder(
      register,
      draft.effectiveFrom,
      draft.department,
      draft.grade,
    );
  return {
    ...register,
    employees: [
      ...register.employees,
      {
        id,
        fullName: draft.fullName.trim(),
        aliases: [...new Set((draft.aliases ?? []).map((item) => item.trim()))],
        assignments: [
          {
            effectiveFrom: draft.effectiveFrom,
            department: draft.department,
            grade: draft.grade,
            abbreviation: draft.abbreviation.trim(),
            withinBandOrder,
            active: true,
          },
        ],
      },
    ],
  };
}

export function addAlias(
  register: EmployeeRegister,
  employeeId: string,
  alias: string,
): EmployeeRegister {
  const normalized = normaliseName(alias);
  return {
    ...register,
    employees: register.employees.map((employee) =>
      employee.id !== employeeId
        ? employee
        : {
            ...employee,
            aliases: [
              ...employee.aliases.filter(
                (item) => normaliseName(item) !== normalized,
              ),
              alias.trim(),
            ],
          },
    ),
  };
}

export interface AssignmentChange {
  effectiveFrom: string;
  department: Department;
  grade: Grade;
  abbreviation: string;
  withinBandOrder: number;
  active: boolean;
}

export function changeAssignment(
  register: EmployeeRegister,
  employeeId: string,
  change: AssignmentChange,
): EmployeeRegister {
  return {
    ...register,
    employees: register.employees.map((employee) => {
      if (employee.id !== employeeId) return employee;
      const assignments = employee.assignments
        .filter(
          (assignment) => assignment.effectiveFrom !== change.effectiveFrom,
        )
        .map((assignment) =>
          assignment.effectiveFrom < change.effectiveFrom &&
          (!assignment.effectiveTo ||
            assignment.effectiveTo >= change.effectiveFrom)
            ? {
                ...assignment,
                effectiveTo: previousMonth(change.effectiveFrom),
              }
            : assignment,
        );
      assignments.push({ ...change });
      return {
        ...employee,
        assignments: assignments.sort((a, b) =>
          a.effectiveFrom.localeCompare(b.effectiveFrom),
        ),
      };
    }),
  };
}

export function updateEmployeeIdentity(
  register: EmployeeRegister,
  employeeId: string,
  fullName: string,
  aliases: string[],
): EmployeeRegister {
  return {
    ...register,
    employees: register.employees.map((employee) =>
      employee.id === employeeId
        ? {
            ...employee,
            fullName: fullName.trim(),
            aliases: [
              ...new Set(aliases.map((item) => item.trim()).filter(Boolean)),
            ],
          }
        : employee,
    ),
  };
}

export function validateEmployeeRegister(value: unknown): EmployeeRegister {
  const register = EmployeeRegisterSchema.parse(value);
  for (const employee of register.employees) {
    const assignments = [...employee.assignments].sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom),
    );
    for (let index = 1; index < assignments.length; index++) {
      const previous = assignments[index - 1];
      if (
        !previous.effectiveTo ||
        previous.effectiveTo >= assignments[index].effectiveFrom
      )
        throw new Error(
          `Overlapping assignment history for ${employee.fullName}`,
        );
    }
  }
  return register;
}

export function loadEmployeeRegister(): EmployeeRegister {
  const stored = localStorage.getItem(EMPLOYEE_REGISTER_KEY);
  if (!stored) return emptyEmployeeRegister();
  try {
    return validateEmployeeRegister(JSON.parse(stored));
  } catch {
    return emptyEmployeeRegister();
  }
}

export function saveEmployeeRegister(register: EmployeeRegister) {
  localStorage.setItem(
    EMPLOYEE_REGISTER_KEY,
    JSON.stringify(validateEmployeeRegister(register)),
  );
}
