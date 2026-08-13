import { redirect } from "react-router";

import type { AuditPublisher } from "../../../domain/audit";
import { auditPublisher } from "../../../platform/audit/runtime.server";
import {
  getAppConfig,
  type AppConfig,
} from "../../../platform/config/runtime.server";
import type { AuthUser } from "../model";
import { getOptionalUser } from "./session";
import { safeReturnTo } from "./workflow";

export type Capability = "dictionary:read" | "acronym:submit";

export type AuthorizationDependencies = Readonly<{
  auditPublisher: AuditPublisher;
  randomCorrelationId: () => string;
}>;

const defaultDependencies: AuthorizationDependencies = {
  auditPublisher,
  randomCorrelationId: () => crypto.randomUUID(),
};

export async function authorizeDictionaryAccess(
  request: Request,
  config: AppConfig = getAppConfig(),
  dependencies: AuthorizationDependencies = defaultDependencies,
) {
  const user = await getOptionalUser(request);

  if (hasCapability(user, "dictionary:read", config)) {
    return user;
  }

  return accessDeniedResponse(request, user, dependencies);
}

export async function authorizeSubmissionAccess(
  request: Request,
  config: AppConfig = getAppConfig(),
  dependencies: AuthorizationDependencies = defaultDependencies,
) {
  const user = await getOptionalUser(request);

  if (user && hasCapability(user, "acronym:submit", config)) {
    return user;
  }

  return accessDeniedResponse(request, user, dependencies);
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

export function withoutSearchParameters(request: Request) {
  const url = new URL(request.url);

  if (!url.search) {
    return request;
  }

  url.search = "";
  return new Request(url, {
    method: request.method,
    headers: request.headers,
  });
}

async function accessDeniedResponse(
  request: Request,
  user: AuthUser | null,
  dependencies: AuthorizationDependencies,
) {
  const result = await dependencies.auditPublisher.publish({
    delivery: "required",
    event: {
      correlationId: dependencies.randomCorrelationId(),
      actor: user ? { type: "user", id: user.id } : { type: "anonymous" },
      source: "http",
      action: "authorization.check",
      target: { type: "application" },
      outcome: "denied",
    },
  });

  if (result.status === "unavailable") {
    return denyAccess(
      user,
      new Response(null, {
        status: 503,
        statusText: "Service Unavailable",
      }),
    );
  }

  if (user) {
    return denyAccess(
      user,
      new Response(null, { status: 403, statusText: "Forbidden" }),
    );
  }

  const requestUrl = new URL(request.url);
  const returnTo = safeReturnTo(`${requestUrl.pathname}${requestUrl.search}`);

  return redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
}

function denyAccess(user: AuthUser | null, response: Response) {
  if (user) {
    // React Router uses thrown Responses to preserve route-level HTTP status.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw response;
  }

  return response;
}
