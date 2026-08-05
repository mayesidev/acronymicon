export type SubmissionValues = {
  acronym: string;
  definition: string;
  notes?: string;
  confirmDuplicate?: "true";
};

export type SubmissionFieldName = "acronym" | "definition" | "notes";

export type SubmissionFieldErrors = Partial<
  Record<SubmissionFieldName | "confirmDuplicate", string[]>
>;
