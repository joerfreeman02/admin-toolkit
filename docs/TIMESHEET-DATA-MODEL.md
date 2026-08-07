# Timesheet data model

## Verified source pattern

The EAS archive contains one workbook per employee, a code lookup and monthly sheets. The selected monthly grid uses column A for code, B for description, C for unknown-project detail where applicable, D for the stored monthly total and E onward for daily values. Employee identity is derived from the EAS timesheet filename because template cell C1 can contain a theme label. Each accepted entry retains source file, worksheet, 1-based row, available daily hours and both values used by the TIME-DATA-001 audit.

The parser also accepts a deliberately simple synthetic `Timesheet` table for deterministic fixtures.

## Operational records

`TimeEntry` contains employee/source name, reporting month, optional project code, original description, optional internal category, selected hours, optional daily breakdown, hours-authority audit, exactly one classification, source trace and an optional explicit uncoded-review decision. Codes below the internal threshold are projects; configured internal codes/categories are internal; code 10001 (`Unknown Project`) and uncoded work remain exceptions. For uncoded rows the parser prioritises meaningful employee-entered detail over generic labels.

An explicit decision may match an individual exception to a catalogue project or confirm a meaningfully named genuine uncoded project. The original description is never rewritten. The immutable source trace supplies the review key. Similarity suggestions are advisory; no bulk or automatic approval exists. Blank/generic identities remain exceptions and cannot be silently grouped.

`ConsolidationResult` contains the effective employee snapshot, coded/approved-uncoded project rows, separate internal rows, unresolved exceptions, unknown employees, description conflicts and four-way totals. It may be exported only when its blocker list is empty. Coded projects sort numerically; approved uncoded projects sort last.

The project workbook contains current-month project hours only. The annual workbook provides structure and catalogue evidence, never current-month hour values. The internal workbook contains internal-category rows and a protected audit trace. Carryover remains schema-only/deferred and commercial fields are intentionally manual.

`PublicDataset` contains only reporting month, approved project identity, contributor display identity/hours and project totals. The deployed demonstration instance is synthetic. An approved operational instance exists only inside an encrypted Employee Viewer package; it never contains internal categories, unresolved exceptions, source trace or register administration.
