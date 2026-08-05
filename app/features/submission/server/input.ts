import { z } from "zod";

import type {
  SubmissionFieldErrors,
  SubmissionFormValues,
  SubmissionValues,
} from "../model";
import { getDefinitionError } from "../policy";

const submissionSchema: z.ZodType<SubmissionValues> = z.object({
  acronym: z.string().trim().min(1, "Acronym is required."),
  definition: z.string().trim().min(1, "Definition is required."),
  notes: z.string().trim().optional(),
  confirmDuplicate: z.literal("true").optional(),
});

export type SubmissionValidationResult =
  | {
      status: "invalid";
      errors: SubmissionFieldErrors;
      values: SubmissionFormValues;
    }
  | {
      status: "valid";
      values: SubmissionValues;
    };

export function validateSubmissionInput(
  input: Record<string, unknown>,
): SubmissionValidationResult {
  const parsed = submissionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "invalid",
      errors: parsed.error.flatten().fieldErrors,
      values: getSubmissionValues(input),
    };
  }

  const definitionError = getDefinitionError(
    parsed.data.acronym,
    parsed.data.definition,
  );

  if (definitionError) {
    return {
      status: "invalid",
      errors: { definition: [definitionError] },
      values: parsed.data,
    };
  }

  return { status: "valid", values: parsed.data };
}

function getSubmissionValues(input: Record<string, unknown>) {
  return {
    acronym: getInputString(input, "acronym"),
    definition: getInputString(input, "definition"),
    notes: getInputString(input, "notes"),
  };
}

function getInputString(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return typeof value === "string" ? value : "";
}
