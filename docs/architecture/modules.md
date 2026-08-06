# Application module boundaries

This document defines Acronymicon's target source layout and dependency
direction. The structure is feature-oriented where behavior has a product
owner, with small domain, platform, UI, and route boundaries for concerns that
are intentionally shared.

## Target layout

| Path                           | Responsibility                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `app/domain/`                  | Framework-independent value types and rules shared by more than one feature                     |
| `app/features/authentication/` | User identity, session/OIDC behavior, and authentication-specific presentation                  |
| `app/features/dictionary/`     | Published-entry read models, search/list behavior, and dictionary presentation                  |
| `app/features/submission/`     | Submission validation, duplicate policy, write orchestration, and form behavior                 |
| `app/platform/config/`         | Environment parsing and typed runtime configuration                                             |
| `app/platform/database/`       | SQLite ownership, migrations, schema, and feature-facing persistence adapters                   |
| `app/ui/`                      | Reusable presentation primitives and the application shell; no product or persistence decisions |
| `app/routes/`                  | React Router transport adapters and composition; route registration remains in `app/routes.ts`  |

Tests stay beside the unit that owns the behavior. Development and maintenance
entry points remain in `scripts/`, and may import supported platform or feature
entry points rather than internal implementation files.

## Dependency direction

Dependencies point inward toward contracts and behavior:

```text
routes ──> features ──> domain
  │           ▲           ▲
  └──> ui     │           │
              └── platform adapters
```

The practical rules are:

1. Routes translate HTTP and URL input, compose feature APIs, and translate
   feature outcomes into responses. They do not implement persistence queries
   or domain policy.
2. Feature models and client-capable feature/UI modules can depend on domain
   values and reusable UI. They cannot import `*.server.*`, platform
   implementations, route modules, or the legacy `app/db` and `app/auth`
   implementations.
3. Server-only feature modules are named `*.server.ts`/`*.server.tsx` or live
   under a feature `server/` directory. They expose feature-facing operations,
   not database-shaped results.
4. Platform adapters may implement contracts owned by a feature and use domain
   value types. Platform modules cannot depend on routes or presentation.
5. Shared UI cannot depend on a product feature. A feature-specific component
   stays with its feature even when more than one route renders it.
6. Cross-feature calls go through the owning feature's public contract. Code
   does not reach into another feature's internal server or UI files.
7. Broad compatibility barrels are temporary migration tools, not permanent
   APIs. Remove them in the same change that moves their final consumer.

ESLint's core `no-restricted-imports` rule enforces the high-risk directions as
part of `pnpm run lint`, which is included in `pnpm run verify`. The rules cover
both the target directories and the current shared components so new
server-to-client leaks cannot be introduced during the migration.

## Current migration gaps

The repository will reach the target layout in focused changes rather than one
large rename. These are the only planned structural gaps:

| Current gap                                                                                               | Planned resolution                                                                                         |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Home and definition routes import the legacy acronym repository                                           | Introduce dictionary read/search services and route-facing result contracts                               |
| The submit route combines transport, policy, client state, and persistence                                | Extract pure policy first, followed by server orchestration and client presentation                        |
| Configuration, bootstrap, schema, repositories, and SQLite ownership remain in top-level/`app/db` modules | Move configuration and SQLite ownership after feature-facing persistence contracts have been established  |
| Reusable UI remains under `app/components` while its foundation is evaluated                              | Keep the UI-foundation decision and any resulting component migration as a separate architectural change  |

Each structural pull request moves one boundary, colocates its tests, tightens
the corresponding lint rule, and preserves user-visible behavior. Router, UI
foundation, database, and search-engine decisions remain separate changes.
