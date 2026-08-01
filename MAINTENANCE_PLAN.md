# MVP Maintenance Plan

## Status

Proposed maintenance release. Do not begin Version 2 feature work until the
acceptance gates in this plan pass.

The purpose of this release is to make the MVP trustworthy to change. It will
fix the known authentication defect, establish automated behavior coverage,
modernize the development toolchain, and add repeatable CI checks.

## Current Baseline

- The application has no unit-test framework, end-to-end test suite, or CI workflow.
- TypeScript is pinned at `5.9.3`.
- The current runtime dependency audit reports no known vulnerabilities.
- The full dependency audit reports four moderate development-only findings through the `drizzle-kit` and `esbuild` dependency chain.
- `package-lock.json` is committed, but dependency installation and lifecycle-script policy are not explicitly documented or enforced.
- `package-lock.json` is currently listed in `.gitignore`, which should be corrected while npm remains the package manager.
- The logout link performs a `GET` while the logout route only destroys the local session in its `POST` action.

## Phase 1: Correctness Fixes

### Logout and Account Switching

Implement and verify a complete sign-out flow:

- Use a `POST` form for the sign-out command.
- Destroy the local Acronymicon session cookie.
- Use the OIDC provider's advertised logout endpoint when available.
- Return to Acronymicon after provider logout.
- Fall back to local logout when the provider has no logout endpoint.
- Preserve the ability to select a different Keycloak user during development.

Acceptance criteria:

- A signed-in user can sign out from the app.
- The home page no longer shows the signed-in user.
- Visiting submission redirects to login.
- Logging in as `user` and then `admin-user` produces the correct identity in each session.
- The flow works when the provider has an SSO session and when it does not.

## Phase 2: Automated Behavior Coverage

Keep the initial test surface focused on behavior already promised by the MVP.

### Unit and Server Tests

Prefer Node's built-in test runner for pure logic and server-side tests to keep
the development dependency footprint small.

Cover:

- Acronym and definition normalization.
- Exact duplicate matching.
- New-entry construction and default status.
- OIDC claim mapping, including configured claim names and missing optional claims.
- Import validation, insertion, and idempotent duplicate handling.
- Session and logout behavior where it can be tested without a browser.

### End-to-End Tests

Use a real browser test runner for the workflows that depend on cookies,
redirects, forms, and Keycloak. The test environment must use an isolated
database volume and must not modify the developer's persistent volume.

Cover:

- Anonymous browse and search.
- Anonymous submission redirect to login.
- Keycloak login and authenticated submission.
- Submitter identity displayed after login.
- Exact duplicate rejection.
- Same-acronym warning and confirmed distinct submission.
- Logout and login as a different user.

## Phase 3: Toolchain and Dependency Maintenance

### TypeScript Upgrade

Upgrade in stages and verify the application after each stage:

1. Move from TypeScript 5.9 to the current TypeScript 6 release line.
2. Run typecheck, unit tests, build, container build, and end-to-end tests.
3. Evaluate TypeScript 7 separately after the React Router, Vite, and test tooling ecosystem is ready for its new compiler API model.

Do not use a blind major-version upgrade or force an audit fix that downgrades
unrelated packages.

### Dependency Review

- Classify dependencies as runtime, build-time, test-time, or unnecessary.
- Update compatible patch and minor releases as a controlled lockfile change.
- Investigate the `drizzle-kit` development audit finding and document the chosen remediation or accepted residual risk.
- Keep runtime audit results at zero known high or critical vulnerabilities.
- Remove extraneous local installation artifacts and verify with a clean `npm ci`.
- Re-run typecheck, tests, build, and Docker verification after dependency changes.

### npm Installation Hardening

- Use `npm ci` in CI and container builds; do not use an unconstrained `npm install` there.
- Keep `package-lock.json` required and review lockfile changes.
- Add `npm audit signatures` to the dependency verification checks.
- Evaluate an `ignore-scripts` or explicit `allowScripts` policy, with an explicit exception only where native `better-sqlite3` builds require it.
- Use project-local binaries and avoid network-executed package commands in CI.
- Do not switch package managers solely on the assumption that npm is insecure; lockfile integrity, script control, auditing, and review provide the meaningful controls.

### Package Manager Decision

Keep npm for this maintenance release. The project already has a working
`package-lock.json`, Docker uses `npm ci`, and npm provides the required frozen
install, audit, signature, and lifecycle-script controls. Correct the
`.gitignore` entry and add an explicit `packageManager` version once the npm
version for CI is selected.

Evaluate pnpm separately after the maintenance gate, or sooner only if the
team has a standard pnpm policy or needs its workspace and script controls.
A pnpm migration would be a deliberate lockfile and Docker change, followed
by clean-install, native-module, build, and end-to-end comparisons. It should
not be bundled with the TypeScript or test migration by accident.

## Phase 4: CI Pipeline

Add a pull-request and main-branch workflow that runs:

1. Clean dependency installation.
2. Dependency signature verification and audit.
3. Typecheck.
4. Unit/server tests.
5. Production build.
6. Docker image build.
7. End-to-end tests against isolated Keycloak and SQLite services.

Security controls:

- Pin third-party CI actions to reviewed immutable commit SHAs if using GitHub Actions.
- Give jobs the minimum permissions they need.
- Treat high and critical runtime vulnerabilities as failures.
- Track development-only moderate findings explicitly until they are remediated or accepted.

Initial delivery should be CI only. Publishing or deploying images is a
separate decision because no upstream repository, registry, or deployment
environment has been selected yet.

## Execution and Distribution Planning

Use separate systems for separate kinds of information:

- Repository documents hold product requirements, architecture decisions, and release gates.
- A Linear project or equivalent issue board holds prioritized work, ownership, status, dependencies, and acceptance links.
- Git holds implementation history.
- CI holds repeatable verification results.
- Release notes record what was promoted and how to roll it back.

Create one maintenance project with work grouped under correctness, testing,
toolchain, supply chain, CI, and release. Do not create Version 2
implementation issues until the maintenance release is complete; discovery
questions can remain as a separate backlog.

Before CI can become a shared check, decide:

- Where the private upstream repository will live.
- Whether cloud CI may access the source and public package registry, or whether a self-hosted runner is required.
- Where versioned OCI images will be stored.
- Whether deployment remains manual Compose promotion or becomes an automated protected-environment deployment.
- How release secrets, image tags, database backups, and rollback approvals will be handled.

The minimum useful first pathway is private source control plus CI that builds
and tests the application and container. Image publishing and deployment can
follow once the registry and target environment are chosen.

## Release Gate

The maintenance release is complete when:

- The logout/account-switching acceptance criteria pass.
- Unit/server and end-to-end suites pass from a clean checkout.
- TypeScript has been upgraded to the selected supported line.
- `npm ci` succeeds reproducibly.
- Signature verification and dependency audit checks are documented and automated.
- Typecheck, build, Docker build, and runtime smoke checks pass.
- The known audit findings have an explicit remediation or risk-acceptance record.
- The worktree is clean and all changes are committed.

## Deferred Until After Maintenance

- Category and tag semantics.
- Source-field presentation and policy.
- Submitter editing.
- Moderator and admin workflows.
- OIDC role mapping and authorization rules.
- Voting, ranking, and bulk-import UI.
- Production image publishing and automatic deployment.

These are Version 2 requirements discussions, not maintenance tasks.

## Decisions Needed Before Implementation

- Which CI provider should be the first target if the repository remains without an upstream?
- Should execution tracking live in Linear, another issue system, or only in the repository until an upstream exists?
- Which private source host, CI runner model, and OCI registry are acceptable for this internal project?
- Is cloud CI permitted, or must source and build traffic remain inside the protected network?
- Should npm remain the package manager for the first maintenance release, with pnpm evaluated afterward?
- Is adding a browser test dependency such as Playwright acceptable, or is there an existing organizational runner to use?
- Should development-only moderate audit findings block CI, warn, or be allowed only with an explicit record?
- Should the first TypeScript target be TypeScript 6, with TypeScript 7 deferred until ecosystem compatibility is confirmed?
