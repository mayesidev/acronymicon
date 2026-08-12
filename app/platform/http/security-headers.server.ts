import type { AppConfig } from "../config/runtime.server";
import { getAppConfig } from "../config/runtime.server";

const controlledDeploymentHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

export function applyDeploymentSecurityHeaders(
  headers: Headers,
  config: AppConfig = getAppConfig(),
) {
  if (config.deployment.profile !== "controlled") {
    return headers;
  }

  for (const [name, value] of Object.entries(controlledDeploymentHeaders)) {
    headers.set(name, value);
  }

  return headers;
}
