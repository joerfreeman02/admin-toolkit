# Testing

## Automated coverage

Vitest covers parsing/classification, EAS filename identity, TIME-DATA-001 auditing, ZIP handling, lineage, Employee Register CRUD/effective dating/ordering/collisions, new-employee blocking, approvals, aggregation, numeric sorting, deliberate project-description resolution, protected conflict audit retention, internal separation, reconciliation, styled XLSX generation and fail-closed export. React tests cover the protected shell, exact versions and creator attribution.

Playwright runs desktop and mobile Chromium projects. It covers the landing page, synthetic public viewer, absence of protected conflict context in public, protected route, observed-choice conflict resolution, export blocker removal, remembered workstation state, logout, build diagnostics, keyboard activation, responsive About page, approved portrait and creator credit.

Candidate evidence:

- `56` Vitest tests pass after the conflict-resolution and protected-audit regressions were added.
- `10` Playwright checks pass across desktop/mobile projects.
- lint, formatting check, strict TypeScript and production build pass.
- `pnpm audit --prod` reports no known vulnerabilities.
- all generated workbook sheets were imported and rendered with the spreadsheet artifact runtime for visual inspection.

## Isolated real-file acceptance

The confidential inputs were copied to a non-repository private workspace and processed locally. The pass detected all 22 workbooks with no fatal parse errors or unresolved employee identities. All imported hours reconciled across project, internal and exception buckets. One source total/daily discrepancy was retained and warned under the resolved TIME-DATA-001 rule.

The July reference/manual-output coded matrix comparison covered 427 populated union cells: 425 matched and two were the expected one-sided manual omission/addition pattern. Every overlapping populated cell matched. Thirty-three exception rows and three conflicting project-code descriptions remained deliberately unresolved, so real export correctly failed closed pending Office Manager decisions. The confidential starter register passed the application's JSON import validator and resolved all 22 source identities.

Synthetic employee/project data then exercised deliberate resolution of one and multiple conflicts. Hours remained aggregated under each code, only selected observed descriptions entered project output, unresolved conflicts continued to block, and original descriptions plus decisions remained in the protected audit. Both the project workbook and separate internal workbook were parsed and visually inspected. No confidential output is stored in this repository; native Excel appearance remains a manual acceptance step.

## Commands

`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, `pnpm test:e2e`, `pnpm build`, and `pnpm audit --prod`.

Live token checks and Office Manager decisions on unresolved real exceptions/conflicts remain Product Owner manual acceptance activities.

## Product Owner acceptance access

A substantive acceptance handover should make the reviewed candidate available through the normal stable Toolkit test URL wherever technically appropriate. The Product Owner must not normally be asked to run a localhost development server, select a deployment branch, troubleshoot GitHub Actions, or administer the repository/deployment simply to reach an acceptance candidate.
