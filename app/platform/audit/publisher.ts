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
  fallbackSink?: AuditSink;
}>;

export function createAuditPublisher({
  clock,
  sink,
  fallbackSink,
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

      let recorded = false;

      try {
        const result = await sink.append(event);
        recorded = result.status === "recorded";
      } catch {
        recorded = false;
      }

      if (recorded) {
        return { status: "recorded" };
      }

      await reportSinkFailure(fallbackSink, event);
      return { status: "unavailable", delivery: publication.delivery };
    },
  };
}

async function reportSinkFailure(
  fallbackSink: AuditSink | undefined,
  event: AuditEvent,
) {
  if (!fallbackSink) {
    return;
  }

  try {
    await fallbackSink.append({
      schemaVersion: event.schemaVersion,
      timestamp: event.timestamp,
      correlationId: event.correlationId,
      actor: { type: "system" },
      source: event.source,
      action: "audit.sink.append",
      target: { type: "application" },
      outcome: "failed",
    });
  } catch {
    // The fallback is attempted once and never reports through itself.
  }
}
