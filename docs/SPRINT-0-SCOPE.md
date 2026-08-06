# Sprint 0 scope

## Objective and acceptance

Deliver an independent, publicly testable shell proving local synthetic workbook/ZIP ingestion, project/internal/exception classification, reconciliation, lineage, missing/blank warnings, a persistent workstation gate, and a sanitised public employee viewer.

Included: application shell, upload orchestration, deterministic transformations, protected internal preview, synthetic public data, tests, CI/Pages definitions, version/build diagnostics, and carryover model only.

Excluded: final invoicing/internal workbook exports, rates and financial decisions, production carryover, real publication, backend authentication, databases, telemetry, shared packages, and changes to TPT/DFT.

## Dependencies and risks

SheetJS, JSZip, Zod, React and Vite are browser-local. Primary risks are variable workbook layout, formula cached-value behaviour, static-gate limitations, public-data leakage, and library size/security. The supplied 22-workbook archive and completed monthly workbook were inspected read-only through an anonymising structural audit; no Office Manager walkthrough was available. Exact semantic interpretation of every header/status colour and cached-formula behaviour still requires guided acceptance.
