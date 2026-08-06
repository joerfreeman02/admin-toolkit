# Testing

Vitest creates synthetic workbooks in memory and covers code/employee/month extraction, three-way classification, lineage, repeated rows, employee/project totals, reconciliation, blank/missing inputs, malformed worksheets/totals, wrong month, mixed files, ZIP filtering, duplicate filenames, decimal/zero values, carryover validation and public sanitisation. React tests cover public exclusion and workstation persistence/reset. Playwright covers desktop Chromium and a mobile Chromium profile for landing, public contributor view, admin redirect, persisted browser state, reload, logout, build information and keyboard navigation.

Commands: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, `pnpm exec playwright install chromium`, `pnpm test:e2e`, `pnpm build`, and `pnpm audit --prod`.

Real workbook shape, cached formulas, Excel-specific rendering, Safari/Firefox, live Pages and positive token comparison remain unavailable until source/reference material, browser binaries and publishing credentials/configuration are available.
