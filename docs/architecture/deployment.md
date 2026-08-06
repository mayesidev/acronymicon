# Deployment, persistence, and release boundaries

Status: accepted on 2026-08-06

## Context

Acronymicon is a server-rendered application that owns a SQLite database and
performs search in the application process. This keeps the current product
small and operable, but it also makes the supported deployment topology more
specific than a stateless web application.

This decision describes the current boundary and the evidence that should
trigger a new database or search decision. Triggers are requirements and
observed operating metrics, not calendar dates.

## Supported topology

Run one Acronymicon application instance with one persistent filesystem volume
that is local or directly attached to that instance's host. The database file
must survive image and container replacement. The provided Compose setup uses
one application service and a named volume mounted at `/data`.

| Topology | Support | Reason |
| --- | --- | --- |
| One process with a local Docker volume or host-attached persistent disk | Supported | One application owns the SQLite file and its migrations. |
| Restarting or replacing that process while retaining the volume | Supported | The database lifetime is independent of the application image. |
| Multiple application replicas sharing one SQLite file | Unsupported | The application does not coordinate migrations, writer ownership, or failover across replicas. |
| NFS, SMB, object-backed mounts, or distributed filesystems for the SQLite file | Unsupported | The project does not validate the locking and durability semantics of network filesystems. |
| Ephemeral storage without an external backup and restore process | Unsupported for persistent use | Replacing the instance would discard application data. |

A load balancer, orchestrator, or restart policy does not make a multi-replica
deployment supported. At most one instance may have the database volume
attached and serve traffic at a time. A cold-standby replacement is acceptable
only when the previous instance has stopped and the volume is attached to the
replacement exclusively.

## Why SQLite remains appropriate

The current workload has one application owner, a compact relational model,
low write concurrency, and no requirement for independently scaled database
infrastructure. SQLite provides transactions and constraints without adding a
separate service, credential, network, or backup protocol. The application
enables write-ahead logging, foreign keys, and a bounded busy timeout.

These advantages depend on retaining the single-owner topology. SQLite is not
being treated as a transparent substitute for a shared client/server database.

## Migration, import, backup, and restore ownership

- Schema changes are committed as Drizzle migrations with the application
  release. Application startup applies bundled migrations by default before
  serving requests. Operators may run the database migration command
  separately when their deployment process requires an explicit maintenance
  step.
- Deploy one release against the volume at a time. Do not start old and new
  application revisions concurrently against the same database during an
  update.
- Run one migration or import command at a time. Coordinate large imports with
  normal traffic when their write duration could affect request latency.
- Deployment operators own volume durability, backup scheduling, retention,
  access control, restore drills, and the resulting recovery-point and
  recovery-time objectives.
- The supported simple backup procedure stops the application before copying
  the database, as documented in the README. This allows SQLite to close and
  avoids treating a live copy of only the main file as a complete backup.
- Restore into a stopped application and verify the restored database with the
  application release that will open it. A backup is not considered usable
  until a restore drill has opened it successfully and exercised representative
  reads.

The project does not currently provide online backup orchestration,
point-in-time recovery, cross-region replication, or automated rollback of a
schema migration.

## When to evaluate a client/server database

Evaluate PostgreSQL or another client/server database when any of these is a
current requirement or observed condition:

- Availability or throughput requirements need two or more application
  replicas to serve traffic or write concurrently.
- The deployment platform cannot provide an exclusive persistent volume with
  the required durability, or requires the database to live on an unsupported
  shared filesystem.
- Measured lock waits, busy errors, or write-related request latency exceed the
  product's accepted error and latency objectives under representative load,
  after bounded SQLite transaction and query tuning.
- A backup and restore drill cannot meet the operator's defined recovery-point
  or recovery-time objective, or the product requires online backup,
  point-in-time recovery, managed failover, or cross-region replication.
- Migration or import maintenance windows exceed the deployment's accepted
  duration, and the limiting requirement is concurrent database access rather
  than an application query that can be optimized in place.

Record the relevant requirement, production metric, or representative load
result before selecting a replacement. Database size alone is not a migration
reason unless it causes an observed reliability, latency, memory, backup, or
operability problem.

## When to evaluate indexed search

Dictionary search currently loads the published entries required by the
feature and ranks exact, prefix, substring, and bounded edit-distance matches
in the application process. This keeps ranking behavior explicit and is
appropriate for the current corpus.

Evaluate SQLite full-text search or another indexed implementation when:

- p95 search latency exceeds the product's accepted target against a
  representative production corpus;
- search-related allocations push peak process memory beyond the deployment's
  per-instance budget;
- profiling shows search ranking dominates request CPU and prevents the
  instance from meeting its concurrency or latency objective;
- loading the searchable corpus for a request becomes the measured bottleneck;
  or
- product requirements need indexed-language behavior, ranking, or query
  capabilities that the current matcher cannot provide predictably.

SQLite FTS is the first candidate while the single-instance database decision
still holds. A separate search service requires its own decision and should be
considered only when its independent scaling or query capabilities are a
demonstrated requirement.

## Automatic release decision

Releases are automatic because a merge to `main` has already passed the
change-appropriate confidence gates. The delivery chain is:

1. A pull request uses a Conventional Commit title validated by the commit
   metadata check and passes its change-appropriate CI and CodeQL checks before
   squash merge.
2. CI classifies the merged paths and repeats the relevant checks on the exact
   `main` commit. Application changes run typechecking, linting, coverage,
   production builds, dependency security checks, browser tests, a container
   smoke test, and the runtime-image vulnerability policy. Container-definition
   changes also run the ARM64 container smoke path.
3. Only a successful `main` CI run may invoke semantic-release. `feat` creates
   a minor release; `fix`, `perf`, `refactor`, `chore(deps-runtime)`, and
   `build(runtime)` create a patch release. A declared breaking change creates
   a major release. Documentation-only, test-only, and CI-only changes do not
   create a deployable release.
4. When semantic-release creates a version, the corresponding tagged source is
   built and published for linux/amd64 and linux/arm64 with an SPDX SBOM and
   SLSA provenance. Version, major/minor, and `latest` tags identify that same
   image at publication time.

There is no separate manual approval gate after these checks. Consumers retain
deployment control by choosing when to pull a versioned image, and can select a
previous compatible version if an application rollback is required. Database
rollback remains an operator-planned action because schema migrations are not
automatically reversed.

Documentation-only changes intentionally skip executable application and
container jobs, then semantic-release records no new version. They do not alter
the shipped artifact. Any change that affects executable code, dependency
metadata, build behavior, or workflow behavior must not be labeled or scoped as
documentation merely to bypass its relevant checks.
