import { useEffect } from "react";
import { useFetcher } from "react-router";

import type {
  SubmissionActionData,
  SubmissionFieldName,
  SubmissionPreviewActionData,
} from "./model";
import { exactDuplicateMessage, getDefinitionError } from "./policy";

export function useDuplicatePreview({
  acronym,
  definition,
  actionData,
}: {
  acronym: string;
  definition: string;
  actionData?: SubmissionActionData;
}) {
  const { data: previewData, submit: submitPreview } =
    useFetcher<SubmissionPreviewActionData>();

  useEffect(() => {
    const normalizedAcronym = acronym.trim();
    if (!normalizedAcronym) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void submitPreview(
        {
          intent: "preview",
          acronym: normalizedAcronym,
          definition,
        },
        { method: "post", action: "/submit" },
      );
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [acronym, definition, submitPreview]);

  const localDefinitionError = getDefinitionError(acronym, definition);
  const acronymPreview =
    previewData?.checkedAcronym === acronym.trim() ? previewData : null;
  const currentPreview =
    acronymPreview?.checkedDefinition === definition ? acronymPreview : null;
  const actionWarningMatchesCurrentInput =
    actionData?.status === "duplicate-warning" &&
    actionData.values.acronym === acronym &&
    actionData.values.definition === definition;
  const actionExactDuplicate =
    actionData?.status === "error" &&
    actionData.values.acronym === acronym &&
    actionData.values.definition === definition &&
    getSubmissionFieldError(actionData, "definition") === exactDuplicateMessage
      ? actionData.exactDuplicate
      : null;
  const exactDuplicate =
    actionExactDuplicate ?? currentPreview?.exactDuplicate ?? null;
  const existingEntries = actionWarningMatchesCurrentInput
    ? actionData.existingEntries
    : (acronymPreview?.existingEntries ?? []);
  const definitionError =
    localDefinitionError ?? currentPreview?.definitionError ?? null;
  const showDuplicateWarning = !exactDuplicate && existingEntries.length > 0;

  return {
    definitionError,
    exactDuplicate,
    existingEntries,
    showDuplicateFeedback: Boolean(exactDuplicate) || showDuplicateWarning,
    showDuplicateWarning,
  };
}

export function getSubmissionFieldError(
  actionData: SubmissionActionData | undefined,
  field: SubmissionFieldName,
) {
  return actionData?.status === "error"
    ? actionData.errors[field]?.[0]
    : undefined;
}
