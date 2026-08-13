import { describe, expect, it, vi } from "vitest";

import {
  AuditRecorder,
  expectAuditAttempts,
} from "../../../../test/support/audit-recorder";
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
    const audit = new AuditRecorder();
    const repository = createRepository({
      findExactDuplicate: vi.fn(() => Promise.resolve(existingEntry)),
    });
    const workflow = createSubmissionWorkflow(
      repository,
      submissionDependencies(audit),
    );

    await expect(workflow.submit(submissionValues, submitter)).resolves.toEqual(
      {
        status: "exact-duplicate",
        duplicate: existingEntry,
        errors: { definition: [exactDuplicateMessage] },
      },
    );
    expect(repository.findPublishedByAcronym).not.toHaveBeenCalled();
    expect(repository.createAcronymEntry).not.toHaveBeenCalled();
    expect(audit.attempts).toEqual([]);
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
    const audit = new AuditRecorder({ available: false });
    const repository = createRepository({
      findPublishedByAcronym: vi.fn(() => Promise.resolve([existingEntry])),
    });
    const workflow = createSubmissionWorkflow(
      repository,
      submissionDependencies(audit),
    );
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
    expectCreationAttempt(audit, {
      target: { type: "acronym-entry", id: "created-id" },
      outcome: "succeeded",
    });
    expect(JSON.stringify(audit.attempts)).not.toContain("API");
    expect(JSON.stringify(audit.attempts)).not.toContain("Annual");
    expect(JSON.stringify(audit.attempts)).not.toContain("Local User");
  });

  it("maps an atomic concurrent duplicate result to an exact duplicate", async () => {
    const audit = new AuditRecorder();
    const repository = createRepository({
      createAcronymEntry: vi.fn<SubmissionRepository["createAcronymEntry"]>(
        () => ({
          status: "duplicate",
          duplicate: existingEntry,
        }),
      ),
    });
    const workflow = createSubmissionWorkflow(
      repository,
      submissionDependencies(audit),
    );

    await expect(workflow.submit(submissionValues, submitter)).resolves.toEqual(
      {
        status: "exact-duplicate",
        duplicate: existingEntry,
        errors: { definition: [exactDuplicateMessage] },
      },
    );
    expectCreationAttempt(audit, {
      target: { type: "acronym-entry", id: "existing-id" },
      outcome: "denied",
    });
  });

  it("records repository failure without copying the exception", async () => {
    const audit = new AuditRecorder();
    const repositoryError = new Error("database exposed a secret");
    const repository = createRepository({
      createAcronymEntry: vi
        .fn<SubmissionRepository["createAcronymEntry"]>()
        .mockRejectedValue(repositoryError),
    });
    const workflow = createSubmissionWorkflow(
      repository,
      submissionDependencies(audit),
    );

    await expect(workflow.submit(submissionValues, submitter)).rejects.toBe(
      repositoryError,
    );
    expectCreationAttempt(audit, {
      target: { type: "application" },
      outcome: "failed",
    });
    expect(JSON.stringify(audit.attempts)).not.toContain("secret");
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
        entry: { id: "created-id", acronym: input.acronym },
      }),
    ),
    ...overrides,
  };
}

function submissionDependencies(auditPublisher: AuditRecorder) {
  return {
    auditPublisher,
    randomCorrelationId: () => "correlation-123",
  };
}

function expectCreationAttempt(
  audit: AuditRecorder,
  expected: {
    target: { type: "application" } | { type: "acronym-entry"; id: string };
    outcome: "succeeded" | "denied" | "failed";
  },
) {
  expectAuditAttempts(audit, [
    {
      delivery: "best-effort",
      event: {
        correlationId: "correlation-123",
        actor: { type: "user", id: "user-id" },
        source: "http",
        action: "acronym.submit",
        target: expected.target,
        outcome: expected.outcome,
      },
    },
  ]);
}
