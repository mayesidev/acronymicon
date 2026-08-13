import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  authorizeDictionaryAccess: vi.fn(),
  lookupDefinition: vi.fn(),
  lookupDefinitionById: vi.fn(),
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
