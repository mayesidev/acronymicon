import type { SubmissionValues } from "../model";

export type SubmissionDuplicateEntry = {
  id: string;
  definition: string;
};

export type SubmissionCreatedEntry = {
  acronym: string;
};

export type SubmissionSubmitter = {
  id: string;
  username: string;
  displayName?: string;
};

export type SubmissionCreateResult =
  | {
      status: "created";
      entry: SubmissionCreatedEntry;
    }
  | {
      status: "duplicate";
      duplicate: SubmissionDuplicateEntry;
    };

export type SubmissionRepository = {
  findExactDuplicate: (
    input: Pick<SubmissionValues, "acronym" | "definition">,
  ) => Promise<SubmissionDuplicateEntry | null>;
  findPublishedByAcronym: (
    acronym: string,
  ) => Promise<SubmissionDuplicateEntry[]>;
  createAcronymEntry: (
    input: Pick<SubmissionValues, "acronym" | "definition" | "notes"> & {
      submittedByUserId: string;
      submittedByUsername: string;
      submittedByDisplayName?: string;
    },
  ) => SubmissionCreateResult | Promise<SubmissionCreateResult>;
};
