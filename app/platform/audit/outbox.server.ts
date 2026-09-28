import { asc, eq } from "drizzle-orm";

import type { AuditEvent, AuditPublicationResult } from "../../domain/audit";
import type { AppDatabase } from "../database/client.server";
import { pendingAuditEvents } from "../database/schema";
import { publishStoredAuditEvent } from "./runtime.server";

type StoredAuditPublisher = (
  event: AuditEvent,
) => Promise<AuditPublicationResult>;

export function createAuditOutbox(
  database: AppDatabase,
  publish: StoredAuditPublisher = publishStoredAuditEvent,
  options: Readonly<{ intervalMs?: number; batchSize?: number }> = {},
) {
  const intervalMs = options.intervalMs ?? 5_000;
  const batchSize = options.batchSize ?? 100;
  let timer: ReturnType<typeof setInterval> | undefined;
  let activeDrain: Promise<void> | undefined;

  function drain(): Promise<void> {
    if (activeDrain) {
      return activeDrain;
    }

    activeDrain = drainBatch().finally(() => {
      activeDrain = undefined;
    });
    return activeDrain;
  }

  async function drainBatch() {
    const pending = database
      .select({ id: pendingAuditEvents.id, event: pendingAuditEvents.event })
      .from(pendingAuditEvents)
      .orderBy(asc(pendingAuditEvents.id))
      .limit(batchSize)
      .all();

    for (const row of pending) {
      const result = await publish(row.event);
      if (result.status === "unavailable") {
        return;
      }

      database
        .delete(pendingAuditEvents)
        .where(eq(pendingAuditEvents.id, row.id))
        .run();
    }
  }

  function requestDrain() {
    void drain().catch(() => {
      // Keep pending rows for the next attempt; avoid logging event content.
      console.error("Submission audit delivery could not read or update its queue.");
    });
  }

  function start() {
    if (timer) {
      return;
    }

    requestDrain();
    timer = setInterval(requestDrain, intervalMs);
    timer.unref();
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  return { drain, requestDrain, start, stop };
}
