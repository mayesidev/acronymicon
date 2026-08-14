# Protected deployment operator guide

This guide describes Acronymicon's optional controlled deployment profile and
the surrounding conditions an operator must provide. The profile enforces the
application-owned boundary described below. It does not validate or certify the
identity provider, network, host, storage, logging platform, or deployment as a
whole.

The local Docker Compose environment contains development credentials, permits
plain HTTP, and exposes a development identity provider. It is not a production
security baseline.

## Responsibility boundary

| Acronymicon provides                                                                                          | The deployment operator must provide                                                                                                     |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Startup rejection of missing or unsafe controlled-profile settings                                            | Approved setting values and a deployment process that stops on startup failure                                                           |
| Server-side authentication and exact-group capability checks for dictionary reads and submissions             | Identity lifecycle, multi-factor authentication policy, group assignment, and trustworthy claim issuance                                 |
| Server-owned sessions with inactivity, absolute-lifetime, reauthentication, rotation, and revocation behavior | Approved session durations, identity-provider session alignment, secret generation, injection, rotation, and revocation procedures       |
| Canonical application redirects, secure cookies, protected response headers, and generic production errors    | TLS termination, trusted proxy configuration, network boundaries, firewalling, and canonical-origin routing                              |
| A single-instance SQLite persistence model with application-managed migrations                                | Exclusive durable storage, encryption and access control, backup retention, restore drills, and recovery objectives                      |
| Bounded structured audit records on standard output and sink-health records on standard error                 | Protected collection of both streams, reliable transport, time synchronization, retention, monitoring, alerting, and response procedures |
| Versioned multi-architecture images with attached SBOM and provenance attestations                            | Selection and verification of an immutable release or digest, timely patch deployment, rollback planning, and runtime hardening          |

## Application configuration

Start from [`.env.example`](../.env.example), supply deployment-specific
values through the platform's secret and configuration mechanisms, and set at
least the following values:

```dotenv
NODE_ENV=production
ACRONYMICON_DEPLOYMENT_PROFILE=controlled
ACRONYMICON_DICTIONARY_ACCESS=authenticated
ACRONYMICON_PUBLIC_ORIGIN=https://acronymicon.example.test

ACRONYMICON_READ_GROUPS=acronymicon-readers
ACRONYMICON_SUBMIT_GROUPS=acronymicon-contributors

SESSION_SECRET=<unpredictable value of at least 32 characters>
SESSION_PREVIOUS_SECRETS=
SESSION_COOKIE_SECURE=true
SESSION_ABSOLUTE_TIMEOUT_MINUTES=<approved whole minutes>
SESSION_INACTIVITY_TIMEOUT_MINUTES=<approved whole minutes>
SESSION_REAUTHENTICATION_INTERVAL_MINUTES=<approved whole minutes>

OIDC_ISSUER_URL=https://identity.example.test/issuer
OIDC_CLIENT_ID=acronymicon
OIDC_CLIENT_SECRET=<injected secret>
OIDC_REDIRECT_URI=https://acronymicon.example.test/auth/callback
OIDC_POST_LOGOUT_REDIRECT_URI=https://acronymicon.example.test/
OIDC_SCOPES=openid profile email
OIDC_ALLOW_INSECURE_HTTP=false
OIDC_CLAIM_USER_ID=sub
OIDC_CLAIM_GROUPS=groups
```

Use the real public origin in every application and provider registration.
Never copy the example hostnames, credentials, or local Compose secrets into a
production deployment. Startup validation and its automated evidence are in
the [runtime configuration tests](../app/platform/config/runtime.server.test.ts).

### Identity and access

Configure an OpenID Connect provider that:

- enforces the deployment's account lifecycle and authentication policy,
  including multi-factor authentication where required;
- allows only the registered HTTPS callback and post-logout destinations;
- returns a stable, non-reassignable identifier in the configured user-ID
  claim;
- returns exact group-name strings in the configured groups claim;
- supports the OIDC `max_age` parameter and returns a valid `auth_time` claim;
  and
- limits token and provider-session lifetimes consistently with the
  application's configured session bounds.

`ACRONYMICON_READ_GROUPS` grants dictionary read access.
`ACRONYMICON_SUBMIT_GROUPS` grants both read and submission access. Omit submit
groups for a read-only deployment. Missing, malformed, or unmapped group claims
grant no capability. Provider-side assignment and removal of those groups is
the operator's access-management boundary.

The application stores only a signed opaque session identifier in the browser;
identity and group claims are held in the server-owned session record. Data and
mutation requests that require reauthentication fail without replaying their
content. These behaviors are exercised by the
[authentication access tests](../app/features/authentication/server/access.test.ts),
[OIDC tests](../app/features/authentication/server/oidc.test.ts), and
[integrated controlled-profile suite](../app/controlled-profile.integration.test.ts).

### Session secrets and revocation

Generate `SESSION_SECRET` with a cryptographically secure secret generator and
inject it at runtime. Do not bake session or OIDC client secrets into an image,
compose file, source file, or log. Restrict access to the runtime configuration
and restart the application after changing a secret.

For a planned session-secret rotation, deploy the new active value in
`SESSION_SECRET` and the old value in `SESSION_PREVIOUS_SECRETS`. Remove the old
value after the longest possible pre-rotation session has expired. An emergency
rotation can omit the previous value to invalidate all existing cookies.
Deleting a server-side session record revokes that session immediately.

Choose absolute, inactivity, and reauthentication values from the deployment's
approved policy. Inactivity and reauthentication intervals cannot exceed the
absolute lifetime. Align the identity provider so it can satisfy the
application's reauthentication request rather than silently extending a weaker
provider session. Session lifecycle and rotation behavior are covered by the
[session tests](../app/features/authentication/server/session.test.ts) and
[authentication workflow tests](../app/features/authentication/server/workflow.test.ts).

## Transport and network boundary

Terminate TLS before traffic reaches an untrusted network and allow access only
through the intended reverse proxy or ingress. Configure that component to use
the canonical public origin and reject unrecognized hosts. Do not depend on
forwarded host headers to change application redirects.

The controlled profile requires HTTPS application and OIDC destinations,
secure cookies, and a production runtime. It adds no-store, transport,
framing, referrer, content-type, and form/base restrictions to responses. The
application behavior is covered by the
[security-header tests](../app/platform/http/security-headers.server.test.ts)
and [content-boundary tests](../app/content-boundary.test.ts). The operator
still owns proxy trust, TLS versions and certificates, network segmentation,
service exposure, rate limits, and denial-of-service protections.

## Storage, backup, and maintenance access

Use the supported single-instance topology in the
[deployment boundary](architecture/deployment.md). Mount `/data` from durable,
exclusively attached storage and protect the database file, its SQLite journal
files, snapshots, backups, and any operator-generated copies with the same
access and encryption controls as the dictionary content.

Stop the application before using the documented simple database-copy backup.
Restore into a stopped application, then verify representative reads with the
release that will open the restored database. Define backup retention,
recovery-point and recovery-time objectives, and perform scheduled restore
drills; successful file creation alone is not a restore test.

Database migration and command-line import operations run outside the HTTP
OIDC capability layer. Restrict container execution, volume access, and
deployment credentials to authorized operators, and run only one maintenance
operation at a time. Review the corresponding bounded audit events after each
operation.

## Audit collection and monitoring

Acronymicon writes one JSON audit event per line to standard output. If the
primary stream is unavailable, it attempts one `audit.sink.append` health event
on standard error. Capture both streams separately from interactive terminal
output and transport them to the deployment's protected collector.

The application deliberately excludes dictionary text, notes, credentials,
tokens, raw request URLs and queries, and free-form exception details from its
audit contract. Do not add those values during collector enrichment. Preserve
the schema fields, restrict log access, synchronize the application host and
collector clocks, and define retention, alerting, review, and incident-response
procedures. Alert on sink-health failures and unexpected gaps in expected
authentication, authorization, submission, import, or migration activity.

The event contract, redaction, delivery semantics, and fallback behavior are
covered by the [audit publisher tests](../app/platform/audit/publisher.test.ts),
[JSON-line sink tests](../app/platform/audit/json-line-sink.server.test.ts), and
[integrated controlled-profile suite](../app/controlled-profile.integration.test.ts).

## Release selection and updates

Use the latest supported release after validating it in the deployment's test
environment. Prefer an immutable manifest digest for deployment rather than a
mutable `latest` tag. Resolve a versioned image before recording that digest:

```bash
docker buildx imagetools inspect ghcr.io/mayesidev/acronymicon:vX.Y.Z
export ACRONYMICON_IMAGE=ghcr.io/mayesidev/acronymicon@sha256:<manifest-digest>
```

Confirm that the digest is the one approved by the deployment process and that
the registry exposes the expected SBOM and provenance attestations. After
deployment, open the application's About page and verify that its version
matches the intended GitHub release; the page also links to the corresponding
public source and license information.

Monitor published releases and the project [security policy](../SECURITY.md),
evaluate updates promptly, and keep a tested application and database rollback
plan. Never run old and new releases concurrently against the same SQLite
volume. Schema migrations are not automatically reversed, so a rollback may
require restoring a compatible backup.

## Pre-deployment validation checklist

- [ ] A versioned image was resolved to an approved immutable digest, and its
      registry attestations and About-page version were verified.
- [ ] The application uses `NODE_ENV=production` and the controlled profile,
      and startup succeeds with no validation bypasses.
- [ ] The public origin, OIDC issuer, callback, and logout destinations use
      HTTPS and exactly match the proxy and provider registrations.
- [ ] Local example credentials and secrets have been replaced; runtime secret
      access and rotation procedures are documented and tested.
- [ ] The identity provider enforces the approved account, authentication,
      reauthentication, and group-assignment policies.
- [ ] Anonymous, unmapped, read-only, and submitting test identities receive
      exactly the intended application capabilities.
- [ ] Absolute, inactivity, provider reauthentication, and provider-session
      lifetimes are aligned and have been exercised.
- [ ] Only one application instance owns the protected persistent volume, and
      database, journal, snapshot, backup, and copy access is restricted.
- [ ] A backup has been restored and representative reads verified within the
      deployment's recovery objectives.
- [ ] Standard output and standard error reach the protected audit collector;
      timestamps, retention, alerts, access controls, and sink-failure handling
      have been validated.
- [ ] TLS, proxy trust, canonical-host rejection, network exposure, runtime
      restrictions, resource limits, and time synchronization have been
      validated outside the application.
- [ ] Update monitoring and application/database rollback procedures have been
      tested by the responsible operators.

The [integrated controlled-profile suite](../app/controlled-profile.integration.test.ts)
is evidence for the application guarantees in this guide. It is not evidence
for the surrounding provider, network, host, storage, or logging configuration.
