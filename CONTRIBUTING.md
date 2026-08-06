# Contributing

Contributions are welcome through issues and pull requests. Please keep
changes focused and explain the behavior being changed.

## Pull Requests And Releases

Open pull requests against `main`. The repository requires the quality,
browser integration, and commit metadata checks to pass before merging.
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
a release. Normal changes should not be tagged manually.

## Development

Use Node.js 24.x and pnpm 11.x:

```bash
pnpm install
```

Before opening a pull request, run the checks that apply to the change:

```bash
pnpm run verify
pnpm run security:check
pnpm test:e2e
pnpm run test:container
```

`pnpm run verify` is the canonical local and CI quality check. It runs
typechecking, linting, tests with coverage thresholds, and the production
build so that local and CI validation do not drift apart.

The end-to-end suite requires Docker and a local Keycloak container. GitHub
Actions runs the complete quality, browser, security, build, and container
checks for application changes. Documentation-only pull requests still run
the scope and commit metadata checks, but skip application quality, browser,
and container checks.

Changes to authentication, persistence, imports, or user-facing workflows
should include focused tests. Changes to the browser workflow should include
or update Playwright coverage where appropriate.

Do not commit credentials, local database files, generated build output, or
private operational configuration. Use `.env.example` for configuration
documentation and clearly fake values for local fixtures.

Schema changes must include a Drizzle migration. Keep seed data and imported
fixtures redistributable under the project license.
