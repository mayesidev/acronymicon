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
application code. The supported single-instance topology, persistence and
backup ownership, scaling triggers, and automatic release gates are documented
in [the deployment and release decision](docs/architecture/deployment.md). The
current framework choice and the evidence required to revisit it are recorded
in [the router framework decision](docs/architecture/router.md).

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
is required in production. In the controlled profile it and any rotation
predecessors must contain at least 32 characters. Generate an unpredictable
secret with a cryptographic password generator; do not use the example values.

To rotate without immediately invalidating every session, set the new value as
`SESSION_SECRET` and place the former value in the comma-separated
`SESSION_PREVIOUS_SECRETS` list. New cookies use only the active secret, while
listed predecessors remain valid for verification. After the longest possible
existing session has expired, remove the predecessor. Secret values must be
unique, and all application replicas must use the same ordered set throughout
the overlap.

Authenticated session records are stored in the application database. The
browser receives only a signed opaque identifier; user profile and group data
remain server-side. Deleting a session record revokes that session immediately.
Deployments upgrading from versions that stored session data in the cookie will
require currently signed-in users to authenticate once after the upgrade.

`SESSION_ABSOLUTE_TIMEOUT_MINUTES` limits total authenticated-session age;
activity never extends that deadline. `SESSION_INACTIVITY_TIMEOUT_MINUTES`
limits time between authenticated application requests. Both accept whole
minutes from 1 through 10080 (seven days), and inactivity cannot exceed the
absolute lifetime. Standard deployments default both values to 480 minutes,
which preserves the original eight-hour behavior. Controlled deployments must
set both explicitly so operators can apply their deployment policy and align
the application values with their identity-provider session policy.

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

### Controlled deployment profile

Set `ACRONYMICON_DEPLOYMENT_PROFILE=controlled` when the application must
reject unsafe production identity and transport settings. This profile requires
production mode, an explicit HTTPS `ACRONYMICON_PUBLIC_ORIGIN`, complete OIDC
credentials, and explicit HTTPS callback and post-logout destinations on that
same origin. It also requires explicit absolute and inactivity session
lifetimes, rejects insecure session cookies and insecure OIDC transport, and
applies no-store, transport, framing, referrer, and content-type response
protections. Dictionary pages and data endpoints require an authenticated and
authorized session in this profile. Configure exact,
case-sensitive OIDC group names with `ACRONYMICON_READ_GROUPS` and
`ACRONYMICON_SUBMIT_GROUPS`; comma-separate multiple groups. Submit-group
membership also grants dictionary read access. At least one read or submit group
is required, while omitting submit groups creates a read-only deployment. The
claim selected by `OIDC_CLAIM_GROUPS` must be an array of exact group-name
strings; missing or malformed claims grant no access.

The application does not use forwarded host headers to construct security-
sensitive redirects in this profile. Configure the reverse proxy and server
adapter with a canonical request origin, and keep the explicit application and
OIDC destinations aligned. The standard profile retains request-derived local
development defaults and must not be treated as a hardened production profile.
Set `ACRONYMICON_DICTIONARY_ACCESS=authenticated` to exercise authenticated
dictionary access independently with non-production identity infrastructure;
the setting requires complete OIDC credentials. The default standard profile
uses `open` access for backward compatibility.

### Structured audit output

The supported audit transport is newline-delimited JSON. Application audit
records are written to standard output. If that primary stream is unavailable,
one bounded sink-health record is attempted on standard error. Each line is one
versioned record with bounded actor, source, action, target, outcome, timestamp,
and correlation fields. Records do not include acronym or definition text,
notes, credentials, tokens, raw request URLs or queries, or free-form exception
details.

Deployment operators are responsible for routing both streams to their
protected log collector and configuring transport protection, access control,
retention, monitoring, and analysis there. Monitor standard error health records
as a degraded primary audit stream. Keep audit output separate from interactive
terminal use, and do not enrich it with protected dictionary data.

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
