import { sql } from "drizzle-orm";

import type { AuditPublisher } from "../../domain/audit";
import { auditPublisher } from "../audit/runtime.server";
import type { AppDatabase } from "./client.server";
import { authenticatedSessions } from "./schema";

export async function revokeUserSessions(
  database: AppDatabase,
  userId: string,
  publisher: AuditPublisher = auditPublisher,
) {
  if (!userId.trim()) {
    throw new Error("Provider user ID is required.");
  }

  const correlationId = crypto.randomUUID();
  let revokedCount: number;

  try {
    const revoked = await database
      .delete(authenticatedSessions)
      .where(sql`json_extract(${authenticatedSessions.data}, '$.user.id') = ${userId}`)
      .returning({ id: authenticatedSessions.id });
    revokedCount = revoked.length;
  } catch (error) {
    await publishOutcome("failed");
    throw error;
  }

  const auditResult = await publishOutcome("succeeded");
  return { revokedCount, auditStatus: auditResult.status };

  function publishOutcome(outcome: "succeeded" | "failed") {
    return publisher.publish({
      delivery: "best-effort",
      event: {
        correlationId,
        actor: { type: "system" },
        source: "maintenance",
        action: "session.revoke",
        target: { type: "identity", id: userId },
        outcome,
      },
    });
  }
}
