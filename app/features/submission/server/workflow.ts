import type {
  SubmissionDuplicateEntry,
  SubmissionDuplicatePreview,
  SubmissionValues,
} from "../model";
import { evaluateDuplicatePolicy, getDefinitionError } from "../policy";
import type { SubmissionRepository, SubmissionSubmitter } from "./repository";

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

export function createSubmissionWorkflow(repository: SubmissionRepository) {
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

    const result = await repository.createAcronymEntry({
      acronym: values.acronym,
      definition: values.definition,
      notes: values.notes,
      submittedByUserId: submitter.id,
      submittedByUsername: submitter.username,
      submittedByDisplayName: submitter.displayName,
    });

    if (result.status === "duplicate") {
      return evaluateDuplicatePolicy(values, {
        exactDuplicate: result.duplicate,
        existingEntries: [],
      });
    }

    return { status: "created", acronym: result.entry.acronym };
  }

  return { loadDuplicatePreview, submit };
}

const emptyDuplicatePreview: SubmissionDuplicatePreview = {
  checkedAcronym: "",
  checkedDefinition: "",
  existingEntries: [],
  exactDuplicate: null,
  definitionError: null,
};
