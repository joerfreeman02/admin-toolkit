# Timesheet data model

## Verified source patterns

The confidential reference archive was inspected read-only and contained 22 readable Excel workbooks. Each sampled staff workbook has 13 visible sheets: a project-code lookup sheet (up to 10,000 rows) followed by 12 monthly sheets. Monthly sheets have 101–102 rows and 32–36 columns. Row 4 is the entry header; column A is project code, B is the formula-derived project description, D is the monthly total, and E onward are daily columns. Rows 1–3 contain employee/month/date and control totals. Codes from `10000` upward are used for internal activities; the lookup includes confirmed categories such as Admin, Travel, Bids, Finance, IT, Research, Team Meetings and Holiday. Each accepted entry retains source file, worksheet, 1-based source row and available daily hours.

The completed monthly project-hours reference has four visible sheets, 229–256 rows and 23–26 columns. Project codes are in column B, descriptions in C, contributor-hour columns occupy the middle section, and trailing text/status columns vary by sheet. Header rows shift between 8 and 9 across sheets, confirming that future output replication must be template-aware rather than hard-coded. This workbook is a Sprint 1 reference only; Sprint 0 does not reproduce it.

The parser also accepts a deliberately simple synthetic `Timesheet` table with `Employee`, `Month`, `Project Code`, `Description`, optional `Category`, and `Hours` for deterministic fixtures. Column D is selected whenever it contains a finite numeric monthly value; daily cells are summed only when that value is absent. Differences remain warnings and are governed by TIME-DATA-001.

`TimeEntry` contains employee, reporting month, optional project code, description, optional internal category, monthly/daily hours, exactly one classification, validation context, and lineage. Codes below configurable `INTERNAL_CODE_MINIMUM` are projects; codes at/above it and configured category names are internal; uncoded work is an exception and remains employee-linked.

Protected aggregation retains row lineage and reconciles total = project + internal + exception. The public transformation admits only `project` classifications. Internal and unresolved exception records, including mistyped internal-like descriptions, fail closed and remain protected. Sprint 1 will define explicit Office Manager approval before a genuine uncoded exception can be published. Missing/blank employee records remain warnings/audit state and create no hours.

`Carryover` is schema-validated with initials, positive hours, project, `YYYY-MM` origin, and open/closed status. `PublicDataset` contains month, project identity, contributors and totals only—never internal category, warning, filename, worksheet or row.
