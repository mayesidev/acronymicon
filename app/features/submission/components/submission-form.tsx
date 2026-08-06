import { useState } from "react";
import { Form } from "react-router";

import { Button } from "../../../ui/components/button";
import { ActionLink } from "../../../ui/components/link";
import type { SubmissionActionData } from "../model";
import { exactDuplicateMessage } from "../policy";
import {
  getSubmissionFieldError,
  useDuplicatePreview,
} from "../use-duplicate-preview";
import { DuplicateFeedback } from "./duplicate-feedback";

export function SubmissionForm({
  actionData,
}: {
  actionData?: SubmissionActionData;
}) {
  const values = actionData?.values;
  const [acronym, setAcronym] = useState(values?.acronym ?? "");
  const [definition, setDefinition] = useState(values?.definition ?? "");
  const {
    definitionError,
    exactDuplicate,
    existingEntries,
    showDuplicateFeedback,
    showDuplicateWarning,
  } = useDuplicatePreview({ acronym, definition, actionData });
  const definitionFieldError = getSubmissionFieldError(
    actionData,
    "definition",
  );

  return (
    <>
      {showDuplicateFeedback ? (
        <DuplicateFeedback
          acronym={acronym}
          exactDuplicate={exactDuplicate}
          existingEntries={existingEntries}
        />
      ) : null}

      <Form
        method="post"
        className="rounded border border-slate-200 bg-white p-5"
      >
        {showDuplicateWarning ? (
          <input type="hidden" name="confirmDuplicate" value="true" />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Acronym"
            error={getSubmissionFieldError(actionData, "acronym")}
          >
            <input
              name="acronym"
              value={acronym}
              onChange={(event) => setAcronym(event.target.value)}
              className="form-input"
              autoComplete="off"
            />
          </Field>

          <Field
            label="Definition"
            error={
              (definitionFieldError === exactDuplicateMessage
                ? undefined
                : definitionFieldError) ??
              definitionError ??
              undefined
            }
          >
            <input
              name="definition"
              value={definition}
              onChange={(event) => setDefinition(event.target.value)}
              className="form-input"
              autoComplete="off"
            />
          </Field>
        </div>

        <Field
          label="Notes"
          error={getSubmissionFieldError(actionData, "notes")}
        >
          <textarea
            name="notes"
            defaultValue={values?.notes}
            className="form-input min-h-28 resize-y"
          />
        </Field>

        <div className="mt-5 flex items-center gap-3">
          <Button
            type="submit"
            disabled={Boolean(
              exactDuplicate ||
              definitionError ||
              !acronym.trim() ||
              !definition.trim(),
            )}
          >
            {showDuplicateWarning ? "Submit Anyway" : "Submit"}
          </Button>
          <ActionLink href="/" variant="secondary">
            Cancel
          </ActionLink>
        </div>
      </Form>
    </>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-4 block text-sm font-medium text-slate-700">
      <span>{label}</span>
      <div className="mt-1">{children}</div>
      {error ? <p className="mt-1 text-sm text-red-700">{error}</p> : null}
    </label>
  );
}
