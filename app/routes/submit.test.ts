import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../platform/audit/runtime.server", () => ({
  auditPublisher: {
    publish: () => Promise.resolve({ status: "recorded" }),
  },
}));

import {
  commitSession,
  getSession,
} from "../features/authentication/server/session";
import { action, loader } from "./submit";

describe("submit route authorization", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["loader", loader, "GET"],
    ["action", action, "POST"],
  ])(
    "denies a controlled-profile read-only user before %s work",
    async (_, handler, method) => {
      configureControlledProfile();
      const session = await getSession();
      session.set("user", {
        id: "read-only-user",
        username: "reader",
        groups: ["dictionary-readers"],
      });
      const request = new Request("https://app.example.test/submit", {
        method,
        headers: { Cookie: await commitSession(session) },
      });

      const response = await rejectedResponse(handler({ request } as never));

      expect(response.status).toBe(403);
    },
  );
});

function configureControlledProfile() {
  const environment = {
    ACRONYMICON_DEPLOYMENT_PROFILE: "controlled",
    ACRONYMICON_PUBLIC_ORIGIN: "https://app.example.test",
    ACRONYMICON_READ_GROUPS: "dictionary-readers",
    ACRONYMICON_SUBMIT_GROUPS: "dictionary-submitters",
    NODE_ENV: "production",
    SESSION_SECRET: "production-session-secret-at-least-32-characters",
    OIDC_ISSUER_URL: "https://issuer.example.test/realms/acronymicon",
    OIDC_CLIENT_ID: "acronymicon",
    OIDC_CLIENT_SECRET: "client-secret",
    OIDC_REDIRECT_URI: "https://app.example.test/auth/callback",
    OIDC_POST_LOGOUT_REDIRECT_URI: "https://app.example.test/",
  };

  for (const [name, value] of Object.entries(environment)) {
    vi.stubEnv(name, value);
  }
}

async function rejectedResponse(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }

  throw new Error("Expected route access to be denied.");
}
