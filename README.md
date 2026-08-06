# EAS Admin Toolkit

Sprint 0 foundation for the **Timesheet and Invoicing Hours** module. This static React/TypeScript application processes `.xlsx` and ZIP uploads locally in the browser, classifies every source hour once, and creates a separate sanitised public-view model.

> Never commit or publish real timesheets, generated outputs, internal hours, credentials, or staff data.

## Status and versions

- Product `ADMIN-0.1.0`; module `TIME-0.1.0`; Sprint 0.
- Build identity is injected from `GITHUB_SHA` (or `local-dev`).
- Prototype only: supplied reference workbook structures were inspected read-only and the staff layout is supported; business interpretation and exact output replication still require guided acceptance.
- Intended public URL: `https://joerfreeman02.github.io/admin-toolkit/` (not live or verified until publishing completes).

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

Set `VITE_ADMIN_TOKEN_SHA256` to a SHA-256 hex digest in a local `.env`; never store the token itself. The static workstation gate is a convenience boundary, not production authentication.

GitHub Actions builds `main` and publishes `dist/` through GitHub Pages. See [architecture](docs/ARCHITECTURE.md), [testing](docs/TESTING.md), and [security](docs/CONFIDENTIALITY-AND-SECURITY.md).

## Major dependencies

React/Vite provide a small static browser application; SheetJS Community Edition 0.20.3 parses workbooks locally (Apache-2.0, installed from the project's authoritative CDN because the npm registry copy is stale); JSZip expands local ZIPs (MIT); Zod validates boundary models (MIT). The lockfile pins the resolved graph. Browser support follows current Chromium, Firefox and WebKit capabilities, including Web Crypto. SheetJS is the principal bundle-size consideration and should be reviewed before production acceptance.
