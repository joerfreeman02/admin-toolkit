# Timesheet data model

## Verified source pattern

The EAS archive contains one workbook per employee, a code lookup and monthly sheets. The selected monthly grid uses column A for code, B for description, C for unknown-project detail where applicable, D for the stored monthly total and E onward for daily values. Employee identity is derived from the EAS timesheet filename because template cell C1 can contain a theme label. Each accepted entry retains source file, worksheet, 1-based row, available daily hours and both values used by the TIME-DATA-001 audit.

The parser also accepts a deliberately simple synthetic `Timesheet` table for deterministic fixtures.

## Operational records

`TimeEntry` contains employee/source name, reporting month, optional project code, original description, optional internal category, selected hours, optional daily breakdown, hours-authority audit, exactly one classification, source trace, bounded row context and an optional explicit review decision. Codes below the internal threshold are projects; configured internal codes/categories are internal; code 10001 (`Unknown Project`) and uncoded work initially remain exceptions.

An explicit decision may match an exception to a catalogue project, map it to an authorised observed internal category, classify it as authorised non-project Time in Lieu, leave it as Unknown Project, or exclude it from allocation. Time in Lieu has no fabricated EAS code and is never published to employees. Unknown and Excluded are completed classifications, not unresolved exceptions. The original description and source record are never rewritten or deleted. The immutable source trace supplies the review key. Suggestions are advisory; no bulk or automatic approval exists.

`ConsolidationResult` contains the effective employee snapshot, project rows, separate internal rows, per-employee Time in Lieu/Unknown/Excluded totals, unresolved exceptions, unknown employees and description conflicts. Its exact invariant is source = identified project + authorised internal + Time in Lieu + Unknown + Excluded + unresolved. Export remains blocked only while a genuine unresolved decision or structural control remains.

The current-month employee matrix is sourced only from timesheets. Saved current and historical April-to-March workbooks provide structure, catalogue evidence and the latest commercial colour state. Every recognised month sheet is scanned in derived chronological order; a positive employee-hours cell is carried only while the newest retained source for that month is solid green `#92D050`. Each valid record retains project number/description, employee, latest/current department, hours, originating month and year, source workbook, worksheet, row/column/cell and status. Duplicate copies are suppressed without collapsing distinct month/person entries. The project workbook keeps these records separate from current hours and writes person-level source detail to `Carry-over Audit`. Invoice, rate and write-off decisions remain manual/out of scope.

`PublicDataset` contains only reporting month, approved project identity/contributors/totals and neutral employee/hour/status records for Unknown or Excluded hours. It never contains original Unknown/Excluded wording, internal categories, unresolved exceptions, source trace or register administration.
