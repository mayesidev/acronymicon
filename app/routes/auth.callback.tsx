import { redirect } from "react-router";

import type { Route } from "./+types/auth.callback";
import { authenticationWorkflow } from "../features/authentication/server/workflow";

export async function loader({ request }: Route.LoaderArgs) {
  const outcome = await authenticationWorkflow.completeSignIn(request);
  const headers = new Headers();
  for (const cookie of outcome.cookies) {
    headers.append("Set-Cookie", cookie);
  }

  return redirect(outcome.location, { headers });
}
