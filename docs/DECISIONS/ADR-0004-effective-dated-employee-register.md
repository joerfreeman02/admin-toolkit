# ADR-0004: Effective-dated local Employee Register

Status: accepted for Sprint 1 candidate.

## Decision

Store a versioned Employee Register in browser local storage, with stable employee IDs and non-overlapping effective-dated assignments. Resolve uploads by full name/alias and derive each output's ordered employee snapshot for the selected reporting month.

## Rationale

The workforce must change without a software release, while promotions, moves and deactivation must affect future outputs without silently reinterpreting past months. A local register maintains the confidentiality boundary and is sufficient for the authorised single-workstation workflow.

## Consequences

Register backup/restore is an Office Manager responsibility. Browser storage is not a shared database. Collisions, unknown identities and invalid records fail closed. A future multi-user service would require a separate migration and authentication decision.
