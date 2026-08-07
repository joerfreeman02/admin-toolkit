# Architecture

```text
Local ZIP/XLSX -> parsing + immutable lineage -> employee resolution -> classification
                                                                  |-> coded projects
Annual template -> protected catalogue ---------------------------|-> explicit uncoded review
                                                                  `-> internal hours

Employee Register + deliberate decisions -> consolidation -> reconciliation
                                                         |-> project XLSX
                                                         |-> internal XLSX + protected audit
                                                         `-> minimal dataset -> encrypt -> link/file
```

Vite builds a static React/strict-TypeScript application. Uploaded bytes and parsed rows remain in browser memory. There is no application backend, database, telemetry, workbook-content logging or source-file upload.

`processing.ts` expands ZIPs, selects the requested EAS month sheet, obtains employee identity from the timesheet filename, preserves meaningful uncoded text, retains source lineage, and applies the TIME-DATA-001 hours rule. `employeeRegister.ts` provides locally persisted, versioned, effective-dated employee records. `projectCatalogue.ts` derives protected code/name evidence from coded current uploads and every relevant sheet in the stored annual workbook. Its conservative text similarity produces advisory suggestions only.

`consolidation.ts` resolves staff and applies only explicit per-row decisions: match to an existing coded project, confirm a meaningfully named genuine uncoded project, or remain unresolved. It aggregates project/internal rows, detects project-description conflicts and accepts only an Office Manager's deliberate observed-description choice. Generic blank identities cannot be approved or grouped. Any unresolved control keeps the result fail-closed. `workbookExport.ts` dynamically imports ExcelJS and creates separate outputs.

The project output copies the stored template's selected-month presentation profile where available; timesheets remain the sole source of current-month hours. It preserves legend colours and project-row structure, inserts dynamically ordered employee columns, sorts coded projects numerically, and places explicitly approved uncoded projects last. A resolved code uses the selected canonical description while retaining every source hour under that code. Carry and notes fields remain blank/manual. The internal workbook is visibly confidential and includes category totals, an overall total, reconciliation/build metadata and a row-level audit trace. That trace retains original code/text, final canonical code/name, the explicit decision and protected source context; source entries themselves are never rewritten.

All output columns come from a reporting-month Employee Register snapshot. Later employee changes do not reinterpret earlier snapshots. The register remains in local storage; the annual workbook and encrypted month library use IndexedDB. Clearing site data removes them, so backup/restore is required when changing workstations.

`publication.ts` creates a minimal project-only dataset after every output control passes and after explicit monthly approval. A separate high-entropy Employee Viewer token derives an AES-256-GCM key with PBKDF2-HMAC-SHA-256, a random salt and 310,000 iterations. The random-IV authenticated ciphertext is encoded in a URL fragment or downloaded as `.easpub`. The base bundle remains synthetic; decryption and the optional encrypted library stay in the browser.

The Admin workstation gate and Employee Viewer token are separate. The former compares a token's SHA-256 digest with build configuration and stores only an authorised browser flag. Neither mechanism is company authentication. Confidentiality depends on approved workstation security and keeping real inputs, plaintext datasets and outputs outside the repository and deployment.
