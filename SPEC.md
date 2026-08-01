# Acronymicon Product Spec

## Purpose

Acronymicon is a simple web app for looking up acronyms, initialisms, and their meanings. The app should make it fast to search, browse, and understand acronym entries without requiring users to know the exact abbreviation up front.

## Current Status

The MVP implementation is complete and tracked in git. Maintenance work is
tracked in the [MVP Maintenance project](https://github.com/mayesidev/acronymicon/issues).
Version 2 requirements discovery is tracked in the [Version 2 Discovery
project](https://github.com/mayesidev/acronymicon/issues).

## Goals

- Provide a searchable acronym dictionary.
- Support multiple meanings for the same acronym.
- Prevent exact duplicate acronym definitions.
- Make entries easy to scan and compare.
- Allow internal users to submit acronym definitions.
- Associate submissions with an authenticated submitter for traceability and context.
- Keep the first version small enough to build quickly.
- Choose a tech stack based on product needs, not before them.
- Support containerized deployment on a protected network.
- Persist submitted data across container restarts, backups, and app updates.

## Non-Goals For MVP

- Public internet access.
- Moderation workflows.
- Approval-required submissions.
- Voting, comments, or social features.
- Complex analytics.
- Full CMS integration.

Dedicated local user account management is not a goal for MVP. Authentication should preferably integrate with an existing provider.

These may be reconsidered after the MVP if the product direction requires them.

## Target Users

The primary audience is an internal team using the app on a protected network.

The dictionary should be general purpose. It is expected to include business and government acronyms, but the app should not be locked to a specific acronym domain.

## MVP Features

### Search

Users should be able to search by:

- Acronym, such as `API`.
- Definition, such as `Application Programming Interface`.
- Notes or contextual text.
- Category or domain.
- Tags, if tags are included in the data model.

Search should be instant for small datasets and should tolerate case differences.

### Browse

Users should be able to browse all acronym entries in a clear list.

Useful browse controls may include:

- Alphabetical grouping.
- Category filter.
- Tag filter.
- Sort by acronym or most recently updated.

### Entry Display

Each entry should show:

- Acronym.
- Definition, meaning the full phrase the acronym stands for.
- Optional notes or contextual explanation.
- Category or domain.
- Tags, if available.

If an acronym has multiple meanings, the UI should show each meaning clearly rather than hiding duplicates.

### Empty States

The app should handle:

- No entries yet.
- No search results.
- Missing optional fields.

### Submissions

Internal users should be able to submit new acronym definitions in the MVP.

The submission form should collect:

- Acronym.
- Definition, meaning the full phrase the acronym stands for.
- Optional notes or contextual explanation.
- Optional category.
- Optional tags.
- Optional source link or source note.

Submissions should be associated with an authenticated submitter for traceability and context.

MVP submissions should publish immediately.

If a user submits an acronym that already exists, the app should warn them before submission so they can avoid accidental duplicates. Multiple meanings for the same acronym are allowed.

Exact duplicate acronym definitions should not be allowed.

In this spec, `pending` means a submitted entry is saved but does not appear in normal search and browse results until someone approves it. A pending workflow is a lightweight moderation queue.

Approval-required moderation is not part of the MVP and is less likely than post-publication moderation. The app should still keep a status field so future admin or moderator workflows can remove, hide, or review entries without a schema redesign.

## Version 2 Discovery

Editing, moderation, role permissions, metadata semantics, duplicate quality,
and future import/API scope are discovery items rather than committed product
requirements. They are tracked in the Version 2 Discovery Linear project.

## Data Model Draft

```ts
type AcronymEntry = {
  id: string;
  acronym: string;
  definition: string;
  notes?: string;
  category?: string;
  tags?: string[];
  aliases?: string[];
  source?: string;
  status?: "pending" | "published" | "removed";
  submittedByUserId?: string;
  submittedByUsername?: string;
  submittedByDisplayName?: string;
  createdAt?: string;
  updatedAt?: string;
};
```

### Field Notes

- `id` should be stable and unique.
- `acronym` is the short form users search for.
- `definition` is the full phrase the acronym stands for.
- `notes` can explain context, usage, or additional meaning.
- `category` groups entries by broad domain.
- `tags` support more flexible filtering.
- `aliases` can support alternate spellings or related short forms.
- `source` is optional but useful if entries need attribution or verification.
- `status` allows future admin or moderator workflows to hide, remove, or review entries later.
- `submittedByUserId` connects an entry to the authenticated submitter.
- `submittedByUsername` provides a stable human-readable reference from the auth provider.
- `submittedByDisplayName` can be stored if provided by the auth provider.
- `createdAt` and `updatedAt` are useful if entries become editable later.

Additional user profile fields may be stored separately if the auth provider exposes useful claims, such as email, organization, or department.

## Authentication

The protected network can provide authentication or SSO. The app should likely integrate with an OIDC-compatible provider so submissions can be tied to a stable user identity.

MVP authentication goals:

- Require authentication before submitting an acronym.
- Allow browsing without app-level login, assuming the protected network controls access.
- Store a stable provider-backed user ID with each submission.
- Store at least a username locally for display and traceability.
- Prefer existing SSO/OIDC over local usernames and passwords.
- Design against generic OIDC.
- Use Keycloak as a reasonable local development OIDC stand-in if needed.
- Do not tie the app to Keycloak, Microsoft Entra ID, or any other specific production identity provider.
- Treat Microsoft Entra ID as a possible future production OIDC provider, not a committed dependency.
- Source future admin and moderator roles from OIDC groups or claims.
- Keep authorization simple unless admin or moderator capabilities ship in the MVP.

Production provider, claim-storage, and role-mapping decisions are tracked in
Linear issues `ACR-9` and `ACR-11`.

Implementation guidance:

- Use configurable OIDC issuer, client ID, client secret, scopes, and callback URL.
- Keep claim mapping configurable where practical.
- Shape local Keycloak claims to resemble likely production providers.
- Avoid provider-specific APIs for MVP auth unless they are isolated behind a small adapter.

## Content Workflow

MVP workflow options:

### Immediate Publish

Users submit entries and they appear in search results immediately.

Pros:

- Simple.
- Fast MVP.
- No admin surface required immediately.

Cons:

- Typos and duplicate submissions become visible right away.
- Editing or cleanup must be handled later.

MVP decision: use immediate publish.

### Pending Review Or Post-Publication Moderation

Users submit entries into a pending state. Published results only include approved entries.

Pros:

- Better content quality.
- Aligns with future moderation.

Cons:

- Requires an admin/review surface earlier.
- More product and permission decisions are needed.

Initial recommendation: do not build approval-required moderation in MVP. Keep status and submitter metadata from day one, then add post-publication admin or moderator controls later.

## Duplicate Handling

The app should allow the same acronym to have multiple entries when the meanings are genuinely different.

MVP rules:

- Warn users when submitting an acronym that already exists.
- Block exact duplicate acronym definitions.
- Show multiple meanings clearly in search and browse results.

Exact duplicate matching should use normalized acronym plus normalized definition. Notes should not be part of exact duplicate detection.

Post-MVP duplicate quality and ranking decisions are tracked in Linear issue
`ACR-12` and are not part of this specification yet.

## Source And Citation Policy

Sources and citations are optional.

They should not be required or strongly emphasized in the MVP because many internal acronym definitions may not have a useful source. The form can include a source field, but it should not distract from the core acronym, definition, and notes fields.

## Seed Data

The app should include a small seed dataset for demo and testing purposes.

Seed data goals:

- Provide realistic examples for initial UI development.
- Include duplicate acronyms with different meanings.
- Include enough categories and tags to test filtering.
- Avoid implying that seeded examples are authoritative.

The seed mechanism may later be reused for bulk import, but CSV import/export is not required for MVP.

Seed data should live in an importable file rather than only in a database migration. This keeps the path open for future bulk import without making migrations responsible for content management.

Seed/import data should use JSON rather than CSV. JSON is more maintainable for optional fields, tags, and future metadata.

The MVP should include a reusable import command, even if its first use is loading demo and test seed data.

## Expected Scale

The app should comfortably support hundreds of acronym entries in MVP.

Tens of thousands of entries are considered unlikely unless there is a duplicate-entry problem or the app expands significantly. The initial search and storage design should be simple, but should not make a future move to larger-scale search impossible.

## Storage Options

### Static JSON

Best if the first version is read-only and entries are maintained by editing files in the repo.

Pros:

- Fastest to build.
- Easy to version in git.
- No backend required.
- Simple deployment.

Cons:

- Non-technical editing is awkward.
- No built-in concurrent editing.
- No user submissions without additional work.

Assessment: not a good MVP fit because internal users need to submit entries through the app.

### SQLite

Best if the app needs a simple admin/editor experience but still wants low operational complexity.

Pros:

- Real database behavior.
- Simple local development.
- Good fit for modest datasets.

Cons:

- Deployment needs more thought.
- Editing and migrations add complexity.

Assessment: a strong candidate if the app is deployed as a single container with a mounted persistent volume.

For the expected MVP scale of hundreds of entries, SQLite is sufficient from a data-volume perspective.

MVP decision: use app-owned SQLite storage unless a stronger deployment requirement emerges.

### Hosted Postgres

Best if the app needs multi-user editing, auth, collaboration, or production-grade persistence.

Pros:

- Scales beyond the MVP.
- Works well with hosted app platforms.
- Good fit for auth and admin workflows.

Cons:

- More setup.
- More moving parts.
- Slower MVP if not needed immediately.

Assessment: a strong candidate if the protected network already has database infrastructure or if multiple app instances are expected.

MVP decision: do not assume Postgres or other shared database infrastructure is available.

### Containerized App With Embedded SQLite

Best if the app should be easy to deploy in varied protected environments with minimal infrastructure.

Pros:

- Simple deployment artifact.
- Good fit for a small internal tool.
- Can run with Docker or similar container platforms.
- Avoids requiring a managed database for MVP.

Cons:

- Needs persistent volume configuration.
- Multi-instance deployments require extra care.
- Backups must be planned explicitly.

Assessment: likely MVP fit if single-instance deployment is acceptable.

Operational notes:

- Single-container, single-instance deployment is acceptable for MVP.
- The database should live on a persistent mounted volume.
- The data is important enough to support backup and app updates, but it is not mission-critical.
- Backups can be documented as an operational task rather than automated in the first version.
- Future migration to Postgres should remain possible if availability, scale, or multi-instance deployment requirements increase.
- App updates should preserve the mounted database volume.

## Frontend UX Direction

The app should feel like a compact reference tool rather than a marketing site.

Initial layout:

- Header with app name and search input.
- Main area with results list.
- Filter controls for category and/or tags if the dataset supports them.
- Entry detail or expanded result rows.
- Submission form available to authenticated users.
- Duplicate warning during submission when the entered acronym already exists.

The first screen should be the usable dictionary experience, not a landing page.

## Stack Decision Criteria

Choose the stack based on these answers:

- Is the app read-only or editable?
- Who maintains the acronym data?
- Does the app need authentication?
- Does it need server-side APIs?
- Where will it be deployed?
- How large is the expected dataset?
- Is single-instance deployment acceptable?
- Does the protected network provide shared database infrastructure?
- What OIDC or SSO integration is available?
- Should auth protect the entire app or only submission/admin actions?
- Are admin/moderator roles sourced from OIDC or managed in the app?

## Candidate Stacks

### Vite + React + TypeScript

Good fit if:

- The app is mostly static.
- Data can start in JSON.
- Search can run in the browser.
- No backend is needed for MVP.

Assessment: not enough by itself because MVP submissions need server-side persistence, OIDC sessions, duplicate enforcement, and import commands. It would require a separate API server, which adds deployment and implementation surface area without enough benefit for MVP.

### Next.js + TypeScript

Good fit if:

- The app may need API routes.
- Admin editing is likely.
- Auth or database integration is likely.
- Server-rendered pages are useful.

Assessment: viable but not selected. Next.js can provide the browser UI and server APIs, but its strongest advantages are less important here because the app is internal, SEO is not important, and we do not need a provider-hosted deployment model.

### Remix / React Router Framework + TypeScript

Good fit if:

- The app is form-heavy.
- Server actions and progressive enhancement are valuable.
- We want a straightforward full-stack React app.

Assessment: selected. The app is internal, form-heavy, and self-hosted. React Router framework's loaders/actions model fits browse, search, submit, and future admin workflows without requiring frontend/backend separation.

### Auth-Capable Full-Stack TypeScript App

Any selected framework should support:

- OIDC login.
- Provider-neutral OIDC configuration.
- Server-side session handling.
- Authenticated submission actions.
- Anonymous browsing within the protected network.
- Database access from server-side code.
- Containerized deployment.

This requirement matters more than the specific React framework choice.

## Stack Decision

Use a full-stack TypeScript app rather than a static frontend because the MVP includes user submissions.

Selected MVP stack:

- React Router framework + TypeScript for UI, routing, loaders, and actions.
- Drizzle ORM for schema and migrations.
- SQLite for app-owned MVP persistence.
- Generic OIDC authentication integration.
- Keycloak as the local development OIDC provider.
- Dockerfile and compose file for repeatable protected-network deployment.
- Persistent mounted volume for the SQLite database.
- JSON import command for seed/demo data and future bulk-import groundwork.

This keeps deployment simple while leaving room for future editing, moderation, and migration to Postgres if the app outgrows a single-instance SQLite deployment.

The auth implementation should remain provider-neutral. Keycloak is only a local development stand-in, and Microsoft Entra ID or another OIDC-compatible provider may be used later.

## SEO

SEO is not important for this app because it is intended for protected-network internal use.

## Deferred Decisions

Production authentication and infrastructure decisions are tracked in Linear
issues `ACR-9` and `ACR-11`. Import/API scope is tracked in `ACR-10`, and
metadata semantics are tracked in `ACR-13`.
