import {
  buildAuthorizationUrl,
  buildOidcLogoutUrl,
  completeAuthorizationCodeGrant,
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
  commitSession,
  createForceReauthenticationCookie,
  destroySession,
  getSession,
  hasForceReauthentication,
} from "./session";

export type AuthenticationDependencies = {
  isOidcConfigured: typeof isOidcConfigured;
  randomOidcState: typeof randomOidcState;
  randomOidcCodeVerifier: typeof randomOidcCodeVerifier;
  hasForceReauthentication: typeof hasForceReauthentication;
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

      const session = await getSession(request.headers.get("Cookie"));
      const returnTo = safeReturnTo(
        new URL(request.url).searchParams.get("returnTo"),
      );
      const state = dependencies.randomOidcState();
      const codeVerifier = dependencies.randomOidcCodeVerifier();
      const redirectTo = await dependencies.buildAuthorizationUrl({
        request,
        state,
        codeVerifier,
        forceReauthentication:
          await dependencies.hasForceReauthentication(request),
      });

      session.set("oidcState", state);
      session.set("oidcCodeVerifier", codeVerifier);
      session.set("returnTo", returnTo);

      return {
        status: "redirect" as const,
        location: redirectTo.href,
        cookies: [await commitSession(session)],
      };
    },

    async completeSignIn(request: Request) {
      const correlationId = dependencies.randomCorrelationId();
      const session = await getSession(request.headers.get("Cookie"));
      const expectedState = session.get("oidcState");
      const codeVerifier = session.get("oidcCodeVerifier");
      const returnTo = session.get("returnTo") ?? "/";

      if (!expectedState || !codeVerifier) {
        await publishAuthenticationOutcome({
          publisher: dependencies.auditPublisher,
          correlationId,
          action: "authentication.login",
          actor: { type: "anonymous" },
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
          cookies: [await commitSession(session)],
        };
      }

      let user;
      try {
        user = await dependencies.completeAuthorizationCodeGrant({
          request,
          expectedState,
          codeVerifier,
        });
      } catch (error) {
        await publishAuthenticationOutcome({
          publisher: dependencies.auditPublisher,
          correlationId,
          action: "authentication.login",
          actor: { type: "anonymous" },
          target: { type: "application" },
          outcome: "failed",
          delivery: "best-effort",
        });
        throw error;
      }

      const auditResult = await publishAuthenticationOutcome({
        publisher: dependencies.auditPublisher,
        correlationId,
        action: "authentication.login",
        actor: { type: "user", id: user.id },
        target: { type: "identity", id: user.id },
        outcome: "succeeded",
        delivery: "required",
      });

      if (auditResult.status === "unavailable") {
        session.unset("oidcState");
        session.unset("oidcCodeVerifier");
        session.unset("returnTo");
        session.flash(
          "authError",
          "Sign-in is temporarily unavailable. Please try again.",
        );

        return {
          status: "audit-unavailable" as const,
          location: "/",
          cookies: [await commitSession(session)],
        };
      }

      session.set("user", user);
      session.unset("oidcState");
      session.unset("oidcCodeVerifier");
      session.unset("returnTo");

      return {
        status: "authenticated" as const,
        location: returnTo,
        cookies: [
          await commitSession(session),
          await clearForceReauthenticationCookie(),
        ],
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
  action: "authentication.login" | "authentication.logout";
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
