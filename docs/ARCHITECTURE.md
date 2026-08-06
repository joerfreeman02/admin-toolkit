# Architecture

```text
Local File/ZIP → expansion → workbook rows → classification → reconciliation
                                                 ├─ protected in-memory admin views
                                                 └─ explicit sanitiser → public project dataset
```

Vite builds a static React/strict-TypeScript application. `processing.ts` separates code extraction, configured classification, workbook parsing, ZIP expansion, orchestration, reconciliation and public transformation. Zod validates evolving boundary models such as carryover. Uploaded bytes and parsed rows stay in browser memory; there is no fetch, backend, database, analytics, logging of workbook contents, or persistence of source/internal data.

The public model has no source trace or internal-category fields. It is derived only from project and exception entries; the protected internal view consumes the full in-memory result separately. Future exports must consume separate project/internal DTOs after explicit approval. Future carryover records have employee initials, project, originating month, hours and open/closed state; propagation and commercial decisions remain deferred.

The workstation gate compares a token's SHA-256 digest with build configuration and remembers only an authorised flag in local storage. Logout deletes that flag. It can be bypassed by a technically capable browser user and is not server authentication; keeping confidential material out of the static build is the primary control.

Visual language referenced from the current TPT repository: restrained EAS green/lime branding, desktop-first navigation, flat professional panels, visible diagnostics/build identity and static Pages delivery. No code or package was copied or shared.
