import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  authorizeSubmissionAccess: vi.fn(),
  loadDuplicatePreview: vi.fn(),
  submitAcronym: vi.fn(),
  recordControlledDictionaryRead: vi.fn(),
  usesControlledDictionarySearch: vi.fn(),
}));

vi.mock("../features/authentication/server/access", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../features/authentication/server/access")
  >();
  return {
    ...actual,
    authorizeSubmissionAccess: dependencies.authorizeSubmissionAccess,
  };
});

vi.mock("../features/submission/server/api", () => ({
  loadDuplicatePreview: dependencies.loadDuplicatePreview,
  submitAcronym: dependencies.submitAcronym,
  getSuccessfulSubmissionLocation: (id: string) => `/define/${id}`,
}));

vi.mock("../features/dictionary/server/api", () => ({
  usesControlledDictionarySearch: dependencies.usesControlledDictionarySearch,
}));

vi.mock("../features/dictionary/server/read-audit", () => ({
  recordControlledDictionaryRead: dependencies.recordControlledDictionaryRead,
}));

import { action } from "./submit";

const user = {
  id: "submitter-id",
  username: "submitter",
  groups: ["submitters"],
};
const existingEntry = { id: "entry-id", acronym: "API", definition: "Stored text" };

beforeEach(() => {
  dependencies.authorizeSubmissionAccess.mockReset().mockResolvedValue(user);
  dependencies.loadDuplicatePreview.mockReset().mockResolvedValue({
    checkedAcronym: "API",
    checkedDefinition: "Draft text",
    existingEntries: [existingEntry],
    exactDuplicate: null,
  });
  dependencies.submitAcronym.mockReset();
  dependencies.recordControlledDictionaryRead.mockReset().mockResolvedValue(undefined);
  dependencies.usesControlledDictionarySearch.mockReset().mockReturnValue(true);
});

describe("submission duplicate read audit", () => {
  it("audits a controlled preview with existing content", async () => {
    await expect(action({ request: request("preview") } as never)).resolves.toMatchObject({
      status: "preview",
      existingEntries: [existingEntry],
    });
    expect(dependencies.recordControlledDictionaryRead).toHaveBeenCalledExactlyOnceWith(user);
  });

  it("does not audit an empty preview or standard-profile preview", async () => {
    dependencies.loadDuplicatePreview.mockResolvedValueOnce({
      checkedAcronym: "API",
      checkedDefinition: "Draft text",
      existingEntries: [],
      exactDuplicate: null,
    });
    await action({ request: request("preview") } as never);
    dependencies.usesControlledDictionarySearch.mockReturnValue(false);
    await action({ request: request("preview") } as never);
    expect(dependencies.recordControlledDictionaryRead).not.toHaveBeenCalled();
  });

  it.each(["exact-duplicate", "duplicate-warning"] as const)(
    "audits controlled %s feedback with stored content",
    async (status) => {
      dependencies.submitAcronym.mockResolvedValue(
        status === "exact-duplicate"
          ? { status, errors: {}, duplicate: existingEntry }
          : { status, existingEntries: [existingEntry] },
      );

      const response = await action({ request: request("submit") } as never);
      expect(response).toMatchObject({
        init: { status: status === "exact-duplicate" ? 400 : 409 },
      });
      expect(dependencies.recordControlledDictionaryRead).toHaveBeenCalledExactlyOnceWith(user);
    },
  );

  it("blocks duplicate feedback when its audit cannot be written", async () => {
    dependencies.recordControlledDictionaryRead.mockRejectedValue(
      new Response(null, { status: 503 }),
    );

    await expect(action({ request: request("preview") } as never)).rejects.toMatchObject({
      status: 503,
    });
  });
});

function request(intent: string) {
  return new Request("https://app.example.test/submit", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ intent, acronym: "API", definition: "Draft text" }),
  });
}
