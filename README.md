# Acronymicon

Acronymicon is a self-hosted web app for searching, browsing, and submitting
acronym definitions.

The app supports anonymous browsing, live search across acronyms and
definitions, fuzzy matches for minor typos, readable definition links,
optional definition range marking, light and dark themes, authenticated OIDC
submissions, duplicate detection, JSON import, and persistent SQLite storage.

## Run a published release

Published images are available at `ghcr.io/mayesidev/acronymicon` for
`linux/amd64` and `linux/arm64`. No source checkout, Node.js, or pnpm is needed.

With Docker Compose installed, create `compose.yaml` in an empty directory:

```yaml
services:
  app:
    image: ghcr.io/mayesidev/acronymicon:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      DATABASE_PATH: /data/acronymicon.sqlite
    volumes:
      - acronymicon-data:/data

volumes:
  acronymicon-data:
```

Start the app:

```bash
docker compose up -d --pull always
```

Open [http://localhost:3000](http://localhost:3000). The database starts empty;
optionally load the bundled demo entries:

```bash
docker compose exec app /nodejs/bin/node build/scripts/import-acronyms.mjs seeds/acronyms.seed.json
```

The app applies database migrations on startup and keeps data in the named
volume. Keep the volume when replacing the container. OIDC is
optional for browsing; configure it below to enable signed-in submissions.

### Update to a new release

From the same directory, pull the new image and recreate the app:

```bash
docker compose pull app
docker compose up -d --no-build
```

`latest` follows the newest release. To select a specific release, change the
image tag in `compose.yaml` to a published version such as `4.2.4` (without the
`v` prefix), then run the same update commands. Back up the database before
upgrading; the backup commands below use this same Compose service.

## Configuration

By default, browsing is anonymous and submissions require OIDC sign-in.
Configure `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` to enable
OIDC. Keycloak is included for local development; other compatible providers
are supported.

In production, the app generates a session signing key once and saves it beside
the database in `.acronymicon/session-secret` (file mode `0600`, directory `0700`).
Keep this file across updates and protect the volume and its backups. An explicit
`SESSION_SECRET` overrides the saved key without being written to disk; existing
deployments should keep their configured secret to preserve sessions.

See [`.env.example`](.env.example) for configuration variables and the
[configuration guide](docs/protected-deployment.md) for production setup,
access controls, sessions, and logging.

## Container data

The app container stores SQLite data in the `acronymicon-data` Docker volume at `/data/acronymicon.sqlite`.

Keep this volume when updating the app image. For a simple backup, stop the
app, archive the data directory (including the session key), and start the app
again:

```bash
docker compose stop app
umask 077
mkdir -p backups
docker compose cp app:/data - > ./backups/acronymicon-data.tar
docker compose start app
```

The archive preserves ownership and permissions for restoration into an empty
data volume. Treat it as sensitive: it contains both application data and the key.

Import another JSON file into the running container by copying it into the
container first, then running the container importer:

```bash
docker cp path/to/acronyms.json $(docker compose ps -q app):/tmp/acronyms.json
docker compose exec app /nodejs/bin/node build/scripts/import-acronyms.mjs /tmp/acronyms.json
```

The import command accepts either an array of entries or an object with an `entries` array. Exact duplicates are skipped using normalized `acronym + definition`.

## Development from source

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

### Local database

Acronymicon stores data in SQLite through Drizzle.

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

### Local seed and import

Load the demo seed data:

```bash
pnpm run db:seed
```

Import another JSON file:

```bash
pnpm run import:acronyms -- path/to/acronyms.json
```

### Local Keycloak

From a source checkout, build and run the app with local Keycloak:

```bash
docker compose up --build
```

To use the published app image with the source checkout’s local Keycloak:

```bash
export ACRONYMICON_IMAGE=ghcr.io/mayesidev/acronymicon:latest
docker compose pull app
docker compose up -d --no-build
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

These credentials are local development fixtures only. Do not reuse them or
the example client/session secrets outside local development.

## Contributing

Report bugs and request features through [GitHub Issues](https://github.com/mayesidev/acronymicon/issues).
See [CONTRIBUTING.md](CONTRIBUTING.md) for development and contribution guidance,
and [SECURITY.md](SECURITY.md) for reporting vulnerabilities.
