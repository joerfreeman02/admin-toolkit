# ADR-0005: ExcelJS for styled workbook output

Status: accepted for Sprint 1 candidate.

## Decision

Retain SheetJS for input parsing and add ExcelJS 4.4.0 for styled XLSX generation. Load ExcelJS dynamically at export time. Pin the dependency and override ExcelJS's transitive `uuid` dependency to patched 11.1.1.

## Rationale

Sprint 1 requires template-aware cell styles, widths, fills, borders, merged cells, formulas and multiple output sheets. ExcelJS provides those workbook-writing capabilities in the browser without changing the existing proven parser.

## Consequences

The export chunk is large but deferred until requested. Both libraries remain separately testable. Generated workbooks require parse-level assertions plus visual rendering. Dependency audit and compatibility tests must run after any override or ExcelJS upgrade.
