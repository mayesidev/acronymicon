# Acronymicon Product Spec

## Purpose

Acronymicon is a simple web app for looking up acronyms, initialisms, and their meanings. The app should make it fast to search, browse, and understand acronym entries without requiring users to know the exact abbreviation up front.

## Current Status

This project is in requirements definition. Git is initialized and changes should be committed as meaningful checkpoints while the app is designed and built.

## Goals

- Provide a searchable acronym dictionary.
- Support multiple meanings for the same acronym.
- Make entries easy to scan and compare.
- Allow internal users to submit acronym definitions.
- Keep the first version small enough to build quickly.
- Choose a tech stack based on product needs, not before them.
- Support containerized deployment on a protected network.

## Non-Goals For MVP

- User accounts.
- Public internet access.
- Moderation workflows.
- Voting, comments, or social features.
- Complex analytics.
- Full CMS integration.

These may be reconsidered after the MVP if the product direction requires them.

## Target Users

The primary audience is an internal team using the app on a protected network.

The dictionary should be general purpose. It is expected to include business and government acronyms, but the app should not be locked to a specific acronym domain.

## MVP Features

### Search

Users should be able to search by:

- Acronym, such as `API`.
- Expansion, such as `Application Programming Interface`.
- Definition text.
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
- Expansion.
- Short definition.
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
- Expansion.
- Definition or contextual notes.
- Optional category.
- Optional tags.
- Optional source link or source note.

Open decision: whether MVP submissions are published immediately or stored as pending entries for later review.

If moderation is deferred, the app should still avoid technical choices that make moderation difficult to add later.

## Possible Future Features

- Admin interface for adding and editing entries.
- CSV import/export.
- Markdown or rich text notes.
- Source links or citations.
- Authentication.
- Database-backed storage.
- API endpoints.
- Editing existing entries.
- Review or approval workflow.
- Role-based admin capabilities.

## Data Model Draft

```ts
type AcronymEntry = {
  id: string;
  acronym: string;
  expansion: string;
  definition?: string;
  category?: string;
  tags?: string[];
  aliases?: string[];
  source?: string;
  status?: "pending" | "published" | "rejected";
  submittedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};
```

### Field Notes

- `id` should be stable and unique.
- `acronym` is the short form users search for.
- `expansion` is the expanded phrase.
- `definition` explains the meaning in context.
- `category` groups entries by broad domain.
- `tags` support more flexible filtering.
- `aliases` can support alternate spellings or related short forms.
- `source` is optional but useful if entries need attribution or verification.
- `status` allows submissions to become a moderation queue later.
- `submittedBy` can start as optional free text or be connected to auth later.
- `createdAt` and `updatedAt` are useful if entries become editable later.

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

### Pending Review

Users submit entries into a pending state. Published results only include approved entries.

Pros:

- Better content quality.
- Aligns with future moderation.

Cons:

- Requires an admin/review surface earlier.
- More product and permission decisions are needed.

Initial recommendation: use a database field for status from day one, but decide separately whether the MVP exposes a review queue.

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

## Frontend UX Direction

The app should feel like a compact reference tool rather than a marketing site.

Initial layout:

- Header with app name and search input.
- Main area with results list.
- Filter controls for category and/or tags if the dataset supports them.
- Entry detail or expanded result rows.

The first screen should be the usable dictionary experience, not a landing page.

## Stack Decision Criteria

Choose the stack based on these answers:

- Is the app read-only or editable?
- Who maintains the acronym data?
- Does the app need authentication?
- Does it need server-side APIs?
- Where will it be deployed?
- How large is the expected dataset?
- Is SEO important?
- Is single-instance deployment acceptable?
- Does the protected network provide shared database infrastructure?

## Candidate Stacks

### Vite + React + TypeScript

Good fit if:

- The app is mostly static.
- Data can start in JSON.
- Search can run in the browser.
- No backend is needed for MVP.

Assessment: not enough by itself because MVP submissions need server-side persistence.

### Next.js + TypeScript

Good fit if:

- The app may need API routes.
- SEO matters.
- Admin editing is likely.
- Auth or database integration is likely.
- Server-rendered pages are useful.

Assessment: good fit for a single app that provides both the browser UI and submission APIs.

### Remix / React Router Framework + TypeScript

Good fit if:

- The app is form-heavy.
- Server actions and progressive enhancement are valuable.
- We want a straightforward full-stack React app.

Assessment: also a good fit. Next.js may be more familiar and widely hosted; Remix-style routing may produce a simpler form-centric implementation.

## Initial Recommendation

Use a full-stack TypeScript app rather than a static frontend because the MVP includes user submissions.

Recommended starting stack:

- Next.js + TypeScript for UI and server routes.
- SQLite for MVP persistence.
- Prisma or Drizzle for schema and migrations.
- Dockerfile and compose file for repeatable protected-network deployment.
- Persistent volume for the SQLite database.

This keeps deployment simple while leaving room for future editing, moderation, and migration to Postgres if the app outgrows a single-instance SQLite deployment.

## Open Questions

1. Should MVP submissions publish immediately, or should they be pending by default?
2. Should submitters identify themselves, and if so, how?
3. Does the protected network provide authentication, such as SSO, reverse-proxy auth, or network-only trust?
4. Is single-container, single-instance deployment acceptable for MVP?
5. Does the target environment provide shared database infrastructure, or should the app own its database?
6. Roughly how many acronym entries should the first version support?
7. Does SEO matter inside the protected network?
8. Should entries include source links or citations?
9. Do we need import/export, such as CSV?
10. Should duplicate acronyms be allowed freely, or should the app warn before submitting another meaning for an existing acronym?
