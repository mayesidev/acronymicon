# Router framework decision

Status: accepted on 2026-08-06

## Decision

Acronymicon will retain React Router Framework Mode for its current application
architecture. TanStack Start remains a credible alternative, but a representative
spike did not demonstrate enough reduction in application complexity or operational
risk to justify a migration.

This is a decision about the current requirements and available framework versions,
not a permanent restriction on future evaluations.

## Requirements

The router framework must support:

- server rendering and hydration;
- standard HTTP redirects, forms, cookies, and responses;
- an OIDC authorization-code flow with PKCE, callback, and provider logout;
- server-only SQLite reads and mutations;
- validated search and form input;
- clear boundaries between transport adapters, feature behavior, and persistence;
- unit, integration, and browser testing; and
- a portable, self-hosted Node.js container.

React Router Framework Mode already provides these capabilities through route
loaders and actions while allowing the application to keep business rules outside
route modules.

## Alternatives screened

TanStack Start was shortlisted because [TanStack Router models search parameters as
typed state](https://tanstack.com/router/latest/docs/framework/react/guide/search-params),
supports [schema validation for that state](https://tanstack.com/router/latest/docs/how-to/validate-search-params),
and provides [server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
and [server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes).
Those capabilities address the same SSR, input, and server-boundary concerns as the
current application while offering stronger compile-time link and search contracts.

Other categories were not taken forward to a spike:

- A client-only router does not satisfy the SSR, OIDC callback, session, and
  server-owned persistence requirements without assembling another server
  framework.
- React meta-frameworks centered on React Server Components or provider-specific
  hosting add deployment and rendering constraints that the application does not
  currently need.
- A non-React framework would require replacing the established UI as well as the
  router, making it a broader architecture change without a demonstrated product
  benefit.

## Representative spike

An isolated TanStack Start application exercised the following behavior without
importing or modifying production source:

- validated and typed home-search and sorting parameters;
- authenticated submission with exact- and similar-duplicate feedback;
- an encrypted HTTP-only cookie session and Keycloak OIDC login, callback, logout,
  state, and PKCE handling;
- server-only SQLite reads and mutations;
- SSR and hydration;
- focused unit tests and a browser test through the real identity provider; and
- a production Nitro build executed from a multi-stage container.

The spike used TanStack Start 1.168.37, TanStack Router 1.170.20, and Nitro
3.0.260610-beta. Temporary spike source remained outside this repository and was
removed after recording the results.

## Results

Measurements were taken on the same arm64 development machine from clean production
builds. They are directional rather than performance guarantees because the spike
reproduced representative behavior, not the complete production UI.

| Measure | React Router application | TanStack Start spike | Result |
| --- | ---: | ---: | --- |
| Representative route, authentication, session, and feature-adapter source | 593 lines | 540 lines | No material reduction after accounting for the production UI and error handling omitted from the spike |
| Initial home-route JavaScript | 354.0 KB / 116.8 KB gzip | 380.2 KB / 118.8 KB gzip | Comparable; bundle size is not a migration reason |
| Production build elapsed time | 0.79 seconds | 0.97 seconds | Comparable |
| Local arm64 runtime image content size | 70.4 MB | 89.6 MB | The spike image was larger and used a different Node base, so this is an operational signal rather than a direct benchmark |

The spike confirmed several real TanStack advantages:

- Typed links rejected a missing validated search object at build time.
- Loader dependencies explicitly connected validated search state to reload and
  cache behavior.
- The build rejected a client-reachable route that imported a server-only SQLite
  module until the access was moved behind a server function.

It also exposed migration and maturity costs:

- The existing feature and persistence boundaries transferred unchanged, so server
  functions replaced thin React Router loaders and actions rather than eliminating
  application adapters.
- OIDC still required dedicated server routes, session utilities, route guards, and
  separate authorization checks inside mutations.
- Returning `Response.redirect()` after updating a session reproduced an immutable
  header error in the tested TanStack Start Vite preview server. Constructing a
  normal 302 or 303 `Response` with a `Location` header avoided it, but that
  workaround would become application-owned framework glue.
- A deployable Node artifact required adding Nitro; the tested Nitro release was
  beta and added native-module tracing and test-configuration interactions beyond
  the default scaffold. TanStack's own [hosting guidance](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
  treats hosting configuration as an explicit deployment concern.
- The generated scaffold selected `latest` framework ranges and produced resolved
  package-version skew, which would require additional dependency pinning and
  update policy.
- A migration would rewrite every route, root and entry configuration, session and
  response integration, container entry point, CI build assumptions, and
  framework-facing browser helpers. The domain model and persistence contracts
  would not change.

## Consequences

New work should continue using React Router loaders and actions as thin transport
adapters around feature APIs. Search parsing that belongs to a route remains
explicit and validated at that boundary. Framework-specific APIs must not move into
domain or persistence modules.

Retaining React Router avoids a broad rewrite while the current framework glue is
small and the measured runtime and build characteristics are comparable. It also
means the project does not receive TanStack Router's stronger typed-link and
typed-search contracts; route tests and input schemas remain important controls.

Re-evaluate this decision when one or more of these conditions is true:

- the product adds enough interdependent URL state, nested route context, or
  loader-cache behavior that current route adapters become a measured source of
  defects or repeated complexity;
- TanStack Start offers a stable production Node deployment path and the observed
  redirect/session integration issue no longer reproduces;
- the application is already undertaking a major routing or rendering rewrite; or
- a different candidate demonstrates a concrete benefit against these same
  representative workflows.

Any future evaluation should repeat the authentication, SQLite, SSR, test, build,
and container checks rather than compare router APIs in isolation.
