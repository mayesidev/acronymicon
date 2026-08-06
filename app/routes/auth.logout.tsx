import { redirect } from "react-router";

import type { Route } from "./+types/auth.logout";
import { SignOutConfirmation } from "../features/authentication/components/sign-out-confirmation";
import { authenticationWorkflow } from "../features/authentication/server/workflow";

export function meta() {
  return [{ title: "Sign out | Acronymicon" }];
}

export async function action({ request }: Route.ActionArgs) {
  const outcome = await authenticationWorkflow.signOut(request);
  const headers = new Headers();
  for (const cookie of outcome.cookies) {
    headers.append("Set-Cookie", cookie);
  }

  return redirect(outcome.location, { headers });
}

export default function Logout() {
  return <SignOutConfirmation />;
}
