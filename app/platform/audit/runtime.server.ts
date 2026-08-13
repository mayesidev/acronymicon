import { createStandardOutputAuditSink } from "./json-line-sink.server";
import { createAuditPublisher } from "./publisher";

export const auditPublisher = createAuditPublisher({
  clock: { now: () => new Date() },
  sink: createStandardOutputAuditSink(),
});
