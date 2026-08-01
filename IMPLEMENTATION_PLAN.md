# Acronymicon MVP Implementation Record

The MVP implementation is complete. Execution tracking for maintenance and
future releases lives in Linear under the Acronymicon team.

- [MVP Maintenance](https://github.com/mayesidev/acronymicon/issues)
- [Version 2 Discovery](https://github.com/mayesidev/acronymicon/issues)

## Selected Stack

- React Router framework + TypeScript
- Drizzle ORM + SQLite
- Generic OIDC authentication
- Keycloak for local OIDC development
- Dockerfile + Docker Compose
- Persistent mounted SQLite volume
- JSON import command for seed/demo data

## Completed MVP Capabilities

- React Router application scaffold and app shell.
- SQLite schema, migrations, normalization, and duplicate enforcement.
- Reusable JSON import command and demo seed dataset.
- Anonymous browse and search experience.
- Generic OIDC login with local Keycloak configuration.
- Authenticated submission with submitter identity and immediate publication.
- Existing-acronym warning and exact-duplicate blocking.
- Containerized app, persistent volume, backup notes, and runtime import command.
- Typecheck, production build, Docker smoke checks, and MVP runtime verification.

## MVP Boundary

Admin removal, moderation, editing, role authorization, voting, bulk-import
UI, and Postgres migration were intentionally deferred. Their requirements
are not committed here; they are tracked as Version 2 discovery work in
Linear.
