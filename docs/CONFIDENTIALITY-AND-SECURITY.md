# Confidentiality and security

Threats include accidental Git publication, source/internal data entering the public bundle, browser-memory access, malicious workbooks/ZIPs, credential exposure and misplaced trust in a static gate.

Controls include broad ignored input/output paths and Office/archive extensions; synthetic-only committed fixtures; browser-local processing; no telemetry or workbook-content logging; protected review; explicit uncoded decisions; deliberate observed-choice project-description resolution; separate project/internal workbooks; and fail-closed output when files, identities, exceptions, description decisions, collisions or reconciliation remain unresolved. Source context and decisions remain protected. The base public viewer is a constructed synthetic dataset.

Real Employee Register records live only in local browser storage and may be backed up to a controlled local file. The approved annual template and successfully opened encrypted employee publications use browser IndexedDB. Source timesheets and generated outputs remain in memory until download. Clearing browser/site storage removes workstation data; moving workstation requires controlled backup restoration or reopening the encrypted publication. The internal output is visibly confidential and contains a source-row audit trace; it must be stored only in an approved local operational location.

The interim Employee Viewer package contains non-sensitive format/month metadata, PBKDF2 parameters, random salt, random AES-GCM IV and ciphertext. Its plaintext is limited to approved project numbers/names, employee display names, employee project hours and project totals. Internal categories, exceptions, register administration, source filenames/rows and audit traces are excluded. The URL fragment is not sent in an HTTP request to GitHub Pages, but browser extensions, screenshots, copied links and endpoint compromise remain risks.

The pilot uses a separate shared bearer-style Employee Viewer token. It has no individual identity, per-person revocation, central session or access audit. Employees can share the token; possession of both token and encrypted link/file grants access. Remembered tokens and encrypted libraries rely on browser and workstation security. This mechanism is permitted only until approved company authentication, hosting, authorisation and key management replace it.

The shared Office Manager/Director gate is workstation convenience. Its SHA-256 digest is compiled into static JavaScript and is not a confidentiality boundary. Local storage and client JavaScript can be modified. The Admin token must never be reused as the Employee Viewer token.

Prohibited in Git, CI artifacts, screenshots, logs or Pages: real employee records, leave/sickness details, internal hours, plaintext employee/project-hour datasets, client/project data, source filenames, plaintext tokens, Office source files, generated real outputs, private QA locations and network-drive paths.
