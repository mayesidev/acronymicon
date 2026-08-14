import { describe, expect, it, vi } from "vitest";

import { AuditRecorder } from "../test/support/audit-recorder";
import {
  controlledContentSentinel,
  expectContentFreeMetadata,
  expectContentFreeResponseMetadata,
} from "../test/support/content-boundary";
import {
  authorizeDictionaryAccess,
  withoutSearchParameters,
} from "./features/authentication/server/access";
import { validateSubmissionInput } from "./features/submission/server/input";
import type { SubmissionRepository } from "./features/submission/server/repository";
import { createSubmissionWorkflow } from "./features/submission/server/workflow";
import { parseAppConfig } from "./platform/config/runtime.server";
import { getErrorPresentation } from "./platform/http/error-presentation";
import { applyDeploymentSecurityHeaders } from "./platform/http/security-headers.server";

const correlationId = "independent-correlation-id";

describe("controlled dictionary content boundary", () => {
  it("keeps document authorization redirects, headers, and audit metadata content-free", async () => {
    const audit = new AuditRecorder();
    const request = withoutSearchParameters(
      new Request(
        `https://app.example.test/?q=${controlledContentSentinel}`,
      ),
    );
    const response = await authorizeDictionaryAccess(
      request,
      controlledConfig(),
      authorizationDependencies(audit),
    );

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("Expected anonymous access to redirect.");
    }

    applyDeploymentSecurityHeaders(response.headers, controlledConfig());
    expect(response.headers.get("Location")).toBe(
      "/auth/login?returnTo=%2F",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expectContentFreeResponseMetadata(response);
    expectContentFreeMetadata(audit.attempts);
    expect(audit.attempts[0]?.event.correlationId).toBe(correlationId);
  });

  it("keeps fetcher authorization metadata content-free without reading the body", async () => {
    const audit = new AuditRecorder();
    const request = new Request("https://app.example.test/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ q: controlledContentSentinel }),
    });
    const response = await authorizeDictionaryAccess(
      request,
      controlledConfig(),
      authorizationDependencies(audit),
    );

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("Expected anonymous fetcher access to redirect.");
    }

    expectContentFreeResponseMetadata(response);
    expectContentFreeMetadata(audit.attempts);
    await expect(request.text()).resolves.toContain(controlledContentSentinel);
  });

  it("keeps validation messages content-free while preserving editable values", () => {
    const result = validateSubmissionInput({
      acronym: controlledContentSentinel,
      definition: "",
    });

    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") {
      throw new Error("Expected invalid input.");
    }

    expectContentFreeMetadata(result.errors);
    expect(result.values.acronym).toBe(controlledContentSentinel);
  });

  it("keeps duplicate denial and repository-failure audit records content-free", async () => {
    const duplicateAudit = new AuditRecorder();
    const duplicateWorkflow = createSubmissionWorkflow(
      repository({
        findExactDuplicate: vi.fn(() =>
          Promise.resolve({
            id: "opaque-duplicate-id",
            definition: controlledContentSentinel,
          }),
        ),
      }),
      submissionDependencies(duplicateAudit),
    );

    const duplicate = await duplicateWorkflow.submit(
      submissionValues(),
      submitter,
    );
    expect(duplicate.status).toBe("exact-duplicate");
    expect(duplicateAudit.attempts).toEqual([]);

    const failureAudit = new AuditRecorder();
    const failure = new Error(controlledContentSentinel);
    const failureWorkflow = createSubmissionWorkflow(
      repository({
        createAcronymEntry: vi
          .fn<SubmissionRepository["createAcronymEntry"]>()
          .mockRejectedValue(failure),
      }),
      submissionDependencies(failureAudit),
    );

    await expect(
      failureWorkflow.submit(submissionValues(), submitter),
    ).rejects.toBe(failure);
    expectContentFreeMetadata(failureAudit.attempts);
    expect(failureAudit.attempts[0]?.event).toMatchObject({
      correlationId,
      outcome: "failed",
      target: { type: "application" },
    });
  });

  it("keeps not-found and unexpected production error output generic", () => {
    expectContentFreeMetadata(
      getErrorPresentation(new Error(controlledContentSentinel), false),
    );
    expectContentFreeMetadata(
      getErrorPresentation(
        {
          status: 404,
          statusText: controlledContentSentinel,
          internal: true,
          data: null,
        },
        false,
      ),
    );
    expectContentFreeMetadata(
      getErrorPresentation(
        {
          status: 500,
          statusText: controlledContentSentinel,
          internal: true,
          data: null,
        },
        false,
      ),
    );
  });
});

function authorizationDependencies(auditPublisher: AuditRecorder) {
  return {
    auditPublisher,
    randomCorrelationId: () => correlationId,
    nowSeconds: () => 0,
  };
}

function submissionDependencies(auditPublisher: AuditRecorder) {
  return {
    auditPublisher,
    randomCorrelationId: () => correlationId,
  };
}

function submissionValues() {
  return {
    acronym: controlledContentSentinel,
    definition: controlledContentSentinel,
  };
}

const submitter = {
  id: "user-id",
  username: "submitter",
};

function repository(
  overrides: Partial<SubmissionRepository> = {},
): SubmissionRepository {
  return {
    findExactDuplicate: vi.fn(() => Promise.resolve(null)),
    findPublishedByAcronym: vi.fn(() => Promise.resolve([])),
    createAcronymEntry: vi.fn<SubmissionRepository["createAcronymEntry"]>(
      () => ({
        status: "created",
        entry: { id: "opaque-entry-id", acronym: controlledContentSentinel },
      }),
    ),
    ...overrides,
  };
}

function controlledConfig() {
  return parseAppConfig({
    ACRONYMICON_DEPLOYMENT_PROFILE: "controlled",
    ACRONYMICON_PUBLIC_ORIGIN: "https://app.example.test",
    ACRONYMICON_READ_GROUPS: "dictionary-readers",
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
  });
}
