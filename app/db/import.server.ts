import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { AppDatabase } from "./client.server";
import {
  normalizeAcronym,
  normalizeDefinition,
  parseDefinitionMarkup,
} from "./normalize";
import { acronymEntries } from "./schema";

export const importEntrySchema = z.object({
  acronym: z.string().trim().min(1),
  definition: z.string().trim().min(1),
  notes: z.string().trim().optional(),
  aliases: z.array(z.string().trim().min(1)).default([]),
  status: z.enum(["pending", "published", "removed"]).default("published"),
  submittedByUserId: z.string().trim().optional(),
  submittedByUsername: z.string().trim().optional(),
  submittedByDisplayName: z.string().trim().optional(),
});

export const importFileSchema = z.union([
  z.array(importEntrySchema),
  z.object({ entries: z.array(importEntrySchema) }),
]);

type ImportEntry = z.infer<typeof importEntrySchema>;

export type ImportResult =
  | {
      status: "invalid";
      error: z.ZodError;
    }
  | {
      status: "complete";
      inserted: number;
      skippedDuplicates: number;
      failed: number;
      errors: Array<{ index: number; error: unknown }>;
    };

export async function importAcronymEntries(
  database: AppDatabase,
  input: unknown,
): Promise<ImportResult> {
  const parsedInput = importFileSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      status: "invalid",
      error: parsedInput.error,
    };
  }

  const entries = Array.isArray(parsedInput.data)
    ? parsedInput.data
    : parsedInput.data.entries;
  let inserted = 0;
  let skippedDuplicates = 0;
  const errors: Array<{ index: number; error: unknown }> = [];

  for (const [index, entry] of entries.entries()) {
    try {
      const duplicate = await findDuplicate(database, entry);

      if (duplicate) {
        skippedDuplicates += 1;
        continue;
      }

      await database.insert(acronymEntries).values({
        ...parseImportedDefinition(entry.definition),
        id: crypto.randomUUID(),
        acronym: entry.acronym.trim(),
        normalizedAcronym: normalizeAcronym(entry.acronym),
        notes: normalizeOptional(entry.notes),
        aliases: entry.aliases,
        status: entry.status,
        submittedByUserId: normalizeOptional(entry.submittedByUserId) ?? "seed",
        submittedByUsername:
          normalizeOptional(entry.submittedByUsername) ?? "seed-import",
        submittedByDisplayName:
          normalizeOptional(entry.submittedByDisplayName) ?? "Seed Import",
      });

      inserted += 1;
    } catch (error) {
      errors.push({ index, error });
    }
  }

  return {
    status: "complete",
    inserted,
    skippedDuplicates,
    failed: errors.length,
    errors,
  };
}

async function findDuplicate(database: AppDatabase, entry: ImportEntry) {
  const [duplicate] = await database
    .select({ id: acronymEntries.id })
    .from(acronymEntries)
    .where(
      and(
        eq(acronymEntries.normalizedAcronym, normalizeAcronym(entry.acronym)),
        eq(
          acronymEntries.normalizedDefinition,
          normalizeDefinition(entry.definition),
        ),
      ),
    )
    .limit(1);

  return duplicate;
}

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseImportedDefinition(value: string) {
  const parsed = parseDefinitionMarkup(value);

  return {
    definition: parsed.text,
    definitionRanges: parsed.ranges,
    normalizedDefinition: normalizeDefinition(parsed.text),
  };
}
