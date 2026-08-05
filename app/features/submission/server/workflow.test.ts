import { describe, expect, it, vi } from "vitest";

import { exactDuplicateMessage } from "../policy";
import type { SubmissionRepository } from "./repository";
import { createSubmissionWorkflow } from "./workflow";

const existingEntry = {
  id: "existing-id",
  definition: "Application Programming Interface",
};

describe("submission duplicate preview", () => {
  it("returns an empty preview without querying for a blank acronym", async () => {
    const repository = createRepository();
    const workflow = createSubmissionWorkflow(repository);

    await expect(
      workflow.loadDuplicatePreview({ acronym: "  ", definition: "ignored" }),
    ).resolves.toEqual({
      checkedAcronym: "",
      checkedDefinition: "",
      existingEntries: [],
      exactDuplicate: null,
      definitionError: null,
    });
    expect(repository.findPublishedByAcronym).not.toHaveBeenCalled();
    expect(repository.findExactDuplicate).not.toHaveBeenCalled();
  });

  it("loads similar entries but skips the exact query for invalid markup", async () => {
    const repository = createRepository({
      findPublishedByAcronym: vi.fn(() => Promise.resolve([existingEntry])),
    });
    const workflow = createSubmissionWorkflow(repository);

    await expect(
      workflow.loadDuplicatePreview({
        acronym: " API ",
        definition: "[Application Programming Interface",
      }),
    ).resolves.toEqual({
      checkedAcronym: "API",
      checkedDefinition: "[Application Programming Interface",
      existingEntries: [existingEntry],
      exactDuplicate: null,
      definitionError: "Definition ranges must be closed.",
    });
    expect(repository.findPublishedByAcronym).toHaveBeenCalledWith("API");
    expect(repository.findExactDuplicate).not.toHaveBeenCalled();
  });

  it("loads exact and similar matches for a valid preview", async () => {
    const repository = createRepository({
      findPublishedByAcronym: vi.fn(() => Promise.resolve([existingEntry])),
      findExactDuplicate: vi.fn(() => Promise.resolve(existingEntry)),
    });
    const workflow = createSubmissionWorkflow(repository);

    await expect(
      workflow.loadDuplicatePreview({
        acronym: "API",
        definition: "Application Programming Interface",
      }),
    ).resolves.toEqual({
      checkedAcronym: "API",
      checkedDefinition: "Application Programming Interface",
      existingEntries: [existingEntry],
      exactDuplicate: existingEntry,
      definitionError: null,
    });
    expect(repository.findExactDuplicate).toHaveBeenCalledWith({
      acronym: "API",
      definition: "Application Programming Interface",
    });
  });

  it("loads similar entries without an exact query for a blank definition", async () => {
    const repository = createRepository({
      findPublishedByAcronym: vi.fn(() => Promise.resolve([existingEntry])),
    });
    const workflow = createSubmissionWorkflow(repository);

    await expect(
      workflow.loadDuplicatePreview({ acronym: "API", definition: "" }),
    ).resolves.toMatchObject({
      existingEntries: [existingEntry],
      exactDuplicate: null,
      definitionError: null,
    });
    expect(repository.findExactDuplicate).not.toHaveBeenCalled();
  });
});

describe("authenticated submission workflow", () => {
  it("rejects an exact duplicate before loading similar entries", async () => {
    const repository = createRepository({
      findExactDuplicate: vi.fn(() => Promise.resolve(existingEntry)),
    });
    const workflow = createSubmissionWorkflow(repository);

    await expect(workflow.submit(submissionValues, submitter)).resolves.toEqual(
      {
        status: "exact-duplicate",
        duplicate: existingEntry,
        errors: { definition: [exactDuplicateMessage] },
      },
    );
    expect(repository.findPublishedByAcronym).not.toHaveBeenCalled();
    expect(repository.createAcronymEntry).not.toHaveBeenCalled();
  });

  it("requires confirmation before creating another meaning", async () => {
    const repository = createRepository({
      findPublishedByAcronym: vi.fn(() => Promise.resolve([existingEntry])),
    });
    const workflow = createSubmissionWorkflow(repository);

    await expect(workflow.submit(submissionValues, submitter)).resolves.toEqual(
      {
        status: "duplicate-warning",
        existingEntries: [existingEntry],
      },
    );
    expect(repository.createAcronymEntry).not.toHaveBeenCalled();
  });

  it("creates a confirmed meaning with submitter attribution", async () => {
    const repository = createRepository({
      findPublishedByAcronym: vi.fn(() => Promise.resolve([existingEntry])),
    });
    const workflow = createSubmissionWorkflow(repository);
    const values = { ...submissionValues, confirmDuplicate: "true" as const };

    await expect(workflow.submit(values, submitter)).resolves.toEqual({
      status: "created",
      acronym: "API",
    });
    expect(repository.createAcronymEntry).toHaveBeenCalledWith({
      acronym: "API",
      definition: "Annual Performance Index",
      notes: "A second meaning",
      submittedByUserId: "user-id",
      submittedByUsername: "user",
      submittedByDisplayName: "Local User",
    });
  });

  it("maps an atomic concurrent duplicate result to an exact duplicate", async () => {
    const repository = createRepository({
      createAcronymEntry: vi.fn<SubmissionRepository["createAcronymEntry"]>(
        () => ({
          status: "duplicate",
          duplicate: existingEntry,
        }),
      ),
    });
    const workflow = createSubmissionWorkflow(repository);

    await expect(workflow.submit(submissionValues, submitter)).resolves.toEqual(
      {
        status: "exact-duplicate",
        duplicate: existingEntry,
        errors: { definition: [exactDuplicateMessage] },
      },
    );
  });
});

const submissionValues = {
  acronym: "API",
  definition: "Annual Performance Index",
  notes: "A second meaning",
};

const submitter = {
  id: "user-id",
  username: "user",
  displayName: "Local User",
};

function createRepository(
  overrides: Partial<SubmissionRepository> = {},
): SubmissionRepository {
  return {
    findExactDuplicate: vi.fn(() => Promise.resolve(null)),
    findPublishedByAcronym: vi.fn(() => Promise.resolve([])),
    createAcronymEntry: vi.fn<SubmissionRepository["createAcronymEntry"]>(
      (input) => ({
        status: "created",
        entry: { acronym: input.acronym },
      }),
    ),
    ...overrides,
  };
}
