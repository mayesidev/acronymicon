import { redirect } from "react-router";

import type { AuditPublisher } from "../../../domain/audit";
import { auditPublisher } from "../../../platform/audit/runtime.server";
import {
  getAppConfig,
  type AppConfig,
} from "../../../platform/config/runtime.server";
import type { AuthUser } from "../model";
import {
  getAuthenticatedSession,
  isReauthenticationDue,
} from "./session";
import { safeReturnTo } from "./workflow";

export type Capability = "dictionary:read" | "acronym:submit";

export type AuthorizationDependencies = Readonly<{
  auditPublisher: AuditPublisher;
  randomCorrelationId: () => string;
  nowSeconds: () => number;
}>;

const defaultDependencies: AuthorizationDependencies = {
  auditPublisher,
  randomCorrelationId: () => crypto.randomUUID(),
  nowSeconds: () => Math.floor(Date.now() / 1_000),
};

export async function authorizeDictionaryAccess(
  request: Request,
  config: AppConfig = getAppConfig(),
  dependencies: AuthorizationDependencies = defaultDependencies,
) {
  const authentication = await getAuthenticatedSession(request);
  const user = authentication.user;

  if (
    user &&
    isReauthenticationDue(
      authentication,
      config.session.reauthenticationIntervalMinutes,
      dependencies.nowSeconds(),
    )
  ) {
    return reauthenticationRequiredResponse(request, user, dependencies);
  }

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
  const authentication = await getAuthenticatedSession(request);
  const user = authentication.user;

  if (
    user &&
    isReauthenticationDue(
      authentication,
      config.session.reauthenticationIntervalMinutes,
      dependencies.nowSeconds(),
    )
  ) {
    return reauthenticationRequiredResponse(request, user, dependencies);
  }

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

async function reauthenticationRequiredResponse(
  request: Request,
  user: AuthUser,
  dependencies: AuthorizationDependencies,
) {
  const result = await dependencies.auditPublisher.publish({
    delivery: "required",
    event: {
      correlationId: dependencies.randomCorrelationId(),
      actor: { type: "user", id: user.id },
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

  if (!isDocumentRequest(request)) {
    return denyAccess(
      user,
      new Response(null, { status: 401, statusText: "Unauthorized" }),
    );
  }

  const requestUrl = new URL(request.url);
  const returnTo = safeReturnTo(`${requestUrl.pathname}${requestUrl.search}`);
  return redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
}

function isDocumentRequest(request: Request) {
  return (
    request.method === "GET" &&
    !new URL(request.url).pathname.endsWith(".data")
  );
}

function denyAccess(user: AuthUser | null, response: Response) {
  if (user) {
    // React Router uses thrown Responses to preserve route-level HTTP status.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw response;
  }

  return response;
}
