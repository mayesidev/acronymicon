export type SubmissionValues = {
  acronym: string;
  definition: string;
  notes?: string;
  confirmDuplicate?: "true";
};

export type SubmissionFormValues = Pick<
  SubmissionValues,
  "acronym" | "definition" | "notes"
>;

export type SubmissionFieldName = "acronym" | "definition" | "notes";

export type SubmissionFieldErrors = Partial<
  Record<SubmissionFieldName | "confirmDuplicate", string[]>
>;

export type SubmissionDuplicateEntry = {
  id: string;
  definition: string;
};

export type SubmissionDuplicatePreview = {
  checkedAcronym: string;
  checkedDefinition: string;
  existingEntries: SubmissionDuplicateEntry[];
  exactDuplicate: SubmissionDuplicateEntry | null;
  definitionError: string | null;
};

export type SubmissionPreviewActionData = SubmissionDuplicatePreview & {
  status: "preview";
};

export type SubmissionActionData =
  | {
      status: "error";
      errors: SubmissionFieldErrors;
      exactDuplicate: SubmissionDuplicateEntry | null;
      values: SubmissionFormValues;
    }
  | {
      status: "duplicate-warning";
      existingEntries: SubmissionDuplicateEntry[];
      values: SubmissionFormValues;
    };
