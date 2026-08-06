import {
  buildAuthorizationUrl,
  buildOidcLogoutUrl,
  completeAuthorizationCodeGrant,
  isOidcConfigured,
  randomOidcCodeVerifier,
  randomOidcState,
} from "./oidc";
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
};

const defaultDependencies: AuthenticationDependencies = {
  isOidcConfigured,
  randomOidcState,
  randomOidcCodeVerifier,
  hasForceReauthentication,
  buildAuthorizationUrl,
  completeAuthorizationCodeGrant,
  buildOidcLogoutUrl,
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
      const session = await getSession(request.headers.get("Cookie"));
      const expectedState = session.get("oidcState");
      const codeVerifier = session.get("oidcCodeVerifier");
      const returnTo = session.get("returnTo") ?? "/";

      if (!expectedState || !codeVerifier) {
        session.flash(
          "authError",
          "Sign-in session expired. Please try again.",
        );

        return {
          location: "/",
          cookies: [await commitSession(session)],
        };
      }

      const user = await dependencies.completeAuthorizationCodeGrant({
        request,
        expectedState,
        codeVerifier,
      });

      session.set("user", user);
      session.unset("oidcState");
      session.unset("oidcCodeVerifier");
      session.unset("returnTo");

      return {
        location: returnTo,
        cookies: [
          await commitSession(session),
          await clearForceReauthenticationCookie(),
        ],
      };
    },

    async signOut(request: Request) {
      const session = await getSession(request.headers.get("Cookie"));
      const providerLogoutUrl =
        await dependencies.buildOidcLogoutUrl({ request });

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

export const authenticationWorkflow = createAuthenticationWorkflow();

export function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
