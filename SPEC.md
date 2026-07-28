# Acronymicon Product Spec

## Purpose

Acronymicon is a simple web app for looking up acronyms, initialisms, and their meanings. The app should make it fast to search, browse, and understand acronym entries without requiring users to know the exact abbreviation up front.

## Current Status

This is a blank project. No technical stack has been selected yet.

## Goals

- Provide a searchable acronym dictionary.
- Support multiple meanings for the same acronym.
- Make entries easy to scan and compare.
- Keep the first version small enough to build quickly.
- Choose a tech stack based on product needs, not before them.

## Non-Goals For MVP

- User accounts.
- Public user submissions.
- Moderation workflows.
- Voting, comments, or social features.
- Complex analytics.
- Full CMS integration.

These may be reconsidered after the MVP if the product direction requires them.

## Target Users

Open question.

Possible options:

- Personal reference tool.
- Internal team/company glossary.
- Public acronym dictionary.
- Domain-specific dictionary, such as software, medicine, finance, government, or education.

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

## Possible Future Features

- Admin interface for adding and editing entries.
- CSV import/export.
- Markdown or rich text notes.
- Source links or citations.
- Authentication.
- Database-backed storage.
- API endpoints.
- Public submission form.
- Review or approval workflow.

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
- `createdAt` and `updatedAt` are useful if entries become editable later.

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

### SQLite

Best if the app needs a simple admin/editor experience but still wants low operational complexity.

Pros:

- Real database behavior.
- Simple local development.
- Good fit for modest datasets.

Cons:

- Deployment needs more thought.
- Editing and migrations add complexity.

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

## Candidate Stacks

### Vite + React + TypeScript

Good fit if:

- The app is mostly static.
- Data can start in JSON.
- Search can run in the browser.
- No backend is needed for MVP.

### Next.js + TypeScript

Good fit if:

- The app may need API routes.
- SEO matters.
- Admin editing is likely.
- Auth or database integration is likely.
- Server-rendered pages are useful.

## Initial Recommendation

Open pending product decisions.

If the MVP is read-only, start with Vite + React + TypeScript and JSON data.

If editing, auth, or database-backed persistence is part of the MVP, start with Next.js + TypeScript and pick storage based on deployment needs.

## Open Questions

1. Who is the primary audience for the app?
2. Is the first version read-only, or should acronyms be addable/editable inside the app?
3. Who will maintain the acronym data?
4. Is this a general acronym dictionary or focused on a specific domain?
5. Should the app be public on the web, private/internal, or local-only?
6. Roughly how many acronym entries should the first version support?
7. Does SEO matter?
8. Should entries include source links or citations?
9. Do we need import/export, such as CSV?
10. Where do you expect to deploy it, if anywhere?
