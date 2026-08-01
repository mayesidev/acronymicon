# MVP Maintenance Release Contract

## Status

The actionable maintenance backlog is tracked in the repository issue tracker.

This repository document defines the release boundary and acceptance contract.
The issue tracker owns status, sequencing, ownership, and implementation
details.

## Scope

The maintenance release must make the MVP trustworthy to change before Version
2 feature work begins.

- Fix logout and OIDC account switching, including the local-session and provider-SSO cases.
- Decide whether to retain npm or migrate to pnpm before adding test tooling.
- Establish unit/server and browser end-to-end coverage for existing MVP behavior.
- Modernize the TypeScript and dependency baseline safely.
- Harden dependency installation, lifecycle scripts, lockfile handling, and audit verification.
- Add repeatable CI checks for install, security, tests, build, Docker, and E2E behavior.
- Define the source-control, runner, OCI registry, and release-promotion path.

## Release Gate

The maintenance release is complete when:

- A user can sign out and then authenticate as a different Keycloak user.
- Unit/server and end-to-end suites pass from a clean checkout.
- The selected package manager and lockfile install reproducibly in local and Docker environments.
- The selected TypeScript line passes typecheck, tests, build, and Docker verification.
- Runtime dependencies have no unresolved high or critical audit findings.
- Development-only audit findings have a documented remediation or risk decision.
- CI runs the required checks with restricted permissions and reviewed action references.
- A versioned container can be built, identified by commit SHA, and manually promoted or rolled back.
- All implementation changes are committed and the worktree is clean.

## Deferred Until After Maintenance

- Category and tag semantics.
- Source-field presentation and policy.
- Submitter editing.
- Moderator and admin workflows.
- OIDC role mapping and authorization rules.
- Voting, ranking, and bulk-import UI.
- Automatic production deployment.

These are Version 2 requirements discussions, not maintenance work items.
