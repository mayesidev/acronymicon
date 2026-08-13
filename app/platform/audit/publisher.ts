import type {
  AuditClock,
  AuditEvent,
  AuditPublication,
  AuditPublicationResult,
  AuditPublisher,
  AuditSink,
} from "../../domain/audit";

type AuditPublisherDependencies = Readonly<{
  clock: AuditClock;
  sink: AuditSink;
}>;

export function createAuditPublisher({
  clock,
  sink,
}: AuditPublisherDependencies): AuditPublisher {
  return {
    async publish(
      publication: AuditPublication,
    ): Promise<AuditPublicationResult> {
      const event: AuditEvent = {
        ...publication.event,
        schemaVersion: 1,
        timestamp: clock.now().toISOString(),
      };

      try {
        const result = await sink.append(event);

        return result.status === "recorded"
          ? result
          : { status: "unavailable", delivery: publication.delivery };
      } catch {
        return { status: "unavailable", delivery: publication.delivery };
      }
    },
  };
}
