# Contributing

Contributions are welcome through issues and pull requests. Please keep
changes focused and explain the behavior being changed.

## Pull Requests And Releases

Open pull requests against `main`. Required checks must pass; checks outside
the change's scope may be skipped. Community pull requests require code owner
approval. The maintainer may use the pull-request-only review bypass for their
own or configured maintenance automation's PRs after reviewing the full diff
and confirming required checks pass.

Use a Conventional Commit PR title and squash merging. Examples:

```txt
fix: correct logout redirect
feat: allow users to edit definitions
refactor: reorganize runtime modules
chore(deps-runtime): update an application dependency
build(runtime): change the shipped container
```

After successful `main` CI, semantic-release publishes releases automatically:
`fix`, `perf`, `refactor`, `chore(deps-runtime)`, and `build(runtime)` trigger a
patch; `feat` triggers a minor; breaking changes trigger a major. Test, CI,
documentation, generic `chore`, unscoped `build`, and `chore(deps)` changes do
not trigger releases. Do not tag releases manually.

## Development

Use Node.js 24.x and pnpm 11.x:

```bash
pnpm install
```

Before opening a pull request, run focused checks appropriate to the change:

```bash
pnpm run lint
pnpm run typecheck
pnpm test -- <test-file>
```

Add focused coverage for changed behavior, especially authentication,
persistence, imports, and user-facing workflows. Use Playwright for browser
behavior. Let GitHub Actions run broad integration, security, build, and
platform checks; run those locally when needed to validate a change or diagnose
a failure. Browser and container tests require Docker. Available commands are
listed in [package.json](package.json).

Do not commit credentials, local database files, generated build output, or
private operational configuration. Use `.env.example` for configuration
documentation and clearly fake values for local fixtures.

Treat dictionary content as deployment data. It may appear in an authorized
response body, but do not copy it into URLs, redirects, response headers,
status text, generic errors, audit events, correlation identifiers, metric
labels, or trace attributes. Use opaque entry identifiers in navigation and
random identifiers for request correlation. Changes that touch these
boundaries should extend the automated content-boundary coverage.

Schema changes must include a Drizzle migration. Keep seed data and imported
fixtures redistributable under the project license.
