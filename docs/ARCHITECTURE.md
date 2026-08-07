# Architecture

```text
Local ZIP/XLSX -> parsing + lineage -> employee resolution -> classification
                                                        |-> coded projects
                                                        |-> internal hours
                                                        `-> review exceptions
                    Employee Register + approvals -> consolidation -> reconciliation
                                                            |-> project XLSX
                                                            `-> internal XLSX + audit trace
```

Vite builds a static React/strict-TypeScript application. Uploaded bytes and parsed rows remain in browser memory. There is no application backend, database, telemetry, workbook-content logging or source-file upload.

`processing.ts` expands ZIPs, selects the requested EAS month sheet, obtains the employee identity from the timesheet filename, retains source lineage, and applies the TIME-DATA-001 hours rule. `employeeRegister.ts` provides locally persisted, versioned, effective-dated employee records. `consolidation.ts` resolves staff, applies explicit uncoded approvals, aggregates project/internal rows, detects project-description conflicts and applies only an Office Manager's explicit observed-description choice for that run. Any unresolved conflict keeps the result fail-closed. `workbookExport.ts` dynamically imports ExcelJS and creates separate outputs.

The project output copies the supplied month's presentation profile where available, preserves the legend colours and project-row structure, inserts dynamically ordered employee columns, sorts coded projects numerically, and places explicitly approved uncoded projects last. A resolved code uses the selected canonical description while retaining every source hour under that code. Carry and notes fields remain blank/manual. The internal workbook is purpose-built, visibly confidential and includes category totals, an overall total, reconciliation/build metadata and a row-level audit trace. That trace retains each original description, the canonical decision and its protected source context; source entries themselves are never rewritten.

All output columns come from a reporting-month Employee Register snapshot. Later employee changes do not reinterpret earlier snapshots. Public data remains a separate synthetic demonstration model; neither real consolidated rows nor internal hours are routed to it.

The workstation gate compares a token's SHA-256 digest with build configuration and stores only an authorised browser flag. It is a convenience boundary, not server authentication. Confidentiality depends on keeping real inputs, registers and outputs outside the repository and deployment.
