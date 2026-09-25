import { data, redirect } from "react-router";

import type { Route } from "./+types/auth.login";
import { SignInUnavailable } from "../features/authentication/components/sign-in-unavailable";
import {
  authenticationWorkflow,
  safeReturnTo,
} from "../features/authentication/server/workflow";
import { AccessNotice } from "../features/deployment-notices/components/access-notice";
import {
  isAccessNoticeFormValid,
  loadAccessNotice,
} from "../features/deployment-notices/server/api";

export function meta() {
  return [{ title: "Sign in | Acronymicon" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const notice = loadAccessNotice();

  if (notice) {
    return {
      ...notice,
      returnTo: safeReturnTo(new URL(request.url).searchParams.get("returnTo")),
    };
  }

  return beginSignIn(request);
}

export async function action({ request }: Route.ActionArgs) {
  if (!(await isAccessNoticeFormValid(request))) {
    const returnTo = safeReturnTo(
      new URL(request.url).searchParams.get("returnTo"),
    );
    return redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return beginSignIn(request);
}

async function beginSignIn(request: Request) {
  const outcome = await authenticationWorkflow.beginSignIn(request);

  if (outcome.status === "not-configured") {
    return data(
      {
        configured: false,
      },
      { status: 503 },
    );
  }

  return redirect(outcome.location, {
    headers: {
      "Set-Cookie": outcome.cookies[0],
    },
  });
}

export default function Login({ loaderData }: Route.ComponentProps) {
  return "text" in loaderData ? (
    <AccessNotice
      notice={loaderData.text}
      token={loaderData.token}
      returnTo={loaderData.returnTo}
    />
  ) : (
    <SignInUnavailable />
  );
}
