import { eq, and } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { db } from "../app/db/client.server";
import { normalizeAcronym, normalizeDefinition } from "../app/db/normalize";
import { acronymEntries } from "../app/db/schema";

const importEntrySchema = z.object({
  acronym: z.string().trim().min(1),
  definition: z.string().trim().min(1),
  notes: z.string().trim().optional(),
  category: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  aliases: z.array(z.string().trim().min(1)).default([]),
  source: z.string().trim().optional(),
  status: z.enum(["pending", "published", "removed"]).default("published"),
  submittedByUserId: z.string().trim().optional(),
  submittedByUsername: z.string().trim().optional(),
  submittedByDisplayName: z.string().trim().optional(),
});

const importFileSchema = z.union([
  z.array(importEntrySchema),
  z.object({ entries: z.array(importEntrySchema) }),
]);

type ImportEntry = z.infer<typeof importEntrySchema>;

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: npm run import:acronyms -- <path-to-json>");
  process.exit(1);
}

const rawInput = await readFile(inputPath, "utf8");
const parsedJson: unknown = JSON.parse(rawInput);
const parsedInput = importFileSchema.safeParse(parsedJson);

if (!parsedInput.success) {
  console.error("Import file is invalid:");
  console.error(z.prettifyError(parsedInput.error));
  process.exit(1);
}

const entries = Array.isArray(parsedInput.data)
  ? parsedInput.data
  : parsedInput.data.entries;

let inserted = 0;
let skippedDuplicates = 0;
let failed = 0;

for (const [index, entry] of entries.entries()) {
  try {
    const duplicate = await findDuplicate(entry);

    if (duplicate) {
      skippedDuplicates += 1;
      console.warn(
        `Skipped duplicate at index ${index}: ${entry.acronym} = ${entry.definition}`,
      );
      continue;
    }

    await db.insert(acronymEntries).values({
      id: randomUUID(),
      acronym: entry.acronym.trim(),
      normalizedAcronym: normalizeAcronym(entry.acronym),
      definition: entry.definition.trim(),
      normalizedDefinition: normalizeDefinition(entry.definition),
      notes: normalizeOptional(entry.notes),
      category: normalizeOptional(entry.category),
      tags: entry.tags,
      aliases: entry.aliases,
      source: normalizeOptional(entry.source),
      status: entry.status,
      submittedByUserId: normalizeOptional(entry.submittedByUserId) ?? "seed",
      submittedByUsername:
        normalizeOptional(entry.submittedByUsername) ?? "seed-import",
      submittedByDisplayName:
        normalizeOptional(entry.submittedByDisplayName) ?? "Seed Import",
    });

    inserted += 1;
  } catch (error) {
    failed += 1;
    console.error(`Failed to import entry at index ${index}:`, error);
  }
}

console.log(
  `Import complete: ${inserted} inserted, ${skippedDuplicates} duplicates skipped, ${failed} failed.`,
);

if (failed > 0) {
  process.exit(1);
}

async function findDuplicate(entry: ImportEntry) {
  const normalizedAcronym = normalizeAcronym(entry.acronym);
  const normalizedDefinition = normalizeDefinition(entry.definition);

  const [duplicate] = await db
    .select({ id: acronymEntries.id })
    .from(acronymEntries)
    .where(
      and(
        eq(acronymEntries.normalizedAcronym, normalizedAcronym),
        eq(acronymEntries.normalizedDefinition, normalizedDefinition),
      ),
    )
    .limit(1);

  return duplicate;
}

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
