# Confidentiality and security

Threats include accidental Git publication, source/internal data entering the public bundle, browser-memory access, malicious workbooks/ZIPs, formula ambiguity, credential exposure and misleading trust in a static gate.

Controls: broad ignored input/output locations and spreadsheet/archive extensions; synthetic-only committed fixtures; local processing; no telemetry or console content logging; fail-closed public sanitisation that admits only `project` classifications; protected unresolved exceptions; separate public/admin models; minimal error messages; hash-only gate configuration; and logout/reset of remembered state. Build output contains only bundled synthetic publication data.

The gate supports one shared Office Manager/Director administrative role and workstation convenience. Its SHA-256 digest is compiled into the static JavaScript build and is therefore not a deploy-time secret or confidentiality boundary. Local storage and client JavaScript can be modified, so the gate does not protect data already present in a deployment. Never place source timesheets or internal outputs in public assets, HTML, hidden sheets or JavaScript. Future production options require an approved identity provider, server authorization, audit policy, encryption/key management and data-protection review.

Prohibited: real names, leave/sickness details, internal hours, client/project data, source filenames, tokens, or generated real outputs in Git, CI artifacts, screenshots, logs or Pages.
