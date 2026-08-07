# Employee Register

The protected Employee Register is versioned JSON persisted in browser local storage on the authorised workstation. Real records are operational input and must never be committed or deployed.

Each employee has a stable generated ID, full name, aliases and one or more effective-dated assignments. An assignment contains department, normalised grade, approved abbreviation, active state and within-band order. Creating a future assignment closes the preceding assignment at the previous month, so later promotions, moves or deactivation do not rewrite earlier interpretation.

Output ordering is deterministic:

1. Department: Drainage, Transport, Mixed, Sustainability.
2. Grade: Director, Associate Director, Associate, Principal Engineer, Senior Engineer, Engineer, Graduate Engineer / Senior Technician, Admin.
3. Configured within-band order.
4. Full name as a stable final tie-breaker.

Consultant maps to Engineer; Senior Consultant to Senior Engineer; Principal Consultant to Principal Engineer; Graduate Consultant and approved Technician equivalents map to Graduate Engineer / Senior Technician. No other equivalences are invented.

Source names resolve against full names and aliases. A missing identity blocks export and opens the create/match workflow. New employees default after existing employees in the same department/grade band. Abbreviation collisions are shown and block export. The UI supports add, edit, future assignment change, deactivate, alias management and local JSON import/export.
