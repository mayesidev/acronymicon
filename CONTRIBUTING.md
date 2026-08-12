# Contributing

Contributions are welcome through issues and pull requests. Please keep
changes focused and explain the behavior being changed.

## Pull Requests And Releases

Open pull requests against `main`. The repository requires change-scope,
quality and build, browser integration, ARM64 container, commit metadata, and
CodeQL checks to complete successfully before merging. Checks that do not
apply to a change may complete with GitHub's successful skipped-job result.
There is no required reviewer approval because this project currently has a
single maintainer.

Use a Conventional Commit title for every pull request. Examples:

```txt
fix: correct logout redirect
feat: allow users to edit definitions
refactor: reorganize runtime modules
chore(deps-runtime): update an application dependency
build(runtime): change the shipped container
```

CI validates the pull request title with commitlint. Use squash merging so
that the validated title becomes the commit analyzed by semantic-release.
After a successful `main` build, semantic-release determines the next
version and creates the GitHub release and tag. `fix`, `perf`, `refactor`,
`chore(deps-runtime)`, and `build(runtime)` changes produce patch releases;
`feat` changes produce minor releases; and a `BREAKING CHANGE` produces a
major release. Test-only, CI-only, documentation-only, generic `chore`,
unscoped `build`, and `chore(deps)` development-tooling changes do not create
a release. Generated notes include each change that caused the version bump;
maintenance categories that do not trigger a release are omitted. Normal
changes should not be tagged manually.

## Development

Use Node.js 24.x and pnpm 11.x:

```bash
pnpm install
```

Before opening a pull request, run the smallest checks that establish the
changed behavior. Typical focused checks include:

```bash
pnpm run lint
pnpm run typecheck
pnpm test -- <test-file>
```

Choose checks according to the files and behavior being changed rather than
running every suite by default. Add focused automated coverage when the
relevant behavior does not already have it. Use `pnpm test:e2e`,
`pnpm run security:check`, or `pnpm run test:container` locally when that suite
is the simplest way to validate the change or when diagnosing a CI failure.
`pnpm run verify` is available as an optional complete local quality preflight.

GitHub Actions is the authoritative pull-request validation environment. It
runs the most complete applicable quality, browser, security, build, and
container checks for application changes, and its required checks have the
final say on whether a pull request is acceptable to merge. Local results do
not override a pending or failing required check. Documentation-only pull
requests still run the scope and commit metadata checks, but skip application
quality, browser, and container checks. The end-to-end suite requires Docker
and a local Keycloak container when it is run locally.

Changes to authentication, persistence, imports, or user-facing workflows
should include focused tests. Changes to the browser workflow should include
or update Playwright coverage where appropriate.

Do not commit credentials, local database files, generated build output, or
private operational configuration. Use `.env.example` for configuration
documentation and clearly fake values for local fixtures.

Schema changes must include a Drizzle migration. Keep seed data and imported
fixtures redistributable under the project license.
