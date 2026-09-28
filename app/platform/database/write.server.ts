import { and, count, eq, max } from "drizzle-orm";

import type { AppDatabase } from "./client.server";
import {
  acronymEntries,
  pendingAuditEvents,
  type NewAcronymEntry,
} from "./schema";

type AtomicAcronymWrite = Omit<NewAcronymEntry, "variant">;

export const maxPendingAuditEvents = 10_000;

export class PendingAuditCapacityError extends Error {
  constructor() {
    super("The submission audit queue is full.");
  }
}

type SubmissionAudit = Readonly<{
  correlationId: string;
  actorId: string;
  timestamp: string;
}>;

export type AtomicAcronymWriteResult =
  | {
      status: "created";
      entry: {
        id: string;
        acronym: string;
        variant: number;
        definition: string;
      };
    }
  | {
      status: "duplicate";
      duplicate: {
        id: string;
        definition: string;
      };
    };

export function insertAcronymEntryAtomic(
  database: AppDatabase,
  entry: AtomicAcronymWrite,
  options: Readonly<{
    submissionAudit?: SubmissionAudit;
    pendingAuditLimit?: number;
  }> = {},
): AtomicAcronymWriteResult {
  return database.transaction(
    (transaction) => {
      const [duplicate] = transaction
        .select({
          id: acronymEntries.id,
          definition: acronymEntries.definition,
        })
        .from(acronymEntries)
        .where(
          and(
            eq(
              acronymEntries.normalizedAcronym,
              entry.normalizedAcronym,
            ),
            eq(
              acronymEntries.normalizedDefinition,
              entry.normalizedDefinition,
            ),
          ),
        )
        .limit(1)
        .all();

      if (duplicate) {
        return { status: "duplicate", duplicate };
      }

      if (options.submissionAudit) {
        const [pending] = transaction
          .select({ total: count() })
          .from(pendingAuditEvents)
          .all();
        if (
          (pending?.total ?? 0) >=
          (options.pendingAuditLimit ?? maxPendingAuditEvents)
        ) {
          throw new PendingAuditCapacityError();
        }
      }

      const [latest] = transaction
        .select({ variant: max(acronymEntries.variant) })
        .from(acronymEntries)
        .where(
          eq(acronymEntries.normalizedAcronym, entry.normalizedAcronym),
        )
        .all();
      const [created] = transaction
        .insert(acronymEntries)
        .values({
          ...entry,
          variant: (latest?.variant ?? 0) + 1,
        })
        .returning({
          id: acronymEntries.id,
          acronym: acronymEntries.acronym,
          variant: acronymEntries.variant,
          definition: acronymEntries.definition,
        })
        .all();

      if (options.submissionAudit) {
        transaction
          .insert(pendingAuditEvents)
          .values({
            correlationId: options.submissionAudit.correlationId,
            event: {
              schemaVersion: 1,
              timestamp: options.submissionAudit.timestamp,
              correlationId: options.submissionAudit.correlationId,
              actor: { type: "user", id: options.submissionAudit.actorId },
              source: "http",
              action: "acronym.submit",
              target: { type: "acronym-entry", id: created.id },
              outcome: "succeeded",
            },
          })
          .run();
      }

      return { status: "created", entry: created };
    },
    { behavior: "immediate" },
  );
}
