# Security Policy

Please do not report security vulnerabilities through public issues or pull
requests.

Use GitHub's private vulnerability reporting to provide details. Include the
affected version or commit, reproduction steps, impact, and any suggested
mitigation. Do not include sensitive details in a public issue.

The supported security baseline is the latest version on the default branch
and the latest published container release. This project is self-hosted, so
operators are responsible for supplying production OIDC credentials, session
secrets, network controls, backups, and timely updates.

## Container Vulnerability Policy

CI scans the final loaded runtime image with SHA-pinned Anchore Scan Action
code and an explicitly versioned Grype scanner. The JSON report is retained as
a workflow artifact for 14 days. Release verification calls the same CI
workflow before an image can be published.

New high or critical findings fail the build. A temporary exception must match
the exact vulnerability, package, and installed version in
`security/container-scan-exceptions.json`. Every exception requires a reason,
a tracking issue, and an ISO expiration date. Expired exceptions fail closed;
exceptions that no longer match are reported so they can be removed.

Use the shortest practical exception period. Do not add an exception merely
to make CI pass: confirm the finding, document why immediate remediation is not
available, and create a focused follow-up issue first.
