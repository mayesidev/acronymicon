import { createStandardOutputAuditSink } from "./json-line-sink.server";
import {
  createAuditPublisher,
  createStoredAuditPublisher,
} from "./publisher";

const sink = createStandardOutputAuditSink();
const fallbackSink = createStandardOutputAuditSink(process.stderr);

export const auditPublisher = createAuditPublisher({
  clock: { now: () => new Date() },
  sink,
  fallbackSink,
});

export const publishStoredAuditEvent = createStoredAuditPublisher({
  sink,
  fallbackSink,
});
