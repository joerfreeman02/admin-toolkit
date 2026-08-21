# NEXUS

Browser-local administrative tooling for controlled timesheet processing. NEXUS 1.0A.3.2 keeps the proven processing and carry engines while adding a persistent Job Register catalogue, rapid one-click resolutions and complete hour accountability.

> Never commit or publish real timesheets, generated outputs, internal hours, credentials, Employee Register records or acceptance fixtures.

## Status and versions

- Development release candidate: product `NEXUS-1.0.0-rc.2`, module `TIME-1.0.0-rc.2`.
- This is not an accepted, frozen or production `1.0.0` release.
- Starting pre-sprint candidate: `ADMIN-0.2.0 / TIME-0.2.0` at `def244ccbfcc1e688296f29f2469eba5a453c2c7`.
- Last accepted recovery baseline: tag `sprint-0-admin-0.1.1-time-0.1.1` at `5b99054ea78bdfc77369c7215bb0cf7530a6c8f4` (merged main baseline `d575ab58957aedf15b68f780ebe5bdddb84f0175`).
- Build identity comes from `GITHUB_SHA`, falling back to `local-dev`.

## Monthly workflow

1. **Add this month's files**: select the month, confirm the saved Employee Register, hours workbooks and latest Job Register, then add the timesheets/ZIP. A valid replacement Job Register becomes the saved local project catalogue.
2. **Review anything NEXUS couldn't identify** one item at a time. Suggested project/internal matches, **Use Time in Lieu**, **Leave as Unknown Project**, **Exclude these hours** and **Treat as former employee** save and advance in one deliberate click. Progress retains the original session total while separately showing the unresolved count. **Skip for now** advances without resolving the item.
3. **Create monthly reports** for project and protected internal hours.
4. **Publish employee viewer** only after deliberate approval.

The Current FY workbook is replaced after each valid upload and retained on the workstation. Earlier April-to-March workbooks can be retained as read-only history. NEXUS scans every recognised worksheet across those workbooks, independent of filename and sheet order. For an overlapping month, the latest saved copy is the source of truth; only cells still green `#92D050` are carried. Historical employees are identified from their source abbreviation and described using their latest/current registered assignment. The Employee Register never creates attendance or hours absent from the source workbook.

The selected processing month controls rollover. March remains in the closing FY even when processed during April. Processing April deliberately starts the new FY: the preceding workbook remains unchanged, open carries remain available, and the first April project report initialises the new Current FY workbook from the approved structure.

Current-month items are reviewed before workbook carry issues. Compact **This financial year** and **Previous financial years** queues remain closed until deliberately opened, with one active carry card at a time. Former-employee mappings and authorised historical project decisions persist on the workstation. A Current FY carried entry with no project number can be kept as an Unknown Project carry, but only the authoritative workbook can close it. For a closed-year carried entry with no project number, the Office Manager can either mark it already dealt with or keep it as an Unknown Project carry. Neither option alters a source workbook or bypasses Current FY authority. Stable source fingerprints prevent unchanged issues being requested every month; changed employee, project, hours or source-cell evidence creates a new review item. The normal report step shows concise readiness/download cards rather than full browser tables.

The Job Register is read values-only; macros are never executed and the source workbook is never saved over. It supplies project identity/search evidence only. The Current FY hours workbook remains authoritative for commercial colour and carry status. Suggestions are advisory, capped to a small shortlist and never silently assigned.

Every source hour is accounted for exactly once as identified project, authorised internal, Time in Lieu, Unknown/Unallocated, Excluded, or still unresolved. Time in Lieu is an authorised NEXUS non-project category with no fabricated EAS code; it appears only in private reports. Deliberate Unknown and Excluded outcomes appear as separate rows in both private reports. Employees see only neutral month/hour/status totals for their own Unknown or Excluded hours; original wording, filenames, rows, Time in Lieu and management detail remain protected.

Employee Register records persist in browser local storage. The workstation-authorised flag persists through refresh and normal browser reopen; **Logout / reset** clears it. The token itself is never stored: the build contains only the configured SHA-256 digest.

## Local development

Requires Node 22 and pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm audit --prod
```

Set `VITE_ADMIN_TOKEN_SHA256` to a test or operational SHA-256 digest in a local `.env`; never store the token itself. This browser-only gate is not server authentication.

## Scope boundary

Sprint 1.0A excludes Third Party Costs, invoice generation, values/rates, automatic commercial invoice/write-off decisions, accounting integrations, cloud/server architecture and company-server access. The TPC workflow remains later controlled work.

See [architecture](docs/ARCHITECTURE.md), [testing](docs/TESTING.md), [Employee Register](docs/EMPLOYEE-REGISTER.md), [security](docs/CONFIDENTIALITY-AND-SECURITY.md), [timesheet model](docs/TIMESHEET-DATA-MODEL.md), and [manual acceptance](docs/SPRINT-1-MANUAL-ACCEPTANCE.md).
