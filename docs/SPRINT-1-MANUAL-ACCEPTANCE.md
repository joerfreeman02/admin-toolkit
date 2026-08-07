# Sprint 1 manual acceptance script

Use synthetic files first. Use real files only on the authorised workstation and never attach them to GitHub.

1. Confirm the footer shows `ADMIN-0.2.0`, `TIME-0.2.0` and the candidate build SHA.
2. Open About and confirm Joe Freeman's approved portrait, role and creator wording on desktop and mobile width.
3. Verify an invalid administrative token is rejected, a valid token authorises, reload remembers the session, and logout revokes it.
4. Import or create a local Employee Register; export a backup; restore it; verify no real employee appears in the public viewer.
5. Add a synthetic starter, detect them in an upload, resolve them without a code change, then test abbreviation collision blocking.
6. Create future promotion, department-move and deactivation assignments; confirm future output order changes and the earlier month snapshot does not.
7. Select a month and master/template, upload synthetic ZIP/XLSX files, and confirm source filenames/rows appear only in the protected review.
8. Confirm coded projects aggregate by code and employee, numeric project ordering is correct, internal rows are separate, and repeated rows consolidate.
9. Confirm an uncoded/unknown-project row blocks export until explicitly approved as a genuine uncoded project; confirm an unapproved row never enters output.
10. Create two observed descriptions for one synthetic project code. Confirm the protected resolver shows the code, both descriptions and source file/sheet/row context, and that export is initially blocked.
11. Select one observed description as canonical. Confirm all hours remain under the single code, only the canonical description enters the project preview/output, and both originals plus the decision remain in the protected audit. Automatic/fuzzy choices are not permitted.
12. Create a second conflict. Resolve only the first and confirm the second still blocks; resolve both and confirm the conflict blocker clears when no other blocker remains.
13. Confirm unknown employees, abbreviation collisions and failed reconciliation block export.
14. Confirm imported = project + internal + exception and review any TIME-DATA warning showing retained column-D and daily totals.
15. Generate both workbooks from a fully resolved synthetic run. Open them in native Excel and verify layout, employee order, legend colours, totals, confidential marking and audit trace. Carry/notes must remain blank/manual.
16. For authorised real-file acceptance, review each exception and description conflict explicitly. Do not bulk approve. Confirm export remains blocked until all decisions are recorded.
17. Confirm the public deployment/bundle contains only synthetic data and no Office files, outputs, registers, conflict source context, plaintext credentials or internal hours.

Record pass/fail evidence without employee names, project names, filenames or hour values. Do not merge the draft PR during this script.
