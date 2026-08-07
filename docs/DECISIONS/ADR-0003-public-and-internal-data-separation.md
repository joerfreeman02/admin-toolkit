# ADR-0003: Public and internal data separation

Status: accepted. Source entries, protected internal/exception data, and published project data are different models and flows. The public dataset is created only by an explicit tested, fail-closed transformation: only `project` classifications are eligible, while `internal` and unresolved `exception` records remain protected. It cannot contain source lineage. CSS hiding and sensitive-word deny-lists are not confidentiality controls. Explicit Office Manager approval for a genuine uncoded exception is deferred to Sprint 1.
