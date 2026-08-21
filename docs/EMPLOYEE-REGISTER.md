# Employee Register

The protected Employee Register is a versioned record persisted in browser local storage on the authorised workstation. Real records are operational input and must never be committed or deployed.

Each employee has a stable generated ID, full name, aliases and one or more effective-dated assignments. An assignment contains department, normalised grade, approved abbreviation, active state and within-band order. Creating a future assignment closes the preceding assignment at the previous month, so later promotions, moves or deactivation do not rewrite earlier interpretation.

Output ordering is deterministic:

1. Department: Drainage, Transport, Mixed, Sustainability.
2. Grade: Director, Associate Director, Associate, Principal Engineer, Senior Engineer, Engineer, Graduate Engineer / Senior Technician, Admin.
3. Configured within-band order.
4. Full name as a stable final tie-breaker.

Consultant maps to Engineer; Senior Consultant to Senior Engineer; Principal Consultant to Principal Engineer; Graduate Consultant and approved Technician equivalents map to Graduate Engineer / Senior Technician. No other equivalences are invented.

Source names resolve against full names and aliases. A missing identity blocks export/publication and opens the create/match workflow. New employees default after existing employees in the same department/grade band. Abbreviation collisions are shown and block output. The primary UI supports add, edit, future assignment change, deactivate and alias management. Changes save automatically; no monthly import is required.

The normal workflow shows only the employee count and **Manage employee list**. Opening it reveals Edit, Deactivate and Add employee controls; advanced within-grade ordering and **Manage / replace Employee Register** backup controls remain secondary. Download a controlled backup before clearing browser/site data or moving workstation, then validate and replace from that backup once on the replacement workstation. Malformed replacement data is rejected without overwriting the current in-memory register. Refresh and browser reopening retain the register under normal browser-storage policy.

Older workbook abbreviations may be mapped to inactive/former register entries during historical review. That mapping is stored separately from the register, applies to equivalent unchanged headings, and does not reactivate the employee or make them appear in the current staff list.

Any confidential starter register remains operational input outside this repository. Do not copy it into Git, CI artifacts, Pages, screenshots or documentation.
