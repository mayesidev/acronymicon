import type {
  SubmissionDuplicateEntry,
  SubmissionDuplicatePreview,
  SubmissionValues,
} from "../model";
import type {
  AuditOutcome,
  AuditPublisher,
  AuditTarget,
} from "../../../domain/audit";
import { auditPublisher } from "../../../platform/audit/runtime.server";
import { evaluateDuplicatePolicy, getDefinitionError } from "../policy";
import type {
  SubmissionCreateResult,
  SubmissionRepository,
  SubmissionSubmitter,
} from "./repository";

export type SubmissionOutcome =
  | {
      status: "created";
      acronym: string;
    }
  | {
      status: "exact-duplicate";
      duplicate: SubmissionDuplicateEntry;
      errors: { definition: [string] };
    }
  | {
      status: "duplicate-warning";
      existingEntries: SubmissionDuplicateEntry[];
    };

export type SubmissionDependencies = Readonly<{
  auditPublisher: AuditPublisher;
  randomCorrelationId: () => string;
}>;

const defaultDependencies: SubmissionDependencies = {
  auditPublisher,
  randomCorrelationId: () => crypto.randomUUID(),
};

export function createSubmissionWorkflow(
  repository: SubmissionRepository,
  dependencies: SubmissionDependencies = defaultDependencies,
) {
  async function loadDuplicatePreview(input: {
    acronym: string;
    definition: string;
  }): Promise<SubmissionDuplicatePreview> {
    const acronym = input.acronym.trim();
    const definition = input.definition;

    if (!acronym) {
      return emptyDuplicatePreview;
    }

    const definitionError = getDefinitionError(acronym, definition);
    if (definitionError) {
      return {
        checkedAcronym: acronym,
        checkedDefinition: definition,
        existingEntries: await repository.findPublishedByAcronym(acronym),
        exactDuplicate: null,
        definitionError,
      };
    }

    const [existingEntries, exactDuplicate] = await Promise.all([
      repository.findPublishedByAcronym(acronym),
      definition
        ? repository.findExactDuplicate({ acronym, definition })
        : Promise.resolve(null),
    ]);

    return {
      checkedAcronym: acronym,
      checkedDefinition: definition,
      existingEntries,
      exactDuplicate,
      definitionError: null,
    };
  }

  async function submit(
    values: SubmissionValues,
    submitter: SubmissionSubmitter,
  ): Promise<SubmissionOutcome> {
    const exactDuplicate = await repository.findExactDuplicate(values);
    const exactDuplicateOutcome = evaluateDuplicatePolicy(values, {
      exactDuplicate,
      existingEntries: [],
    });

    if (exactDuplicateOutcome.status === "exact-duplicate") {
      return exactDuplicateOutcome;
    }

    const existingEntries = await repository.findPublishedByAcronym(
      values.acronym,
    );
    const duplicateOutcome = evaluateDuplicatePolicy(values, {
      exactDuplicate: null,
      existingEntries,
    });

    if (duplicateOutcome.status === "duplicate-warning") {
      return duplicateOutcome;
    }

    const correlationId = dependencies.randomCorrelationId();
    let result: SubmissionCreateResult;

    try {
      result = await repository.createAcronymEntry({
        acronym: values.acronym,
        definition: values.definition,
        notes: values.notes,
        submittedByUserId: submitter.id,
        submittedByUsername: submitter.username,
        submittedByDisplayName: submitter.displayName,
      });
    } catch (error) {
      await publishCreationOutcome({
        dependencies,
        correlationId,
        actorId: submitter.id,
        target: { type: "application" },
        outcome: "failed",
      });
      throw error;
    }

    if (result.status === "duplicate") {
      await publishCreationOutcome({
        dependencies,
        correlationId,
        actorId: submitter.id,
        target: { type: "acronym-entry", id: result.duplicate.id },
        outcome: "denied",
      });

      return evaluateDuplicatePolicy(values, {
        exactDuplicate: result.duplicate,
        existingEntries: [],
      });
    }

    await publishCreationOutcome({
      dependencies,
      correlationId,
      actorId: submitter.id,
      target: { type: "acronym-entry", id: result.entry.id },
      outcome: "succeeded",
    });

    return { status: "created", acronym: result.entry.acronym };
  }

  return { loadDuplicatePreview, submit };
}

function publishCreationOutcome({
  dependencies,
  correlationId,
  actorId,
  target,
  outcome,
}: Readonly<{
  dependencies: SubmissionDependencies;
  correlationId: string;
  actorId: string;
  target: AuditTarget;
  outcome: AuditOutcome;
}>) {
  return dependencies.auditPublisher.publish({
    delivery: "best-effort",
    event: {
      correlationId,
      actor: { type: "user", id: actorId },
      source: "http",
      action: "acronym.submit",
      target,
      outcome,
    },
  });
}

const emptyDuplicatePreview: SubmissionDuplicatePreview = {
  checkedAcronym: "",
  checkedDefinition: "",
  existingEntries: [],
  exactDuplicate: null,
  definitionError: null,
};
