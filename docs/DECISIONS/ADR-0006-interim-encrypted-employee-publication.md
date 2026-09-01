# ADR-0006: Interim encrypted Employee Viewer publication

Status: accepted for the unaccepted Sprint 1 pilot candidate.

## Context

Employees need a project-hours viewer before approved company authentication and server storage are available. Publishing plaintext operational data in a static bundle or placing repository credentials in a browser would be unacceptable.

## Decision

The protected Admin UI creates a minimal approved project-only dataset and encrypts it locally using a separate randomly generated Employee Viewer token. PBKDF2-HMAC-SHA-256 uses a random 128-bit salt and 310,000 iterations to derive an AES-256-GCM key; encryption uses a random 96-bit IV. The versioned package contains month/algorithm metadata and ciphertext only.

The encrypted package is stored as a separately deployed static `publications/<month-random-id>.easpub` asset. The normal viewer URL fragment contains only the month-prefixed random ID. The Admin UI downloads the deployment-ready asset and explicitly requires it to be deployed through the repository's ordinary GitHub Pages release workflow before the link is sent. Successful clients may retain only the encrypted package in IndexedDB. The token may be remembered separately in browser local storage at the employee's choice. No Admin token, PAT or GitHub write credential participates. Legacy embedded-package links remain readable for compatibility.

## Consequences

The deployed base bundle remains synthetic and GitHub Pages does not receive the URL fragment in the HTTP request. Wrong tokens and changed ciphertext fail authenticated decryption. A malformed link, unavailable asset or invalid asset never falls back to fictional data. Internal hours, audit/source data, exceptions and register administration are absent from plaintext publication data.

This is not individual authentication. The shared bearer secret can be forwarded; there is no individual revocation, access audit, server session or central synchronisation. A leaked token plus package grants access, and local persistence relies on endpoint/browser security. Approved company identity, authorisation, hosting, audit and key management must replace this pilot.
