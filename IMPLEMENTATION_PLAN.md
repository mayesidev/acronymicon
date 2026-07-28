# Acronymicon Implementation Plan

## Selected Stack

- React Router framework + TypeScript
- Drizzle ORM + SQLite
- Generic OIDC authentication
- Keycloak for local OIDC development
- Dockerfile + Docker Compose
- Persistent mounted SQLite volume
- JSON import command for seed/demo data

## Milestone 1: Project Scaffold

Create the React Router framework application and baseline project tooling.

Deliverables:

- React Router framework app scaffolded with TypeScript.
- Basic app shell route.
- Development scripts documented in `package.json`.
- Formatting and linting available if included by the scaffold.
- Initial smoke test or typecheck command verified.

## Milestone 2: Database Foundation

Add SQLite persistence through Drizzle.

Deliverables:

- Drizzle configured for SQLite.
- Database path configurable through environment variables.
- Initial acronym entry schema.
- Migration generation and apply commands.
- Database files excluded from git.

Initial table fields:

- `id`
- `acronym`
- `definition`
- `notes`
- `category`
- `tags`
- `aliases`
- `source`
- `status`
- `submittedByUserId`
- `submittedByUsername`
- `submittedByDisplayName`
- `createdAt`
- `updatedAt`

## Milestone 3: JSON Import

Build a reusable JSON import command and seed dataset.

Deliverables:

- Importable JSON file format.
- Seed/demo JSON file.
- Import script that validates records before inserting.
- Exact duplicate detection using normalized `acronym + definition`.
- Clear handling for duplicate records.

Initial recommendation:

- Report per-record import errors.
- Skip exact duplicates by default.
- Exit non-zero only for invalid input shape or unexpected import failure.

## Milestone 4: Browse And Search

Build the unauthenticated dictionary experience.

Deliverables:

- Browse published entries without login.
- Search by acronym, definition, notes, category, and tags.
- Show duplicate acronym meanings clearly.
- Empty states for no entries and no search results.
- Compact reference-tool layout.

## Milestone 5: Authenticated Submission

Add OIDC-backed submission.

Deliverables:

- Generic OIDC configuration.
- Local Keycloak development configuration.
- Login flow required for submission.
- Browsing remains available without login.
- Submitted entries store stable user ID and username.
- Submissions publish immediately with `status = "published"`.
- Existing acronym warning before submission.
- Exact duplicate submissions blocked.

## Milestone 6: Containerized Deployment

Package the app for local and protected-network deployment.

Deliverables:

- Production Dockerfile.
- Docker Compose setup for app, SQLite volume, and local Keycloak.
- Environment variable examples.
- Persistent database volume convention.
- Basic backup/update notes.

## Milestone 7: Verification

Validate core behavior end to end.

Deliverables:

- Typecheck/build passes.
- Import command works against a clean database.
- Browse/search works with seeded data.
- Submission requires login.
- Submitted entry appears immediately.
- Duplicate exact definition is blocked.
- Existing acronym warning appears for likely duplicates.

## Deferred Features

- Admin removal or hiding of entries.
- Moderator role workflows.
- Submitter editing.
- Note editing on existing definitions.
- Ranking or upvoting duplicate acronym meanings.
- Bulk import UI.
- Postgres migration.
