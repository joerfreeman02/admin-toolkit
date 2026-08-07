# TIME-DATA-001 — Monthly total versus daily-cell source-of-truth

Status: open; must be resolved before generated invoicing workbooks are accepted.

## Anonymised Sprint 0 evidence

The supplied 22-workbook timesheet archive and completed monthly project-hours reference were inspected read-only. For the tested July 2026 parsing path, 49 rows reported a difference between the numeric value in column D and the mathematical sum of the non-zero daily/data cells from column E onward: one row came from one staff workbook and 48 rows came from the completed monthly reference.

All 49 affected column-D cells were stored numeric constants, not formula cells. SheetJS therefore read their stored numeric values directly; it was not reading cached formula results for these affected cells. A full recalculation and save of private temporary copies in Microsoft Excel changed zero affected column-D values and left all 49 differences present. No confidential values, identities, project names or filenames were retained in this record.

The current parser selects the finite numeric column-D value when present and uses the daily-cell sum only when column D is absent or non-numeric. It emits a non-blocking warning when both exist and differ by more than 0.01. Sprint 0 intentionally does not change that source-of-truth rule.

## Required Sprint 1 decision

The Office Manager and Technical Director must decide whether column D, the daily-cell sum, or an explicit validation/approval result is authoritative for invoicing. Acceptance criteria must cover formulas versus constants, workbook recalculation state, tolerance/rounding, blank days, and exception handling before any generated invoicing workbook is approved.
