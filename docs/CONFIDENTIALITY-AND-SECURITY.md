# Confidentiality and security

Threats include accidental Git publication, source/internal data entering the public bundle, browser-memory access, malicious workbooks/ZIPs, credential exposure and misplaced trust in a static gate.

Controls include broad ignored input/output paths and Office/archive extensions; synthetic-only committed fixtures; browser-local processing; no telemetry or workbook-content logging; protected review; explicit uncoded approval; deliberate observed-choice project-description resolution; separate project/internal workbooks; and fail-closed export when identities, exceptions, description decisions, collisions or reconciliation remain unresolved. Conflict source context and decisions remain protected. The public viewer is a constructed synthetic dataset and has no path from operational processing.

Real Employee Register records live only in local browser storage and may be backed up to a controlled local JSON file. Source workbook bytes and generated outputs remain in memory until the user downloads them. Neither is persisted by the application. The internal output is visibly confidential and contains a source-row audit trace; it must be stored only in an approved EAS location.

The shared Office Manager/Director gate is workstation convenience. Its SHA-256 digest is compiled into static JavaScript and is not a confidentiality boundary. Local storage and client JavaScript can be modified. Future production options require an approved identity provider, server authorisation, audit policy, encryption/key management and data-protection review.

Prohibited in Git, CI artifacts, screenshots, logs or Pages: real employee records, leave/sickness details, internal hours, client/project data, source filenames, plaintext tokens, Office source files and generated real outputs.
