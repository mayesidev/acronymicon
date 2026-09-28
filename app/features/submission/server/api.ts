import type { SubmissionValues } from "../model";
import { auditPublisher } from "../../../platform/audit/runtime.server";
import { createAcronymRepository } from "../../../platform/database/acronym-repository.server";
import {
  getAppAuditOutbox,
  getAppDatabase,
} from "../../../platform/database/lifecycle.server";
import { PendingAuditCapacityError } from "../../../platform/database/write.server";
import type { SubmissionSubmitter } from "./repository";
import { createSubmissionWorkflow } from "./workflow";

export function loadDuplicatePreview(input: {
  acronym: string;
  definition: string;
}) {
  return createSubmissionWorkflow(getRepository()).loadDuplicatePreview(input);
}

export async function submitAcronym(
  values: SubmissionValues,
  submitter: SubmissionSubmitter,
) {
  const outbox = getAppAuditOutbox();
  try {
    return await createSubmissionWorkflow(getRepository(), {
      auditPublisher,
      randomCorrelationId: () => crypto.randomUUID(),
      onCreated: () => outbox.requestDrain(),
    }).submit(values, submitter);
  } catch (error) {
    if (error instanceof PendingAuditCapacityError) {
      // React Router uses thrown Responses to stop the action with this status.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw new Response(null, { status: 503 });
    }
    throw error;
  }
}

export function getSuccessfulSubmissionLocation(entryId: string) {
  return `/define/${encodeURIComponent(entryId)}`;
}

function getRepository() {
  return createAcronymRepository(getAppDatabase());
}
