# Contributing

Contributions are welcome through issues and pull requests. Please keep
changes focused and explain the behavior being changed.

## Development

Use Node.js 24.x and pnpm 11.x:

```bash
pnpm install
```

Before opening a pull request, run the checks that apply to the change:

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
pnpm run security:check
```

Changes to authentication, persistence, imports, or user-facing workflows
should include focused tests. Changes to the browser workflow should include
or update Playwright coverage where appropriate. The end-to-end suite requires
Docker and a local Keycloak container.

Do not commit credentials, local database files, generated build output, or
private operational configuration. Use `.env.example` for configuration
documentation and clearly fake values for local fixtures.

Schema changes must include a Drizzle migration. Keep seed data and imported
fixtures redistributable under the project license.
