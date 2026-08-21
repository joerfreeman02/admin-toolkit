import type { PublicDataset } from "./domain";

export const demoData: PublicDataset[] = [
  {
    month: "2026-07",
    projects: [
      {
        code: "2101",
        description: "Station Access Study",
        contributors: [
          { employee: "Employee A", hours: 14.5 },
          { employee: "Employee B", hours: 7.25 },
        ],
        total: 21.75,
      },
      {
        code: "3402",
        description: "Synthetic Corridor Review",
        contributors: [
          { employee: "Employee B", hours: 9 },
          { employee: "Employee C", hours: 12.5 },
        ],
        total: 21.5,
      },
      {
        description: "Awaiting project code",
        contributors: [{ employee: "Employee A", hours: 2.5 }],
        total: 2.5,
      },
    ],
    statuses: [],
  },
];
