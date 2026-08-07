# Sprint 0 scope

## Objective and acceptance

Deliver an independent, publicly testable shell proving local synthetic workbook/ZIP ingestion, project/internal/exception classification, reconciliation, lineage, missing/blank warnings, a persistent workstation gate, and a sanitised public employee viewer.

Included: application shell, upload orchestration, deterministic transformations, protected internal/exception preview, fail-closed synthetic public data, tests, CI/Pages definitions, version/build diagnostics, and carryover model only. Product `ADMIN-0.1.1` and module `TIME-0.1.1` remain Sprint 0 prototypes, not production releases.

Excluded: final invoicing/internal workbook exports, rates and financial decisions, production carryover, real-data publication, backend authentication, databases, telemetry, shared packages, and changes to TPT/DFT. Explicit Office Manager approval of genuine uncoded exceptions is deferred to Sprint 1; unresolved exceptions remain protected in Sprint 0.

## Dependencies and risks

SheetJS, JSZip, Zod, React and Vite are browser-local. Primary risks are variable workbook layout, formula cached-value behaviour, static-gate limitations, public-data leakage, and library size/security. The supplied 22-workbook archive and completed monthly workbook were inspected read-only through an anonymising structural audit. The supplied Office Manager walkthrough was also reviewed: it confirms the monthly process of copying project and consultant headings, transferring hours under consultant initials, sorting by project, consolidating duplicate project rows, and bringing forward prior-month values. No real staff, project or workbook content from those materials is stored in the repository. Exact semantic interpretation of every header/status colour and cached-formula behaviour still requires guided acceptance.
