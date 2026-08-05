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
pnpm run dev -- --host 0.0.0.0
```

The app runs at:

```txt
http://localhost:5173
```

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

OIDC configuration is provider-neutral. Keycloak can be used for local development, but production can use any compatible provider.

Required OIDC environment variables:

```txt
SESSION_SECRET
OIDC_ISSUER_URL
OIDC_CLIENT_ID
OIDC_CLIENT_SECRET
OIDC_REDIRECT_URI
```

For provider logout, set `OIDC_POST_LOGOUT_REDIRECT_URI` to a URI registered
with the OIDC provider. Optional claim mapping variables are documented in
`.env.example`.

## Verification

Run the automated checks relevant to a change:

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
pnpm run security:check
pnpm test:e2e
```

Pull requests use Conventional Commit titles, such as `fix: correct logout
redirect` or `feat: allow editing definitions`. CI validates the title, and
semantic-release creates releases automatically after successful builds on
`main`. Use squash merging so the validated pull request title is retained
for release analysis.

Run typecheck:

```bash
pnpm run typecheck
```

Build for production:

```bash
pnpm run build
```

## Docker

Build and run the app with local Keycloak:

```bash
docker compose up --build
```

Run a published container release with local Keycloak:

```bash
export ACRONYMICON_IMAGE=ghcr.io/mayesidev/acronymicon:0.2.0
docker compose pull app
docker compose up -d
```

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
docker compose exec app pnpm run db:seed:container
```

Import another JSON file into the running container by copying it into the
container first, then running the container importer:

```bash
docker cp path/to/acronyms.json $(docker compose ps -q app):/tmp/acronyms.json
docker compose exec app pnpm run import:acronyms:container -- /tmp/acronyms.json
```
