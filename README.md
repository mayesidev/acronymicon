# Acronymicon

Acronymicon is a self-hosted acronym dictionary web app for searching,
browsing, and submitting acronym definitions. It is designed for deployment
on a protected network, while the source is available for reuse and forking.

Use GitHub Issues for public bug reports and feature requests. Internal
planning and prioritization are maintained in Linear; implementation history
is preserved in git and published releases.

The app supports anonymous browsing, live search across acronyms and
definitions, fuzzy matches for minor typos, readable definition links,
optional definition range marking, light and dark themes, authenticated OIDC
submissions, duplicate detection, JSON import, and persistent SQLite storage.

## Development

Install dependencies:

```bash
pnpm install
```

The supported local toolchain is Node.js 24.x and pnpm 11.x. Docker is also
required for the Keycloak-backed end-to-end suite.

Run the development server:

```bash
pnpm run dev --host 0.0.0.0
```

The app runs at:

```txt
http://localhost:5173
```

## Architecture

The target source layout and allowed dependency direction are documented in
[the application module boundaries](docs/architecture/modules.md). Keep tests
beside their owning modules and preserve these boundaries when adding or moving
application code.

## Database

The MVP uses app-owned SQLite through Drizzle.

Default local database path:

```txt
./data/acronymicon.sqlite
```

Override it with:

```bash
DATABASE_PATH=/path/to/acronymicon.sqlite
```

Generate migrations after schema changes:

```bash
pnpm run db:generate
```

Apply migrations:

```bash
pnpm run db:migrate
```

Local database files under `data/` are ignored by git.

## Seed And Import

Load the demo seed data:

```bash
pnpm run db:seed
```

Import another JSON file:

```bash
pnpm run import:acronyms -- path/to/acronyms.json
```

The import command accepts either an array of entries or an object with an `entries` array. Exact duplicates are skipped using normalized `acronym + definition`.

## Authentication

Browsing does not require login. Submitting acronyms requires a signed-in user.

OIDC configuration is provider-neutral. Keycloak can be used for local
development, but production can use any compatible provider. `SESSION_SECRET`
is required in production.

To enable OIDC, configure all three provider credentials:

```txt
OIDC_ISSUER_URL
OIDC_CLIENT_ID
OIDC_CLIENT_SECRET
```

If any OIDC setting is present without those credentials, startup fails with a
configuration error. `OIDC_REDIRECT_URI` defaults to `/auth/callback` on the
request origin. For provider logout, set `OIDC_POST_LOGOUT_REDIRECT_URI` to a
URI registered with the OIDC provider. Boolean settings accept only `true` or
`false`; optional claim mapping variables are documented in `.env.example`.

## Verification

Run the automated checks relevant to a change:

```bash
pnpm run verify
pnpm run security:check
pnpm test:e2e
pnpm run test:container
```

Pull requests use Conventional Commit titles, such as `fix: correct logout
redirect` or `feat: allow editing definitions`. CI validates the title, and
semantic-release creates releases automatically after successful builds on
`main`. Use squash merging so the validated pull request title is retained
for release analysis.

`pnpm run verify` runs type generation and typechecking, linting, unit and
server tests with enforced coverage thresholds, and a production build.

## Docker

Build and run the app with local Keycloak:

```bash
docker compose up --build
```

Run a published container release with local Keycloak:

```bash
export ACRONYMICON_IMAGE=ghcr.io/mayesidev/acronymicon:latest
docker compose pull app
docker compose up -d
```

The published image is available for both `linux/amd64` and `linux/arm64`. Its
runtime is a minimal distroless image that runs as non-root UID/GID `65532` and
does not include a shell or package manager.

The published image applies bundled database migrations on startup. Open the
app at `http://localhost:3000`. Remove the `ACRONYMICON_IMAGE` variable and
run `docker compose up --build` to return to the local source build.

App:

```txt
http://localhost:3000
```

Keycloak:

```txt
http://keycloak.localtest.me:8080
```

Local Keycloak admin:

```txt
admin / admin
```

Seeded local users:

```txt
user / password
admin-user / password
```

These credentials are local development fixtures only. Do not reuse them or
the example client/session secrets outside local development.

The app container stores SQLite data in the `acronymicon-data` Docker volume at `/data/acronymicon.sqlite`.

Keep this volume when updating the app image. For a simple backup, stop the
app, copy the database from the stopped service container, and start the app
again:

```bash
docker compose stop app
mkdir -p backups
docker compose cp app:/data/acronymicon.sqlite ./backups/
docker compose start app
```

Seed the running container explicitly when needed:

```bash
docker compose exec app /nodejs/bin/node build/scripts/import-acronyms.mjs seeds/acronyms.seed.json
```

Import another JSON file into the running container by copying it into the
container first, then running the container importer:

```bash
docker cp path/to/acronyms.json $(docker compose ps -q app):/tmp/acronyms.json
docker compose exec app /nodejs/bin/node build/scripts/import-acronyms.mjs /tmp/acronyms.json
```
