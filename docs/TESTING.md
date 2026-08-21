# Testing NEXUS

Run the controlled checks with Node 22 / pnpm 11:

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm audit --prod
```

Vitest covers parsing, exact reconciliation, Employee Register controls, publication privacy and workbook generation. NEXUS 1.0B additionally covers rendered Current/Previous FY carry actions and persistence; TPC financial-year chronology, red/black status, newest-copy authority, project/unallocated review decisions, messy monetary values and publication privacy; plus desktop/mobile Employee Viewer carry, TPC and department-filtering behaviour.

Playwright runs the full scenario set on desktop and mobile. It covers persistent/replaced Job Registers, compact indexed search without a large dropdown, advisory one-click resolutions, safe source download, bounded surrounding-row context, plain report/publication wording, Unknown/Excluded completion, separate persistent historical review, April rollover, encrypted publication and responsive UI.

Real fixtures are opt-in and remain outside Git. Set these variables to approved local read-only paths, then run the single acceptance test:

```sh
NEXUS_ACCEPTANCE_REGISTER=/private/register.json \
NEXUS_ACCEPTANCE_WORKBOOK=/private/latest.xlsx \
NEXUS_ACCEPTANCE_PREVIOUS_WORKBOOK=/private/previous-fy.xlsx \
NEXUS_ACCEPTANCE_TIMESHEETS=/private/timesheets.zip \
NEXUS_ACCEPTANCE_JOB_REGISTER=/private/job-register.xlsm \
pnpm exec vitest run tests/realFixtures.test.ts --reporter=verbose
```

The acceptance test reports counts only. It validates the register, scans all 16 supplied current/previous workbook months, resolves cross-FY carry where the register permits, processes every timesheet, parses the real Job Register at operating scale and proves its source hash is unchanged without copying fixture data into the repository.

Generated workbook verification must reopen every output, inspect key values/styles/formulas, and visually render every sheet. Real commercial acceptance remains a separate Product Owner/Technical Director review.
