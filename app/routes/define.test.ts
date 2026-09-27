import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  controlledContentSentinel,
  expectContentFreeMetadata,
} from "../../test/support/content-boundary";

const dependencies = vi.hoisted(() => ({
  authorizeDictionaryAccess: vi.fn(),
  lookupDefinition: vi.fn(),
  lookupDefinitionById: vi.fn(),
  recordControlledDictionaryRead: vi.fn(),
  usesControlledDictionarySearch: vi.fn(),
}));

vi.mock("../features/authentication/server/access", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../features/authentication/server/access")
  >();
  return {
    ...actual,
    authorizeDictionaryAccess: dependencies.authorizeDictionaryAccess,
  };
});

vi.mock("../features/dictionary/server/api", () => ({
  lookupDefinition: dependencies.lookupDefinition,
  lookupDefinitionById: dependencies.lookupDefinitionById,
  usesControlledDictionarySearch:
    dependencies.usesControlledDictionarySearch,
}));

vi.mock("../features/dictionary/server/read-audit", () => ({
  recordControlledDictionaryRead: dependencies.recordControlledDictionaryRead,
}));

import { loader } from "./define";

const entry = {
  id: "opaque-entry-id",
  acronym: "API",
  variant: 1,
  definition: "Application Programming Interface",
  definitionRanges: [],
  notes: null,
  aliases: [],
  submittedByUsername: null,
  submittedByDisplayName: null,
  createdAt: "2026-08-13T00:00:00.000Z",
};

beforeEach(() => {
  dependencies.authorizeDictionaryAccess.mockReset().mockResolvedValue(null);
  dependencies.lookupDefinition.mockReset();
  dependencies.lookupDefinitionById.mockReset();
  dependencies.recordControlledDictionaryRead.mockReset().mockResolvedValue(undefined);
  dependencies.usesControlledDictionarySearch.mockReset().mockReturnValue(false);
});

describe("definition route identifiers", () => {
  it("preserves opaque controlled state through authorization", async () => {
    dependencies.usesControlledDictionarySearch.mockReturnValue(true);
    dependencies.lookupDefinitionById.mockResolvedValue({
      status: "list",
      acronym: "API",
      entries: [entry],
    });
    const request = new Request(
      "https://app.example.test/define/opaque-entry-id?view=all&sort=recent",
    );

    await expect(
      loader({ request, params: { entryId: "opaque-entry-id" } } as never),
    ).resolves.toMatchObject({ status: "list", sort: "recent" });
    expect(dependencies.authorizeDictionaryAccess).toHaveBeenCalledWith(
      request,
    );
    expect(dependencies.lookupDefinitionById).toHaveBeenCalledWith({
      entryId: "opaque-entry-id",
      related: true,
      sort: "recent",
    });
    expect(dependencies.recordControlledDictionaryRead).toHaveBeenCalledOnce();
  });

  it("does not audit a controlled definition miss", async () => {
    dependencies.usesControlledDictionarySearch.mockReturnValue(true);
    dependencies.lookupDefinitionById.mockResolvedValue({
      status: "not-found",
      entryId: "unknown",
    });

    await expect(
      loader({
        request: new Request("https://app.example.test/define/unknown"),
        params: { entryId: "unknown" },
      } as never),
    ).resolves.toMatchObject({ status: "not-found" });
    expect(dependencies.recordControlledDictionaryRead).not.toHaveBeenCalled();
  });

  it("blocks a controlled definition when its read audit fails", async () => {
    dependencies.usesControlledDictionarySearch.mockReturnValue(true);
    dependencies.lookupDefinitionById.mockResolvedValue({
      status: "entry",
      acronym: "API",
      entry,
    });
    dependencies.recordControlledDictionaryRead.mockRejectedValue(
      new Response(null, { status: 503 }),
    );

    await expect(
      loader({
        request: new Request("https://app.example.test/define/opaque-entry-id"),
        params: { entryId: "opaque-entry-id" },
      } as never),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("canonicalizes controlled legacy content before authorization", async () => {
    dependencies.usesControlledDictionarySearch.mockReturnValue(true);
    const request = new Request(
      "https://app.example.test/define?acr=Sensitive&var=1",
    );

    const response = await loader({ request, params: {} } as never);
    const authorizationRequest = dependencies.authorizeDictionaryAccess.mock
      .calls[0]?.[0] as Request;

    expect(authorizationRequest.url).toBe("https://app.example.test/define");
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe("/");
    expect(dependencies.lookupDefinition).not.toHaveBeenCalled();
    expect(dependencies.lookupDefinitionById).not.toHaveBeenCalled();
    expect(dependencies.recordControlledDictionaryRead).not.toHaveBeenCalled();
  });

  it("strips unrecognized controlled query text before authorization", async () => {
    dependencies.usesControlledDictionarySearch.mockReturnValue(true);
    const denied = new Response(null, { status: 302 });
    dependencies.authorizeDictionaryAccess.mockResolvedValue(denied);
    const request = new Request(
      `https://app.example.test/define/opaque-entry-id?view=all&sort=recent&context=${controlledContentSentinel}`,
    );

    const response = await loader({
      request,
      params: { entryId: "opaque-entry-id" },
    } as never);

    const authorizationRequest = dependencies.authorizeDictionaryAccess.mock
      .calls[0]?.[0] as Request;
    expect(authorizationRequest.url).toBe(
      "https://app.example.test/define/opaque-entry-id?view=all&sort=recent",
    );
    expectContentFreeMetadata(authorizationRequest.url);
    expect(response).toBe(denied);
    expect(dependencies.lookupDefinitionById).not.toHaveBeenCalled();
  });

  it.each([
    `view=${controlledContentSentinel}`,
    `sort=${controlledContentSentinel}`,
    `view=all&view=${controlledContentSentinel}`,
  ])("strips untrusted controlled option values from %s", async (query) => {
    dependencies.usesControlledDictionarySearch.mockReturnValue(true);
    const request = new Request(
      `https://app.example.test/define/opaque-entry-id?${query}`,
    );

    const response = await loader({
      request,
      params: { entryId: "opaque-entry-id" },
    } as never);
    const authorizationRequest = dependencies.authorizeDictionaryAccess.mock
      .calls[0]?.[0] as Request;

    expectContentFreeMetadata(authorizationRequest.url);
    expectContentFreeMetadata((response as Response).headers.get("Location"));
    expect(dependencies.lookupDefinitionById).not.toHaveBeenCalled();
  });

  it("redirects authorized controlled requests to a canonical query", async () => {
    dependencies.usesControlledDictionarySearch.mockReturnValue(true);
    const request = new Request(
      `https://app.example.test/define/opaque-entry-id?view=all&sort=recent&context=${controlledContentSentinel}`,
    );

    const response = await loader({
      request,
      params: { entryId: "opaque-entry-id" },
    } as never);
    const authorizationRequest = dependencies.authorizeDictionaryAccess.mock
      .calls[0]?.[0] as Request;

    expect(authorizationRequest.url).toBe(
      "https://app.example.test/define/opaque-entry-id?view=all&sort=recent",
    );
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(
      "/define/opaque-entry-id?view=all&sort=recent",
    );
    expect(dependencies.lookupDefinitionById).not.toHaveBeenCalled();
  });

  it("redirects a resolved standard legacy entry to its opaque URL", async () => {
    dependencies.lookupDefinition.mockResolvedValue({
      status: "entry",
      acronym: "API",
      entry,
    });
    const request = new Request(
      "https://app.example.test/define?acr=API&var=1",
    );

    const response = await loader({ request, params: {} } as never);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(
      "/define/opaque-entry-id",
    );
  });

  it("redirects a resolved standard legacy list without its acronym", async () => {
    dependencies.lookupDefinition.mockResolvedValue({
      status: "list",
      acronym: "API",
      entries: [entry],
    });
    const request = new Request(
      "https://app.example.test/define?acr=API&sort=recent",
    );

    const response = await loader({ request, params: {} } as never);

    expect((response as Response).headers.get("Location")).toBe(
      "/define/opaque-entry-id?view=all&sort=recent",
    );
    expect((response as Response).headers.get("Location")).not.toContain(
      "API",
    );
  });
});
