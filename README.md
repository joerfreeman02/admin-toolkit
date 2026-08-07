# EAS Admin Toolkit

Sprint 0 foundation for the **Timesheet and Invoicing Hours** module. This static React/TypeScript application processes `.xlsx` and ZIP uploads locally in the browser, classifies every source hour once, and creates a separate sanitised public-view model.

> Never commit or publish real timesheets, generated outputs, internal hours, credentials, or staff data.

## Status and versions

- Product `ADMIN-0.1.1`; module `TIME-0.1.1`; Sprint 0 accepted and frozen baseline.
- Accepted candidate `28af89cf60e8317e1465178a6f47a0cf65c8a191`, merged through PR #1 as `895984dd605774944aa5917ae115675b4cb0b66e`; release marker `sprint-0-admin-0.1.1-time-0.1.1`.
- Build identity is injected from `GITHUB_SHA` (or `local-dev`).
- Product Owner manual acceptance passed for the Sprint 0 scope. Supplied reference workbook structures and the Office Manager walkthrough were reviewed read-only; no confidential source files or generated internal outputs form part of this baseline.
- Live Sprint 0 acceptance URL: `https://joerfreeman02.github.io/admin-toolkit/`, deployed manually from the controlled Sprint branch with synthetic demonstration data only. Verify the footer build identity and GitHub Actions deployment SHA before each acceptance session.

## Local development

Requires Node 22 and pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm audit --prod
```

Set `VITE_ADMIN_TOKEN_SHA256` to a SHA-256 hex digest in a local `.env`; never store the token itself. Vite compiles the digest into the static browser build, so the digest is not secret after deployment. The workstation gate is a convenience boundary, not production authentication.

Processed public data fails closed: only entries classified as `project` enter the derived public dataset. Internal and unresolved exception records remain protected. Sprint 1 will require explicit Office Manager review/approval before a genuine uncoded exception can be published; the public viewer's uncoded example is fictional static demonstration data.

GitHub Actions validates the Sprint branch. A separately registered, manual-only workflow publishes the selected Sprint SHA through GitHub Pages for acceptance. See [architecture](docs/ARCHITECTURE.md), [testing](docs/TESTING.md), [security](docs/CONFIDENTIALITY-AND-SECURITY.md), and [TIME-DATA-001](docs/TIME-DATA-001.md).

## Major dependencies

React/Vite provide a small static browser application; SheetJS Community Edition 0.20.3 parses workbooks locally (Apache-2.0, installed from the project's authoritative CDN because the npm registry copy is stale); JSZip expands local ZIPs (MIT); Zod validates boundary models (MIT). The lockfile pins the resolved graph. Browser support follows current Chromium, Firefox and WebKit capabilities, including Web Crypto. SheetJS is the principal bundle-size consideration and should be reviewed before production acceptance.
