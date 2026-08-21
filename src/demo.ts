import type { PublicDataset } from "./domain";

export const demoData: PublicDataset[] = [
  {
    month: "2026-07",
    employees: [
      { employee: "Employee A", department: "Transport" },
      { employee: "Employee B", department: "Mixed" },
      { employee: "Employee C", department: "Drainage" },
    ],
    projects: [
      {
        code: "2101",
        description: "Station Access Study",
        contributors: [
          { employee: "Employee A", department: "Transport", hours: 14.5 },
          { employee: "Employee B", department: "Mixed", hours: 7.25 },
          { employee: "Employee C", department: "Drainage", hours: 3 },
        ],
        carriedHours: [
          {
            employee: "Employee A",
            department: "Transport",
            originatingMonth: "2026-06",
            hours: 4,
          },
        ],
        outstandingTpcs: [
          {
            originatingDate: "2026-07-10",
            originatingMonth: "2026-07",
            supplier: "Example Mapping Co",
            description: "Mapping data",
            net: { kind: "amount", amount: 100 },
            vat: { kind: "amount", amount: 20 },
            gross: { kind: "amount", amount: 120 },
          },
        ],
        total: 24.75,
      },
      {
        code: "3402",
        description: "Example Corridor Review",
        contributors: [
          { employee: "Employee B", department: "Mixed", hours: 9 },
          { employee: "Employee C", department: "Drainage", hours: 12.5 },
        ],
        carriedHours: [],
        outstandingTpcs: [],
        total: 21.5,
      },
    ],
    statuses: [],
    tpcLoaded: true,
    unallocatedTpcs: [
      {
        originatingMonth: "2026-07",
        supplier: "Example Supplier",
        description: "Unallocated sample cost",
        projectNumberRaw: "N/A",
        net: { kind: "text", text: "n/a" },
        vat: { kind: "blank" },
        gross: { kind: "text", text: "-" },
      },
    ],
  },
];
