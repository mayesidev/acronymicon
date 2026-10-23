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

## Vulnerability Management

[Dependency Review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review)
blocks newly introduced vulnerabilities at Low severity or above in all
dependency scopes. CI also requires registry signature verification.

Manage dependency findings in GitHub **Security → Dependabot alerts** and Grype
container findings in **Security → Code scanning**. Every container release scans
the exact AMD64 and ARM64 image digests and uploads their reports before applying
the version, minor-version, and `latest` tags. Scanner or reporting errors stop
tag publication. Automated daily checks refresh the dependency inventory and
rescan both published image architectures for newly disclosed vulnerabilities;
Renovate proposes updates.

Review findings during maintenance and before affected releases. Keep applicable
findings open until remediated. Existing findings block delivery when they
violate policy or are credibly exploitable in the shipped change, its data,
credentials, or trust boundary.

Dismiss false positives or unaffected-runtime findings in GitHub with supporting
evidence. Consequential risk acceptance requires maintainer approval and a
record of exposure, mitigation, remediation plan, and review date in GitHub.
Reassess dismissals when the image, native dependencies, or exposure changes.
Do not allowlist or dismiss findings merely to pass CI.
