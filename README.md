# EAS Admin Toolkit

Browser-local administrative tooling for controlled timesheet processing. The Sprint 1 candidate adds monthly consolidation, workstation-persistent reference data, explicit exception review, separate project/internal Excel outputs and an interim encrypted Employee Viewer publication pilot.

> Never commit or publish real timesheets, generated outputs, internal hours, credentials or employee records.

## Status and versions

- Controlled acceptance candidate: product `ADMIN-0.2.0`, module `TIME-0.2.0`.
- Sprint 1 remains an acceptance candidate awaiting Product Owner manual acceptance. It is not an accepted or frozen baseline and has no Sprint 1 tag.
- The accepted Sprint 0 baseline remains frozen at main SHA `d575ab58957aedf15b68f780ebe5bdddb84f0175` and tag `sprint-0-admin-0.1.1-time-0.1.1`.
- Build identity comes from `GITHUB_SHA`, falling back to `local-dev`.
- The deployed base viewer contains synthetic demonstration data only. Approved project-only data can be supplied separately as a client-side encrypted URL-fragment package or `.easpub` file.

## Local development

Requires Node 22 and pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm audit --prod
```

Set `VITE_ADMIN_TOKEN_SHA256` to a SHA-256 digest in a local `.env`; never store the token itself. The digest is compiled into the static build and the browser-only gate is not server authentication.

The protected flow is: select month, use the workstation-persistent Employee Register and annual template, upload a ZIP or workbooks, process locally, resolve new employees/exceptions/conflicts, verify reconciliation, preview, and download separate workbooks. An Office Manager may then explicitly approve a minimal project-hours dataset for encrypted employee publication. Unresolved exceptions, unknown employees, description conflicts, abbreviation collisions, unreadable files or failed reconciliation block output.

## Major dependencies

React and Vite provide the static application. SheetJS parses workbooks locally, JSZip expands uploads, Zod validates boundary data, and ExcelJS generates styled XLSX output. ExcelJS is dynamically loaded only for export; pnpm overrides its vulnerable transitive `uuid` release to patched `11.1.1`. The production dependency audit is clean at candidate preparation.

See [Sprint 1 scope](docs/SPRINT-1-SCOPE.md), [architecture](docs/ARCHITECTURE.md), [Employee Register](docs/EMPLOYEE-REGISTER.md), [testing](docs/TESTING.md), [security](docs/CONFIDENTIALITY-AND-SECURITY.md), [TIME-DATA-001](docs/TIME-DATA-001.md), the [historical workbook review](docs/SPRINT-1-HISTORICAL-WORKBOOK-REVIEW.md), and the [manual acceptance script](docs/SPRINT-1-MANUAL-ACCEPTANCE.md).
