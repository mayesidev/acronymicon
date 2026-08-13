import type { SubmissionValues } from "../model";
import { createAcronymRepository } from "../../../platform/database/acronym-repository.server";
import { getAppDatabase } from "../../../platform/database/lifecycle.server";
import type { SubmissionSubmitter } from "./repository";
import { createSubmissionWorkflow } from "./workflow";

export function loadDuplicatePreview(input: {
  acronym: string;
  definition: string;
}) {
  return createSubmissionWorkflow(getRepository()).loadDuplicatePreview(input);
}

export function submitAcronym(
  values: SubmissionValues,
  submitter: SubmissionSubmitter,
) {
  return createSubmissionWorkflow(getRepository()).submit(values, submitter);
}

export function getSuccessfulSubmissionLocation(entryId: string) {
  return `/define/${encodeURIComponent(entryId)}`;
}

function getRepository() {
  return createAcronymRepository(getAppDatabase());
}
