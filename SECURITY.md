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

## Dependency Vulnerability Policy

GitHub Dependency Review checks pull requests for newly introduced vulnerable
versions at Low severity or above, including runtime, development, and unknown
scopes. This required check permits remediation and unrelated changes while
existing findings are managed in **Security → Dependabot alerts**. Do not add
advisory allowlists merely to pass a check.

The Dependency security workflow submits the resolved default-branch dependency
inventory to GitHub after main updates and daily at 08:43 UTC. Submission errors
or an unexpectedly empty inventory fail that workflow. Dependabot evaluates
that inventory against GitHub advisories; Renovate remains the update agent.
Review applicable existing findings during maintenance and before releasing
affected changes, with maintainer-approved risk decisions recorded in GitHub.

CI retains registry signature verification and pnpm's installation protections.
`pnpm run security:audit` remains available for a full-inventory registry audit;
`pnpm run security:check` runs both the audit and signature checks locally.
These full-inventory audit results are not the pull-request merge gate.

## Container Vulnerability Policy

CI scans the final loaded runtime image with SHA-pinned Anchore Scan Action
code and an explicitly versioned Grype scanner. AMD64 is scanned whenever CI
builds the container; ARM64 is also scanned when native ARM64 validation runs.
SARIF reports are uploaded to GitHub **Security → Code scanning** and retained
as workflow artifacts for 14 days. Separate analysis categories identify each
architecture and distinguish CI builds from published images.

The Container security workflow scans both architectures of the published
`latest` image daily at 08:17 UTC and can be run manually. It resolves the
registry tag to a digest before scanning and records that identity with the
report, so new vulnerability disclosures are detected without a source change.

Grype findings are managed in GitHub, rather than an in-repository exception
file. Scanner, database, missing-report, and upload errors fail the workflow;
a vulnerability's severity alone does not fail the build. Container findings
refer to image filesystem paths, so SARIF upload is not a guarantee that GitHub
will annotate or block a pull request's source diff.

Review new findings during maintenance and before releasing affected changes.
An applicable finding remains open until remediation, usually through a
Renovate dependency or base-image update. A subsequent successful scan provides
evidence that the finding has been fixed. Findings block delivery when they
violate security policy or are credibly exploitable in the shipped change,
its data, credentials, or trust boundary.

For a false positive or an unaffected runtime, dismiss the alert in GitHub with
an explanation and supporting evidence. Consequential risk acceptance requires
maintainer approval and must record the exposure, mitigation, remediation plan,
and review date in GitHub. Dismissals persist without automatic expiry; review
them when the image, native dependencies, or exposure changes. Do not dismiss a
finding merely to make a check green. GitHub is the record of findings and their
disposition; notification delivery depends on each maintainer's GitHub settings.
