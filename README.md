# Acronymicon

Acronymicon is an internal acronym dictionary web app.

See [SPEC.md](./SPEC.md) and [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for product requirements and the implementation roadmap.

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev -- --host 0.0.0.0
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
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate
```

Local database files under `data/` are ignored by git.

## Seed And Import

Load the demo seed data:

```bash
npm run db:seed
```

Import another JSON file:

```bash
npm run import:acronyms -- path/to/acronyms.json
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

Optional claim mapping variables are documented in `.env.example`.

## Verification

Run typecheck:

```bash
npm run typecheck
```

Build for production:

```bash
npm run build
```
