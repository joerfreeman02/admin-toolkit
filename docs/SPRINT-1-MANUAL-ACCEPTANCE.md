# Sprint 1 manual acceptance script

Use the normal deployed URL. Keep all operational inputs and generated outputs on the authorised local workstation. Never attach them to GitHub or record confidential values in acceptance evidence.

1. Sign in to Admin Processing with the existing Admin token. Confirm invalid input is rejected, a valid authorisation survives reload, and Logout / reset revokes the workstation flag.
2. Confirm the Employee Register says it is saved on this workstation. Add/edit a synthetic employee, reload, confirm the change persists, then test effective-dated deactivation. Confirm backup/restore is secondary and no monthly import is required.
3. On first use, choose an approved annual Hours for Invoicing workbook. Reload/reopen and confirm its filename remains available without selecting it again. Exercise Replace and Remove only with controlled local test copies.
4. Select July 2026 and process the controlled local timesheet ZIP/workbooks. Confirm coded project hours come from timesheets, not existing template hour cells, and project/internal/exception totals reconcile exactly.
5. For each unknown/free-text project row, confirm the employee-entered wording is useful. Check that any possible project is only a suggestion. Test Confirm this match, search/select another project, Keep as genuinely uncoded and Leave unresolved. No bulk approval.
6. Create/identify conflicting descriptions for one project code. Confirm output is blocked until a deliberate observed canonical name is selected and original values remain visible only in protected context/audit.
7. With every control resolved, generate both workbooks. Open them in native Excel and inspect employee order, numeric project sort, uncoded-last placement, totals, legend/style, confidential internal separation, creator/build metadata and original/final audit fields.
8. In Employee Viewer Access, generate a separate employee token and save it securely. Confirm it is not the Admin token. Select Remember only on an approved workstation.
9. Tick the explicit monthly approval and publish. Confirm the copied link contains an encrypted fragment but no recognisable employee/project/hour plaintext; retain the encrypted `.easpub` fallback if required.
10. Open the employee-view link. Confirm a wrong token fails, the correct token opens the approved month, employees see their projects/hours and project drilldown shows contributors/total. Confirm internal hours, audit/source context and unresolved entries are absent. Reopen the stored encrypted month and test remembered-token behaviour.

Record pass/fail evidence in anonymised form. Sprint 1 remains untagged and unfrozen until Product Owner acceptance.
