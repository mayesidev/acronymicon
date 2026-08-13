import { redirect } from "react-router";

import {
  getAppConfig,
  type AppConfig,
} from "../../../platform/config/runtime.server";
import type { AuthUser } from "../model";
import { getOptionalUser } from "./session";
import { safeReturnTo } from "./workflow";

export type Capability = "dictionary:read" | "acronym:submit";

export async function authorizeDictionaryAccess(
  request: Request,
  config: AppConfig = getAppConfig(),
) {
  const user = await getOptionalUser(request);

  if (hasCapability(user, "dictionary:read", config)) {
    return user;
  }

  return accessDeniedResponse(request, user);
}

export async function authorizeSubmissionAccess(
  request: Request,
  config: AppConfig = getAppConfig(),
) {
  const user = await getOptionalUser(request);

  if (user && hasCapability(user, "acronym:submit", config)) {
    return user;
  }

  return accessDeniedResponse(request, user);
}

export function hasCapability(
  user: AuthUser | null,
  capability: Capability,
  config: AppConfig = getAppConfig(),
) {
  if (config.deployment.profile !== "controlled") {
    return capability === "dictionary:read"
      ? config.deployment.dictionaryAccess === "open" || user !== null
      : user !== null;
  }

  if (!user) {
    return false;
  }

  const allowedGroups =
    capability === "dictionary:read"
      ? [
          ...config.authorization.readGroups,
          ...config.authorization.submitGroups,
        ]
      : config.authorization.submitGroups;

  return user.groups.some((group) => allowedGroups.includes(group));
}

export function shouldShowSubmissionAction(
  user: AuthUser | null,
  config: AppConfig = getAppConfig(),
) {
  return (
    config.deployment.profile !== "controlled" ||
    hasCapability(user, "acronym:submit", config)
  );
}

function accessDeniedResponse(request: Request, user: AuthUser | null) {
  if (user) {
    // React Router uses thrown Responses to preserve route-level HTTP status.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response(null, { status: 403, statusText: "Forbidden" });
  }

  const requestUrl = new URL(request.url);
  const returnTo = safeReturnTo(`${requestUrl.pathname}${requestUrl.search}`);

  return redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
}
