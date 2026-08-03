import { redirect } from "react-router";

import type { Route } from "./+types/auth.callback";
import { completeAuthorizationCodeGrant } from "../auth/oidc.server";
import {
  clearForceReauthenticationCookie,
  commitSession,
  getSession,
} from "../auth/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const expectedState = session.get("oidcState");
  const codeVerifier = session.get("oidcCodeVerifier");
  const returnTo = session.get("returnTo") ?? "/";

  if (!expectedState || !codeVerifier) {
    session.flash("authError", "Sign-in session expired. Please try again.");
    return redirect("/", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }

  const user = await completeAuthorizationCodeGrant({
    request,
    expectedState,
    codeVerifier,
  });

  session.set("user", user);
  session.unset("oidcState");
  session.unset("oidcCodeVerifier");
  session.unset("returnTo");

  const headers = new Headers();
  headers.append("Set-Cookie", await commitSession(session));
  headers.append("Set-Cookie", await clearForceReauthenticationCookie());

  return redirect(returnTo, { headers });
}
