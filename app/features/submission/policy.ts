import {
  DefinitionMarkupError,
  parseDefinitionMarkup,
  validateDefinitionRanges,
} from "../../domain/acronym";
import type { SubmissionValues } from "./model";

export const exactDuplicateMessage =
  "This acronym and definition already exist.";

type DuplicateEntry = {
  id: string;
  definition: string;
};

export type DuplicatePolicyOutcome<Entry extends DuplicateEntry> =
  | {
      status: "accepted";
    }
  | {
      status: "exact-duplicate";
      duplicate: Entry;
      errors: { definition: [typeof exactDuplicateMessage] };
    }
  | {
      status: "duplicate-warning";
      existingEntries: Entry[];
    };

export function evaluateDuplicatePolicy<Entry extends DuplicateEntry>(
  values: Pick<SubmissionValues, "confirmDuplicate">,
  matches: {
    exactDuplicate: Entry;
    existingEntries: Entry[];
  },
): Extract<DuplicatePolicyOutcome<Entry>, { status: "exact-duplicate" }>;
export function evaluateDuplicatePolicy<Entry extends DuplicateEntry>(
  values: Pick<SubmissionValues, "confirmDuplicate">,
  matches: {
    exactDuplicate: Entry | null;
    existingEntries: Entry[];
  },
): DuplicatePolicyOutcome<Entry>;
export function evaluateDuplicatePolicy<Entry extends DuplicateEntry>(
  values: Pick<SubmissionValues, "confirmDuplicate">,
  matches: {
    exactDuplicate: Entry | null;
    existingEntries: Entry[];
  },
): DuplicatePolicyOutcome<Entry> {
  if (matches.exactDuplicate) {
    return {
      status: "exact-duplicate",
      duplicate: matches.exactDuplicate,
      errors: { definition: [exactDuplicateMessage] },
    };
  }

  if (
    matches.existingEntries.length > 0 &&
    values.confirmDuplicate !== "true"
  ) {
    return {
      status: "duplicate-warning",
      existingEntries: matches.existingEntries,
    };
  }

  return { status: "accepted" };
}

export function getDefinitionError(acronym: string, definition: string) {
  if (!definition.trim()) {
    return null;
  }

  try {
    return validateDefinitionRanges(acronym, parseDefinitionMarkup(definition));
  } catch (error) {
    return error instanceof DefinitionMarkupError
      ? error.message
      : "Definition formatting is invalid.";
  }
}
