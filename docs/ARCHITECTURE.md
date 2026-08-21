# NEXUS architecture

```text
Local ZIP/XLSX -> parsing + immutable lineage -> employee resolution -> classification
Latest Job Register XLSM -> values-only project catalogue + local search index --------|
Saved current + historical FY workbooks -> layout/catalogue + carry scan -------|
Employee Register + deliberate decisions -> consolidation -> reconciliation    |
                                                                                 |-> project XLSX + carry audit
                                                                                 |-> internal XLSX + protected audit
                                                                                 `-> minimal approved publication
```

Vite builds a static React/strict-TypeScript application. Uploaded bytes and parsed rows remain local to the browser. There is no application backend, telemetry, workbook-content logging, cloud database or company-server integration.

`processing.ts` expands timesheet ZIPs, selects the requested EAS month sheet, retains the original workbook bytes for safe same-session download, builds a bounded human-readable row context and applies TIME-DATA-001. `employeeRegister.ts` owns versioned effective-dated workforce configuration in browser local storage. `financialYear.ts` derives April-to-March identity and rollover solely from the selected processing month.

`jobRegister.ts` reads the macro-enabled Job Register as OOXML values without executing VBA, validates the named sheet and recognised headers, ignores helper columns, retains ambiguous duplicate numbers as a shortlist, and produces a non-commercial project catalogue. `projectCatalogue.ts` merges that authority with current timesheet and FY-workbook evidence, precomputes searchable text once and returns at most a small ranked set. Fee fields are neither used nor displayed. `workstationStore.ts` persists only the validated safe catalogue and metadata; a later valid upload atomically replaces it.

`monthlyWorkbook.ts` recognises month worksheets by their names, derives FY chronology without trusting filenames or sheet order, locates the established job/employee/carry geometry, verifies the carry legend, and scans every historical employee-hours cell. The newest retained source for an overlapping month wins, so an older green state cannot resurrect hours that the latest copy has closed. Cross-workbook duplicate identity preserves legitimate month/person entries. Missing project numbers, unresolved historical abbreviations, malformed sheets, duplicate months and unsupported fills are surfaced without commercial inference. Historical abbreviations resolve to a stable employee identity and that employee's latest/current registered department, regardless of a later `effectiveFrom` date.

`consolidation.ts` keeps unresolved exceptions fail-closed while treating deliberate Time in Lieu, Unknown and Excluded decisions as completed, separately totalled classifications. Its invariant is source hours = identified project + authorised internal + Time in Lieu + Unknown + Excluded + unresolved. `workbookExport.ts` uses the latest workbook's presentation profile while keeping timesheets as the sole source of current-month hours. Project output ends with visually distinct Time in Lieu, Unknown and Excluded rows; the private internal report has a separate “Other non-project hours” section; both retain employee attribution. Historical Unknown Project carry uses those same distinct rows without inventing a code. Historical carry remains structured by project, employee, department, hours, origin month and source cell.

`AdminProcessing.tsx` presents unresolved current-month employees, uncoded entries and description conflicts as one ordered queue. Only the current item is rendered; a stable session total and separate remaining count make progress clear. Save removes an item from the unresolved set and advances, while skip defers it within the same in-memory queue. Current workbook carry issues follow that queue. `HistoricalReviewPanel.tsx` keeps older-workbook housekeeping in a separate, collapsed one-item queue; closed-year missing-project entries may be retained as Unknown Project carry or marked already dealt with, but Current FY decisions cannot use that exception.

`historicalReview.ts` stores versioned workstation-local decisions. Employee mappings are keyed by normalised historical abbreviation; a synthetic `historical-former:<ABBREVIATION>` identity resolves legacy headings without adding an active employee. Closed-FY “already dealt with” decisions are keyed by month, worksheet, cell, abbreviation, hours, project state and description. Materially changed evidence reopens review. That overlay is ignored for current-FY authority and never bypasses structural errors.

The Employee Register, historical review decisions and authorised-workstation flag persist locally. `workstationStore.ts` retains one replaceable workbook record per financial year, the latest validated Job Register catalogue and encrypted employee publications. The selected processing month determines which record is current; older records are historical and never edited during carry scanning. April output initialises a missing new-year record from the preceding approved layout while retaining the source bytes. Logout clears only the authorised flag; neither the administrative access code nor any production credential is persisted or included in output.

The Employee Viewer plaintext contains approved projects plus minimal employee/month/hour/status values for Unknown and Excluded hours. It excludes original descriptions, source context, internal categories and management audit. Third Party Costs, invoice/rate decisions and accounting integrations remain outside Sprint 1.0A.
