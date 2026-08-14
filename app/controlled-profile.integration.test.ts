import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestDatabase } from "../test/helpers/database";
import { AuditRecorder } from "../test/support/audit-recorder";
import {
  controlledContentSentinel,
  expectContentFreeMetadata,
  expectContentFreeResponseMetadata,
} from "../test/support/content-boundary";
import {
  authorizeDictionaryAccess,
  authorizeSubmissionAccess,
  withoutSearchParameters,
} from "./features/authentication/server/access";
import {
  commitSession,
  destroySession,
  getSession,
} from "./features/authentication/server/session";
import { createDictionaryReadService } from "./features/dictionary/server/read";
import { createSubmissionWorkflow } from "./features/submission/server/workflow";
import type { AuthUser } from "./features/authentication/model";
import { parseAppConfig } from "./platform/config/runtime.server";
import { createAcronymRepository } from "./platform/database/acronym-repository.server";
import { getAppDatabase } from "./platform/database/lifecycle.server";
import { authenticatedSessions } from "./platform/database/schema";
import { applyDeploymentSecurityHeaders } from "./platform/http/security-headers.server";

describe("integrated controlled-profile guarantees", () => {
  let dictionaryDatabase: ReturnType<typeof createTestDatabase> | undefined;

  afterEach(() => dictionaryDatabase?.remove());

  it.each([
    [
      "missing bounded reauthentication",
      { SESSION_REAUTHENTICATION_INTERVAL_MINUTES: undefined },
      "SESSION_REAUTHENTICATION_INTERVAL_MINUTES is required",
    ],
    [
      "insecure identity transport",
      { OIDC_ALLOW_INSECURE_HTTP: "true" },
      "OIDC_ALLOW_INSECURE_HTTP cannot be true",
    ],
    [
      "missing capability mappings",
      {
        ACRONYMICON_READ_GROUPS: "",
        ACRONYMICON_SUBMIT_GROUPS: "",
      },
      "At least one ACRONYMICON_READ_GROUPS",
    ],
  ])("rejects %s during startup", (_, override, message) => {
    expect(() =>
      parseAppConfig({ ...controlledEnvironment(), ...override }),
    ).toThrow(message);
  });

  it("keeps protected data behind mapped capabilities and content-free metadata", async () => {
    dictionaryDatabase = createTestDatabase();
    const audit = new AuditRecorder();
    const repository = createAcronymRepository(dictionaryDatabase.db);
    const listPublishedEntries = vi.spyOn(
      repository,
      "listPublishedEntries",
    );
    repository.createAcronymEntry({
      acronym: "BOUNDARY",
      definition: controlledContentSentinel,
      submittedByUserId: "seed-user",
      submittedByUsername: "seed-user",
    });
    const harness = createControlledHarness(repository, audit);

    const anonymousResponse = await harness.read(
      new Request(
        `https://app.example.test/?q=${controlledContentSentinel}`,
      ),
    );
    expect(anonymousResponse).toBeInstanceOf(Response);
    if (!(anonymousResponse instanceof Response)) {
      throw new Error("Expected anonymous dictionary access to redirect.");
    }
    applyDeploymentSecurityHeaders(
      anonymousResponse.headers,
      controlledConfig(),
    );
    expect(anonymousResponse).toMatchObject({ status: 302 });
    expect(anonymousResponse.headers.get("Location")).toBe(
      "/auth/login?returnTo=%2F",
    );
    expectProtectedHeaders(anonymousResponse.headers);
    expectContentFreeResponseMetadata(anonymousResponse);
    expect(listPublishedEntries).not.toHaveBeenCalled();

    const unmapped = await authenticatedRequest({
      id: "unmapped-user",
      username: "private-unmapped-name",
      groups: ["private-unmapped-group"],
    });
    const unmappedResponse = await rejectedResponse(
      harness.read(unmapped.request),
    );
    expect(unmappedResponse.status).toBe(403);
    await expect(unmappedResponse.text()).resolves.toBe("");
    expectContentFreeResponseMetadata(unmappedResponse);
    expect(listPublishedEntries).not.toHaveBeenCalled();

    const reader = await authenticatedRequest({
      id: "reader-user",
      username: "reader",
      groups: ["dictionary-readers"],
    });
    const readResult = await harness.read(reader.request);
    expect(readResult).not.toBeInstanceOf(Response);
    if (readResult instanceof Response) {
      throw new Error("Expected mapped reader access.");
    }
    expect(readResult.entries).toEqual([
      expect.objectContaining({ definition: controlledContentSentinel }),
    ]);

    const deniedMutation = new Request("https://app.example.test/submit", {
      method: "POST",
      headers: {
        Cookie: reader.cookie,
        "Content-Type": "text/plain",
      },
      body: controlledContentSentinel,
    });
    const readerSubmissionResponse = await rejectedResponse(
      harness.authorizeSubmission(deniedMutation),
    );
    expect(readerSubmissionResponse.status).toBe(403);
    await expect(readerSubmissionResponse.text()).resolves.toBe("");
    expectContentFreeResponseMetadata(readerSubmissionResponse);
    await expect(deniedMutation.text()).resolves.toBe(
      controlledContentSentinel,
    );

    const submitter = await authenticatedRequest({
      id: "submitter-user",
      username: "submitter",
      groups: ["dictionary-submitters"],
    });
    await expect(harness.read(submitter.request)).resolves.toMatchObject({
      user: { id: "submitter-user" },
    });
    const submission = await harness.submit(submitter.request, {
      acronym: `SAFE-${crypto.randomUUID()}`,
      definition: controlledContentSentinel,
    });
    expect(submission).toMatchObject({ status: "created" });
    const success = audit.attempts.find(
      ({ event }) =>
        event.action === "acronym.submit" && event.outcome === "succeeded",
    );
    expect(success).toMatchObject({
      delivery: "best-effort",
      event: {
        actor: { type: "user", id: "submitter-user" },
        action: "acronym.submit",
        outcome: "succeeded",
        target: { type: "acronym-entry" },
      },
    });
    if (success?.event.target.type !== "acronym-entry") {
      throw new Error("Expected an opaque submitted-entry audit target.");
    }
    expect(success.event.target.id).toEqual(expect.any(String));
    const deniedActors = audit.attempts
      .filter(
        ({ event }) =>
          event.action === "authorization.check" &&
          event.outcome === "denied",
      )
      .map(({ event }) => event.actor);
    expect(deniedActors).toEqual(
      expect.arrayContaining([
        { type: "anonymous" },
        { type: "user", id: "unmapped-user" },
        { type: "user", id: "reader-user" },
      ]),
    );
    expectContentFreeMetadata(audit.attempts);
    expect(JSON.stringify(audit.attempts)).not.toContain("private-unmapped");
  });

  it("denies stale, expired, and logged-out sessions", async () => {
    dictionaryDatabase = createTestDatabase();
    const audit = new AuditRecorder();
    const repository = createAcronymRepository(dictionaryDatabase.db);
    const listPublishedEntries = vi.spyOn(
      repository,
      "listPublishedEntries",
    );
    const harness = createControlledHarness(repository, audit);

    const stale = await authenticatedRequest(
      {
        id: "stale-user",
        username: "stale",
        groups: ["dictionary-readers"],
      },
      controlledNowSeconds - 60 * 60,
      "https://app.example.test/define/opaque-entry",
    );
    const staleDocumentResponse = await harness.read(stale.request);
    expect(staleDocumentResponse).toBeInstanceOf(Response);
    if (!(staleDocumentResponse instanceof Response)) {
      throw new Error("Expected stale document access to redirect.");
    }
    expect(staleDocumentResponse.headers.get("Location")).toBe(
      "/auth/login?returnTo=%2Fdefine%2Fopaque-entry",
    );
    const staleDataResponse = await rejectedResponse(
      harness.read(
        requestWithCookie(
          "https://app.example.test/define/opaque-entry.data",
          stale.cookie,
        ),
      ),
    );
    expect(staleDataResponse.status).toBe(401);
    await expect(staleDataResponse.text()).resolves.toBe("");
    expectContentFreeResponseMetadata(staleDataResponse);

    const expired = await authenticatedRequest({
      id: "expired-user",
      username: "expired",
      groups: ["dictionary-readers"],
    });
    await expireStoredSession("expired-user");
    const expiredResponse = await harness.read(
      requestWithCookie("https://app.example.test/", expired.cookie),
    );
    expect(expiredResponse).toBeInstanceOf(Response);
    expect(expiredResponse).toMatchObject({ status: 302 });

    const loggedOut = await authenticatedRequest({
      id: "logged-out-user",
      username: "logged-out",
      groups: ["dictionary-readers"],
    });
    await destroySession(await getSession(loggedOut.cookie));
    const loggedOutResponse = await harness.read(
      requestWithCookie("https://app.example.test/", loggedOut.cookie),
    );
    expect(loggedOutResponse).toBeInstanceOf(Response);
    expect(loggedOutResponse).toMatchObject({ status: 302 });

    expect(listPublishedEntries).not.toHaveBeenCalled();
    expectContentFreeMetadata(audit.attempts);
  });
});

function createControlledHarness(
  repository: ReturnType<typeof createAcronymRepository>,
  auditPublisher: AuditRecorder,
) {
  const config = controlledConfig();
  let correlationSequence = 0;
  const authorizationDependencies = {
    auditPublisher,
    randomCorrelationId: () =>
      `controlled-correlation-${(correlationSequence += 1)}`,
    nowSeconds: () => controlledNowSeconds,
  };
  const dictionary = createDictionaryReadService(repository);
  const submission = createSubmissionWorkflow(repository, {
    auditPublisher,
    randomCorrelationId: () =>
      `controlled-correlation-${(correlationSequence += 1)}`,
  });

  async function read(request: Request) {
    const user = await authorizeDictionaryAccess(
      withoutSearchParameters(request),
      config,
      authorizationDependencies,
    );

    if (user instanceof Response) {
      return user;
    }

    return {
      user,
      entries: await dictionary.listPublishedAcronyms("", "alphabetical"),
    };
  }

  function authorizeSubmission(request: Request) {
    return authorizeSubmissionAccess(
      withoutSearchParameters(request),
      config,
      authorizationDependencies,
    );
  }

  async function submit(
    request: Request,
    values: { acronym: string; definition: string },
  ) {
    const user = await authorizeSubmission(request);
    if (user instanceof Response) {
      return user;
    }
    return submission.submit(values, user);
  }

  return { authorizeSubmission, read, submit };
}

async function authenticatedRequest(
  user: AuthUser,
  authenticatedAt = controlledNowSeconds,
  url = "https://app.example.test/",
) {
  const session = await getSession();
  session.set("user", user);
  session.set("authenticatedAt", authenticatedAt);
  const cookie = cookiePair(await commitSession(session));

  return {
    cookie,
    request: requestWithCookie(url, cookie),
  };
}

function requestWithCookie(url: string, cookie: string) {
  return new Request(url, { headers: { Cookie: cookie } });
}

async function expireStoredSession(userId: string) {
  const database = getAppDatabase();
  const rows = await database
    .select({ id: authenticatedSessions.id, data: authenticatedSessions.data })
    .from(authenticatedSessions);
  const row = rows.find(
    ({ data }) =>
      (data.user as { id?: unknown } | undefined)?.id === userId,
  );

  if (!row) {
    throw new Error("Expected an isolated authenticated session record.");
  }

  await database
    .update(authenticatedSessions)
    .set({ expiresAt: new Date(0).toISOString() })
    .where(eq(authenticatedSessions.id, row.id));
}

function controlledConfig() {
  return parseAppConfig(controlledEnvironment());
}

function controlledEnvironment(): NodeJS.ProcessEnv {
  return {
    ACRONYMICON_DEPLOYMENT_PROFILE: "controlled",
    ACRONYMICON_PUBLIC_ORIGIN: "https://app.example.test",
    ACRONYMICON_READ_GROUPS: "dictionary-readers",
    ACRONYMICON_SUBMIT_GROUPS: "dictionary-submitters",
    NODE_ENV: "production",
    SESSION_SECRET: "production-session-secret-at-least-32-characters",
    SESSION_ABSOLUTE_TIMEOUT_MINUTES: "480",
    SESSION_INACTIVITY_TIMEOUT_MINUTES: "30",
    SESSION_REAUTHENTICATION_INTERVAL_MINUTES: "60",
    OIDC_ISSUER_URL: "https://issuer.example.test/realms/acronymicon",
    OIDC_CLIENT_ID: "acronymicon",
    OIDC_CLIENT_SECRET: "client-secret",
    OIDC_REDIRECT_URI: "https://app.example.test/auth/callback",
    OIDC_POST_LOGOUT_REDIRECT_URI: "https://app.example.test/",
  };
}

function expectProtectedHeaders(headers: Headers) {
  expect(Object.fromEntries(headers)).toMatchObject({
    "cache-control": "no-store",
    "content-security-policy":
      "base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    "referrer-policy": "no-referrer",
    "strict-transport-security": "max-age=31536000",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });
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

  throw new Error("Expected controlled access to be denied.");
}

function cookiePair(setCookie: string) {
  return setCookie.split(";", 1)[0];
}

const controlledNowSeconds = Math.floor(Date.now() / 1_000);
