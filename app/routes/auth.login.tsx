import { data, redirect } from "react-router";

import type { Route } from "./+types/auth.login";
import {
  buildAuthorizationUrl,
  isOidcConfigured,
  randomOidcCodeVerifier,
  randomOidcState,
} from "../auth/oidc.server";
import {
  commitSession,
  getSession,
  hasForceReauthentication,
} from "../auth/session.server";

export function meta() {
  return [{ title: "Sign in | Acronymicon" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!isOidcConfigured()) {
    return data(
      {
        configured: false,
      },
      { status: 503 },
    );
  }

  const session = await getSession(request.headers.get("Cookie"));
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const state = randomOidcState();
  const codeVerifier = randomOidcCodeVerifier();
  const forceReauthentication = await hasForceReauthentication(request);
  const redirectTo = await buildAuthorizationUrl({
    request,
    state,
    codeVerifier,
    forceReauthentication,
  });

  session.set("oidcState", state);
  session.set("oidcCodeVerifier", codeVerifier);
  session.set("returnTo", returnTo);

  return redirect(redirectTo.href, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export default function Login({ loaderData }: Route.ComponentProps) {
  if (loaderData.configured) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-xl rounded border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold tracking-normal">
          Sign-in is not configured
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Browsing is available, but acronym submission requires OIDC
          configuration. Set the OIDC environment variables before using
          sign-in.
        </p>
        <a
          href="/"
          className="text-link mt-5 inline-block text-sm"
        >
          Return to dictionary
        </a>
      </section>
    </main>
  );
}

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
