import { useState } from "react";
import { Form } from "react-router";

import { Button } from "../../../ui/components/button";
import { Card } from "../../../ui/components/card";
import { Field } from "../../../ui/components/field";
import { Input } from "../../../ui/components/input";
import { ActionLink } from "../../../ui/components/link";
import { Textarea } from "../../../ui/components/textarea";
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
    <Card>
      <Form method="post" aria-label="New dictionary entry" className="p-5">
        <input type="hidden" name="intent" value="submit" />
        {showDuplicateWarning ? (
          <input type="hidden" name="confirmDuplicate" value="true" />
        ) : null}

        <Field
          label={<FieldLabel requirement="required">Acronym</FieldLabel>}
          error={getSubmissionFieldError(actionData, "acronym")}
          className="mt-4"
        >
          <Input
            name="acronym"
            value={acronym}
            onChange={(event) => setAcronym(event.target.value)}
            autoComplete="off"
            required
          />
        </Field>

        <Field
          label={<FieldLabel requirement="required">Definition</FieldLabel>}
          error={
            (definitionFieldError === exactDuplicateMessage
              ? undefined
              : definitionFieldError) ??
            definitionError ??
            undefined
          }
          className="mt-4"
        >
          <Input
            name="definition"
            value={definition}
            onChange={(event) => setDefinition(event.target.value)}
            autoComplete="off"
            required
          />
        </Field>

        <Field
          label={<FieldLabel requirement="optional">Notes</FieldLabel>}
          error={getSubmissionFieldError(actionData, "notes")}
          className="mt-4"
        >
          <Textarea
            name="notes"
            defaultValue={values?.notes}
            className="min-h-20"
          />
        </Field>

        <div className="mt-5 flex flex-wrap items-center gap-3">
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
          {showDuplicateFeedback ? (
            <DuplicateFeedback
              acronym={acronym}
              exactDuplicate={exactDuplicate}
              existingEntries={existingEntries}
            />
          ) : null}
          <ActionLink href="/" variant="secondary">
            Cancel
          </ActionLink>
        </div>
      </Form>
    </Card>
  );
}

function FieldLabel({
  children,
  requirement,
}: {
  children: React.ReactNode;
  requirement: "required" | "optional";
}) {
  return (
    <>
      {children}{" "}
      <span aria-hidden="true" className="font-normal text-muted-foreground">
        ({requirement})
      </span>
    </>
  );
}
