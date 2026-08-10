# Testing

## Automated coverage

Vitest covers parsing/classification, meaningful free-text preservation, EAS filename identity, TIME-DATA-001 auditing, ZIP handling, lineage, Employee Register CRUD/effective dating/ordering/collisions, protected project-catalogue extraction, conservative typo suggestions without automatic acceptance, explicit existing/alternative/genuine-uncoded decisions, prevention of generic grouping, aggregation, conflict resolution, internal separation, reconciliation and styled workbook generation.

Publication tests prove that the minimal dataset excludes internal/source/audit data; unresolved exceptions, conflicts, unknown employees and unreconciled results block publication; the Admin and employee storage keys are separate; encrypted packages/fragments contain no synthetic plaintext values; correct tokens decrypt; wrong tokens and altered ciphertext fail.

Playwright runs Chromium desktop and mobile. It covers the synthetic base viewer, protected route, conflict resolution, Employee Register/session persistence, annual-template IndexedDB import/reload/reopen/reuse/replace/remove, advisory uncoded matching with explicit reversal, output reuse of the stored template, encrypted-fragment handling, wrong/correct Employee Viewer tokens, remembered employee token, employee/project drilldown, confidentiality exclusions, keyboard access and responsive About/creator presentation.

## Required gates

Run from a clean dependency installation:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm build
pnpm audit --prod
```

The production build may emit the existing large-chunk advisory; treat new build errors as failures. CI evidence is reported separately from local evidence and must never be claimed before GitHub Actions completes.

## Workbook verification

Synthetic generated project/internal workbooks must be parsed/reopened and every sheet visually rendered before release. Verify structure, formula results, styles, numeric formats, source-versus-canonical audit columns and confidentiality markings. The annual template supplies structure/presentation and catalogue evidence only; synthetic tests prove current-month values originate from timesheets.

## Confidential local acceptance

Real-file acceptance is a separate, read-only workstation step. Inputs must be copied by the Product Owner into an approved private local directory outside the repository; the Toolkit must not access network shares. Process the selected month, make only explicit controlled review decisions, compare both generated workbooks against prior outputs/template/source evidence, visually inspect every sheet, and report anonymised counts/results only.

Do not mark this gate passed, merge the correction or deploy it while the required local source copies are unavailable. Never commit confidential inputs, generated outputs, screenshots, logs, plaintext publication data or tokens.
