import {
  buildAuthorizationUrl,
  buildOidcLogoutUrl,
  completeAuthorizationCodeGrant,
  getOidcMaximumAuthenticationAgeSeconds,
  isOidcConfigured,
  randomOidcCodeVerifier,
  randomOidcState,
} from "./oidc";
import type {
  AuditActor,
  AuditOutcome,
  AuditPublisher,
  AuditTarget,
} from "../../../domain/audit";
import { auditPublisher } from "../../../platform/audit/runtime.server";
import {
  clearForceReauthenticationCookie,
  commitAuthenticationFlowSession,
  commitSession,
  createForceReauthenticationCookie,
  destroyAuthenticationFlowSession,
  destroySession,
  getAuthenticatedSession,
  getAuthenticationFlowSession,
  getSession,
  hasForceReauthentication,
  isReauthenticationDue,
} from "./session";

export type AuthenticationDependencies = {
  isOidcConfigured: typeof isOidcConfigured;
  randomOidcState: typeof randomOidcState;
  randomOidcCodeVerifier: typeof randomOidcCodeVerifier;
  hasForceReauthentication: typeof hasForceReauthentication;
  getOidcMaximumAuthenticationAgeSeconds: typeof getOidcMaximumAuthenticationAgeSeconds;
  getAuthenticatedSession: typeof getAuthenticatedSession;
  buildAuthorizationUrl: typeof buildAuthorizationUrl;
  completeAuthorizationCodeGrant: typeof completeAuthorizationCodeGrant;
  buildOidcLogoutUrl: typeof buildOidcLogoutUrl;
  auditPublisher: AuditPublisher;
  randomCorrelationId: () => string;
};

const defaultDependencies: AuthenticationDependencies = {
  isOidcConfigured,
  randomOidcState,
  randomOidcCodeVerifier,
  hasForceReauthentication,
  getOidcMaximumAuthenticationAgeSeconds,
  getAuthenticatedSession,
  buildAuthorizationUrl,
  completeAuthorizationCodeGrant,
  buildOidcLogoutUrl,
  auditPublisher,
  randomCorrelationId: () => crypto.randomUUID(),
};

export function createAuthenticationWorkflow(
  dependencies: AuthenticationDependencies = defaultDependencies,
) {
  return {
    async beginSignIn(request: Request) {
      if (!dependencies.isOidcConfigured()) {
        return { status: "not-configured" as const };
      }

      const session = await getAuthenticationFlowSession(
        request.headers.get("Cookie"),
      );
      const returnTo = safeReturnTo(
        new URL(request.url).searchParams.get("returnTo"),
      );
      const authenticatedSession =
        await dependencies.getAuthenticatedSession(request);
      const maxAgeSeconds =
        dependencies.getOidcMaximumAuthenticationAgeSeconds();
      const authenticationPurpose = isReauthenticationDue(
        authenticatedSession,
        maxAgeSeconds === undefined ? undefined : maxAgeSeconds / 60,
      )
        ? ("reauthenticate" as const)
        : ("login" as const);
      const state = dependencies.randomOidcState();
      const codeVerifier = dependencies.randomOidcCodeVerifier();
      let redirectTo;

      try {
        redirectTo = await dependencies.buildAuthorizationUrl({
          request,
          state,
          codeVerifier,
          forceReauthentication:
            await dependencies.hasForceReauthentication(request),
          maxAgeSeconds,
        });
      } catch (error) {
        await publishAuthenticationOutcome({
          publisher: dependencies.auditPublisher,
          correlationId: dependencies.randomCorrelationId(),
          action: authenticationAction(authenticationPurpose),
          actor: authenticatedSession.user
            ? { type: "user", id: authenticatedSession.user.id }
            : { type: "anonymous" },
          target: { type: "application" },
          outcome: "failed",
          delivery: "best-effort",
        });
        throw error;
      }

      session.set("oidcState", state);
      session.set("oidcCodeVerifier", codeVerifier);
      session.set("authenticationPurpose", authenticationPurpose);
      if (maxAgeSeconds !== undefined) {
        session.set("oidcMaxAgeSeconds", maxAgeSeconds);
      }
      session.set("returnTo", returnTo);

      return {
        status: "redirect" as const,
        location: redirectTo.href,
        cookies: [await commitAuthenticationFlowSession(session)],
      };
    },

    async completeSignIn(request: Request) {
      const correlationId = dependencies.randomCorrelationId();
      const session = await getAuthenticationFlowSession(
        request.headers.get("Cookie"),
      );
      const expectedState = session.get("oidcState");
      const codeVerifier = session.get("oidcCodeVerifier");
      const maxAgeSeconds = session.get("oidcMaxAgeSeconds");
      const authenticationPurpose =
        session.get("authenticationPurpose") ?? "login";
      const returnTo = session.get("returnTo") ?? "/";
      const existingAuthentication =
        await dependencies.getAuthenticatedSession(request);
      const action = authenticationAction(authenticationPurpose);

      if (!expectedState || !codeVerifier) {
        await publishAuthenticationOutcome({
          publisher: dependencies.auditPublisher,
          correlationId,
          action,
          actor: existingAuthentication.user
            ? { type: "user", id: existingAuthentication.user.id }
            : { type: "anonymous" },
          target: { type: "application" },
          outcome: "failed",
          delivery: "best-effort",
        });
        session.flash(
          "authError",
          "Sign-in session expired. Please try again.",
        );

        return {
          status: "failed" as const,
          location: "/",
          cookies: [await commitAuthenticationFlowSession(session)],
        };
      }

      let identity;
      try {
        identity = await dependencies.completeAuthorizationCodeGrant({
          request,
          expectedState,
          codeVerifier,
          maxAgeSeconds,
        });
      } catch (error) {
        await publishAuthenticationOutcome({
          publisher: dependencies.auditPublisher,
          correlationId,
          action,
          actor: existingAuthentication.user
            ? { type: "user", id: existingAuthentication.user.id }
            : { type: "anonymous" },
          target: { type: "application" },
          outcome: "failed",
          delivery: "best-effort",
        });
        throw error;
      }

      const auditResult = await publishAuthenticationOutcome({
        publisher: dependencies.auditPublisher,
        correlationId,
        action,
        actor: { type: "user", id: identity.user.id },
        target: { type: "identity", id: identity.user.id },
        outcome: "succeeded",
        delivery: "required",
      });

      if (auditResult.status === "unavailable") {
        session.unset("oidcState");
        session.unset("oidcCodeVerifier");
        session.unset("oidcMaxAgeSeconds");
        session.unset("authenticationPurpose");
        session.unset("returnTo");
        session.flash(
          "authError",
          "Sign-in is temporarily unavailable. Please try again.",
        );

        return {
          status: "audit-unavailable" as const,
          location: "/",
          cookies: [await commitAuthenticationFlowSession(session)],
        };
      }

      const authenticatedSession = await getSession();
      authenticatedSession.set("user", identity.user);
      if (identity.authenticatedAt !== undefined) {
        authenticatedSession.set("authenticatedAt", identity.authenticatedAt);
      }

      const cookies: string[] = [];
      if (existingAuthentication.user) {
        cookies.push(await destroySession(existingAuthentication.session));
      }
      cookies.push(
        await commitSession(authenticatedSession),
        await destroyAuthenticationFlowSession(session),
        await clearForceReauthenticationCookie(),
      );

      return {
        status: "authenticated" as const,
        location: returnTo,
        cookies,
      };
    },

    async signOut(request: Request) {
      const correlationId = dependencies.randomCorrelationId();
      const session = await getSession(request.headers.get("Cookie"));
      const user = session.get("user");
      const actor = user
        ? ({ type: "user", id: user.id } as const)
        : ({ type: "anonymous" } as const);
      const target = user
        ? ({ type: "identity", id: user.id } as const)
        : ({ type: "application" } as const);
      let providerLogoutUrl;

      try {
        providerLogoutUrl = await dependencies.buildOidcLogoutUrl({ request });
      } catch (error) {
        await publishAuthenticationOutcome({
          publisher: dependencies.auditPublisher,
          correlationId,
          action: "authentication.logout",
          actor,
          target,
          outcome: "failed",
          delivery: "best-effort",
        });
        throw error;
      }

      await publishAuthenticationOutcome({
        publisher: dependencies.auditPublisher,
        correlationId,
        action: "authentication.logout",
        actor,
        target,
        outcome: "succeeded",
        delivery: "best-effort",
      });

      return {
        location: providerLogoutUrl?.toString() ?? "/",
        cookies: [
          await destroySession(session),
          await createForceReauthenticationCookie(),
        ],
      };
    },
  };
}

type AuthenticationAuditInput = Readonly<{
  publisher: AuditPublisher;
  correlationId: string;
  action:
    | "authentication.login"
    | "authentication.logout"
    | "authentication.reauthenticate";
  actor: AuditActor;
  target: AuditTarget;
  outcome: AuditOutcome;
  delivery: "required" | "best-effort";
}>;

function publishAuthenticationOutcome({
  publisher,
  correlationId,
  action,
  actor,
  target,
  outcome,
  delivery,
}: AuthenticationAuditInput) {
  return publisher.publish({
    delivery,
    event: {
      correlationId,
      actor,
      source: "http",
      action,
      target,
      outcome,
    },
  });
}

function authenticationAction(purpose: "login" | "reauthenticate") {
  return purpose === "reauthenticate"
    ? ("authentication.reauthenticate" as const)
    : ("authentication.login" as const);
}

export const authenticationWorkflow = createAuthenticationWorkflow();

export function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  const url = new URL(value, "https://acronymicon.invalid");

  if (url.pathname.endsWith(".data")) {
    return "/";
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
