import { data, redirect } from "react-router";

import type { Route } from "./+types/auth.login";
import { SignInUnavailable } from "../features/authentication/components/sign-in-unavailable";
import { authenticationWorkflow } from "../features/authentication/server/workflow";

export function meta() {
  return [{ title: "Sign in | Acronymicon" }];
}

export async function loader({ request }: Route.LoaderArgs) {
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

export default function Login() {
  return <SignInUnavailable />;
}
