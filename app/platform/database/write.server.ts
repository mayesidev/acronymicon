import { and, eq, max } from "drizzle-orm";

import type { AppDatabase } from "./client.server";
import { acronymEntries, type NewAcronymEntry } from "./schema";

type AtomicAcronymWrite = Omit<NewAcronymEntry, "variant">;

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

      return { status: "created", entry: created };
    },
    { behavior: "immediate" },
  );
}
