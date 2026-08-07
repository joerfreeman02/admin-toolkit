# Timesheet data model

## Verified source pattern

The EAS archive contains one workbook per employee, a code lookup and monthly sheets. The selected monthly grid uses column A for code, B for description, C for unknown-project detail where applicable, D for the stored monthly total and E onward for daily values. Employee identity is derived from the EAS timesheet filename because template cell C1 can contain a theme label. Each accepted entry retains source file, worksheet, 1-based row, available daily hours and both values used by the TIME-DATA-001 audit.

The parser also accepts a deliberately simple synthetic `Timesheet` table for deterministic fixtures.

## Operational records

`TimeEntry` contains employee/source name, reporting month, optional project code, description, optional internal category, selected hours, optional daily breakdown, hours-authority audit, exactly one classification and source trace. Codes below the internal threshold are projects; configured internal codes/categories are internal; code 10001 (`Unknown Project`) and uncoded work remain exceptions.

An explicit approval may reclassify an individual exception row as an approved uncoded project. The immutable source trace supplies the review key. No bulk or automatic approval exists.

`ConsolidationResult` contains the effective employee snapshot, coded/approved-uncoded project rows, separate internal rows, unresolved exceptions, unknown employees, description conflicts and four-way totals. It may be exported only when its blocker list is empty. Coded projects sort numerically; approved uncoded projects sort last.

The project workbook contains current-month project hours only. The internal workbook contains internal-category rows and a protected audit trace. Carryover remains schema-only/deferred and commercial fields are intentionally manual. `PublicDataset` remains synthetic project identity/contributor/total data and never contains operational source trace or internal categories.
