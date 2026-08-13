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

  it("does not carry legacy preview query content into the login redirect", async () => {
    const request = new Request(
      "https://app.example.test/submit?acronym=Sensitive&definition=Internal",
    );

    const response = await loader({ request } as never);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(
      "/auth/login?returnTo=%2Fsubmit",
    );
  });
});

describe("submit route duplicate preview", () => {
  it("ignores legacy loader query content", async () => {
    const { cookie, user } = await authenticatedSession();
    const request = new Request(
      "https://app.example.test/submit?acronym=Sensitive&definition=Internal",
      { headers: { Cookie: cookie } },
    );

    await expect(loader({ request } as never)).resolves.toEqual({ user });
  });

  it("previews duplicate feedback by POST without creating an entry", async () => {
    const { cookie } = await authenticatedSession();
    const acronym = `PREVIEW-${crypto.randomUUID()}`;
    const definition = "Preview-only internal definition";

    const firstPreview = await action({
      request: previewRequest({ cookie, acronym, definition }),
    } as never);
    const secondPreview = await action({
      request: previewRequest({ cookie, acronym, definition }),
    } as never);

    expect(firstPreview).toMatchObject({
      status: "preview",
      checkedAcronym: acronym,
      checkedDefinition: definition,
      existingEntries: [],
      exactDuplicate: null,
    });
    expect(secondPreview).toMatchObject({
      status: "preview",
      existingEntries: [],
      exactDuplicate: null,
    });
  });

  it("preserves exact-duplicate feedback after a final submission", async () => {
    const { cookie } = await authenticatedSession();
    const acronym = `EXACT-${crypto.randomUUID()}`;
    const definition = "Exact duplicate definition";
    const submission = new URLSearchParams({
      intent: "submit",
      acronym,
      definition,
    });

    const response = await action({
      request: new Request("https://app.example.test/submit", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: submission,
      }),
    } as never);
    const preview = await action({
      request: previewRequest({ cookie, acronym, definition }),
    } as never);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect(preview).toMatchObject({
      status: "preview",
      exactDuplicate: { definition },
    });
  });
});

describe("submit route completion navigation", () => {
  it("redirects a standard submission to its opaque definition URL", async () => {
    const { cookie } = await authenticatedSession();
    const acronym = `STANDARD-${crypto.randomUUID()}`;

    const response = await action({
      request: submissionRequest({ cookie, acronym }),
    } as never);

    expect(response).toBeInstanceOf(Response);
    const location = (response as Response).headers.get("Location");
    expect(location).toMatch(/^\/define\/[0-9a-f-]+$/);
    expect(location).not.toContain(acronym);
  });

  it("redirects a controlled submission without exposing its acronym", async () => {
    configureControlledProfile();
    const { cookie } = await authenticatedSession(["dictionary-submitters"]);

    const acronym = `CONTROLLED-${crypto.randomUUID()}`;
    const response = await action({
      request: submissionRequest({
        cookie,
        acronym,
      }),
    } as never);

    expect(response).toBeInstanceOf(Response);
    const location = (response as Response).headers.get("Location");
    expect(location).toMatch(/^\/define\/[0-9a-f-]+$/);
    expect(location).not.toContain(acronym);
  });
});

function configureControlledProfile() {
  const environment = {
    ACRONYMICON_DEPLOYMENT_PROFILE: "controlled",
    ACRONYMICON_PUBLIC_ORIGIN: "https://app.example.test",
    ACRONYMICON_READ_GROUPS: "dictionary-readers",
    ACRONYMICON_SUBMIT_GROUPS: "dictionary-submitters",
    NODE_ENV: "production",
    SESSION_SECRET: "production-session-secret-at-least-32-characters",
    SESSION_ABSOLUTE_TIMEOUT_MINUTES: "480",
    SESSION_INACTIVITY_TIMEOUT_MINUTES: "30",
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

async function authenticatedSession(groups: string[] = []) {
  const user = {
    id: crypto.randomUUID(),
    username: "submitter",
    displayName: "Local Submitter",
    groups,
  };
  const session = await getSession();
  session.set("user", user);

  return {
    cookie: await commitSession(session),
    user,
  };
}

function submissionRequest({
  cookie,
  acronym,
}: {
  cookie: string;
  acronym: string;
}) {
  return new Request("https://app.example.test/submit", {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      intent: "submit",
      acronym,
      definition: "A unique submitted definition",
    }),
  });
}

function previewRequest({
  cookie,
  acronym,
  definition,
}: {
  cookie: string;
  acronym: string;
  definition: string;
}) {
  return new Request("https://app.example.test/submit", {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      intent: "preview",
      acronym,
      definition,
    }),
  });
}
