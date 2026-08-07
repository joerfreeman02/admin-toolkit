# Sprint 1 historical workbook review

## Scope and confidentiality

The supplied historical Hours for Invoicing workbook was copied to a private non-repository QA workspace, imported read-only and rendered sheet by sheet. This record is deliberately anonymised: it contains no employee, project, filename or hour data.

EAS Hours for Invoicing workbooks intentionally use an April-to-March annual cycle. The reviewed workbook's April 2025 through March 2026 worksheet sequence is therefore expected. Although its filename suggests May 2025 to April 2026, that misleading metadata is not evidence that the workbook has the wrong annual period: the worksheet name and sheet content are authoritative for period selection.

## Enduring structural rules

- Each monthly sheet uses the same legend band, project-number and project-name columns, a blank spacer beneath the header, an employee-hours matrix, and two trailing carry/notes columns.
- Coded projects are ordered numerically. Manually uncoded or question-mark rows, when present, appear after the numeric block.
- Employee-hours cells remain numeric and sparse. Project rows keep stable grid geometry, compact row heights and a wide description column.
- The four established colour roles are consistent: hours awaiting invoice, invoices sent, carry-forward, and carried hours subsequently invoiced.
- Carry and notes are operational annotations, not calculated project-hour inputs.

## Historical variation

- Employee-column count and order change across months as staffing changes. The reviewed sheets contain between 16 and 18 employee columns, and later months add or remove approved abbreviations.
- Some months contain no uncoded rows; others contain one or more manual uncoded/write-off rows at the bottom.
- Carry periods, invoice references, write-off notes and row colours vary by project and month. These are historical administrative decisions, not deterministic consolidation rules.
- Monthly project-row counts vary materially, while the header, trailing columns, widths and visual conventions remain recognisable.

## Current Sprint 1 rule

The exporter correctly takes the selected sheet's presentation profile, creates employee columns from the effective-dated register, sorts coded projects numerically, places explicitly approved uncoded rows last, and leaves carry/notes blank for manual control. Current employee ordering follows the authorised department, grade and within-band register order, not a frozen historical staff list.

No exporter correction was justified by the historical evidence. The corrective code change is limited to deliberate project-description conflict resolution and protected audit retention.

## Out of scope

Automatic carry-forward, invoice status, write-off decisions, invoice references and prior-month colour propagation remain outside Sprint 1. Native Excel review remains the manual acceptance authority for final workbook appearance and operational annotations.

Duplicate-month defensive handling is a future robustness item and is not part of this controlled deployment task.
