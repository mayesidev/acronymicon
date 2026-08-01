# Acronymicon

Acronymicon is an internal acronym dictionary web app.

See [SPEC.md](./SPEC.md) for the MVP product contract and
[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the completed MVP
implementation record. Maintenance and future-release work is tracked in
[Linear](https://github.com/mayesidev/acronymicon/issues).

## Development

Install dependencies:

```bash
pnpm install
```

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
