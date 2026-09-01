# ADR-0006: Interim encrypted Employee Viewer publication

Status: accepted for the unaccepted Sprint 1 pilot candidate.

## Context

Employees need a project-hours viewer before approved company authentication and server storage are available. Publishing plaintext operational data in a static bundle or placing repository credentials in a browser would be unacceptable.

## Decision

The protected Admin UI creates a minimal approved project-only dataset and encrypts it locally using a separate randomly generated Employee Viewer token. PBKDF2-HMAC-SHA-256 uses a random 128-bit salt and 310,000 iterations to derive an AES-256-GCM key; encryption uses a random 96-bit IV. The versioned package contains month/algorithm metadata and ciphertext only.

The encrypted package is stored in Workers KV under a random month-prefixed ID. The normal viewer URL fragment contains only that ID. The Admin UI obtains a five-minute publishing session from the Worker using the runtime Office Manager code over HTTPS, uploads only encrypted JSON, and re-fetches it before enabling the link. Successful clients may retain only the encrypted package in IndexedDB. Employee access codes are held in a local remembered keyring at the employee's choice. No PAT, GitHub write credential or permanent Worker write secret participates. Legacy embedded-package links remain readable for compatibility.

## Consequences

The deployed base bundle remains synthetic and GitHub Pages does not receive the URL fragment in the HTTP request. The Worker exposes only public read-by-ID, authenticated write/delete and no listing endpoint. Wrong tokens and changed ciphertext fail authenticated decryption. A malformed link, unavailable publication or invalid publication never falls back to fictional data. Internal hours, audit/source data, exceptions and register administration are absent from plaintext publication data.

This is not individual authentication. The shared bearer secret can be forwarded; there is no individual revocation, access audit, server session or central synchronisation. A leaked token plus package grants access, and local persistence relies on endpoint/browser security. Approved company identity, authorisation, hosting, audit and key management must replace this pilot.
