import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";

import Database from "better-sqlite3";
import { z } from "zod";

const importEntrySchema = z.object({
  acronym: z.string().trim().min(1),
  definition: z.string().trim().min(1),
  notes: z.string().trim().optional(),
  aliases: z.array(z.string().trim().min(1)).default([]),
  status: z.enum(["pending", "published", "removed"]).default("published"),
  submittedByUserId: z.string().trim().optional(),
  submittedByUsername: z.string().trim().optional(),
  submittedByDisplayName: z.string().trim().optional(),
});

const importFileSchema = z.union([
  z.array(importEntrySchema),
  z.object({ entries: z.array(importEntrySchema) }),
]);

const inputPath = process.argv[2];
const databasePath = process.env.DATABASE_PATH ?? "./data/acronymicon.sqlite";

if (!inputPath) {
  console.error("Usage: node scripts/import-acronyms.mjs <path-to-json>");
  process.exit(1);
}

const rawInput = await readFile(inputPath, "utf8");
const parsedJson = JSON.parse(rawInput);
const parsedInput = importFileSchema.safeParse(parsedJson);

if (!parsedInput.success) {
  console.error("Import file is invalid:");
  console.error(z.prettifyError(parsedInput.error));
  process.exit(1);
}

const entries = Array.isArray(parsedInput.data)
  ? parsedInput.data
  : parsedInput.data.entries;

mkdirSync(dirname(databasePath), { recursive: true });

const database = new Database(databasePath);
database.pragma("foreign_keys = ON");

const findDuplicate = database.prepare(`
  SELECT id
  FROM acronym_entries
  WHERE normalized_acronym = ? AND normalized_definition = ?
  LIMIT 1
`);
const findNextVariant = database.prepare(`
  SELECT COALESCE(MAX(variant), 0) + 1 AS variant
  FROM acronym_entries
  WHERE normalized_acronym = ?
`);
const insertEntry = database.prepare(`
  INSERT INTO acronym_entries (
    id,
    acronym,
    normalized_acronym,
    definition,
    definition_ranges,
    variant,
    normalized_definition,
    notes,
    aliases,
    status,
    submitted_by_user_id,
    submitted_by_username,
    submitted_by_display_name
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let inserted = 0;
let skippedDuplicates = 0;
let failed = 0;

for (const [index, entry] of entries.entries()) {
  const acronym = entry.acronym.trim();
  const parsedDefinition = parseDefinitionMarkup(entry.definition);
  const definition = parsedDefinition.text;
  const normalizedAcronym = normalizeAcronym(acronym);
  const normalizedDefinition = normalizeDefinition(definition);

  if (findDuplicate.get(normalizedAcronym, normalizedDefinition)) {
    skippedDuplicates += 1;
    console.warn(
      `Skipped duplicate at index ${index}: ${acronym} = ${definition}`,
    );
    continue;
  }

  try {
    const variant = findNextVariant.get(normalizedAcronym).variant;
    insertEntry.run(
      randomUUID(),
      acronym,
      normalizedAcronym,
      definition,
      JSON.stringify(parsedDefinition.ranges),
      variant,
      normalizedDefinition,
      normalizeOptional(entry.notes),
      JSON.stringify(entry.aliases),
      entry.status,
      normalizeOptional(entry.submittedByUserId) ?? "seed",
      normalizeOptional(entry.submittedByUsername) ?? "seed-import",
      normalizeOptional(entry.submittedByDisplayName) ?? "Seed Import",
    );
    inserted += 1;
  } catch (error) {
    failed += 1;
    console.error(`Failed to import entry at index ${index}:`, error);
  }
}

database.close();

console.log(
  `Import complete: ${inserted} inserted, ${skippedDuplicates} duplicates skipped, ${failed} failed.`,
);

if (failed > 0) {
  process.exit(1);
}

function normalizeAcronym(value) {
  return value.trim().toUpperCase();
}

function normalizeDefinition(value) {
  return parseDefinitionMarkup(value).text.replace(/\s+/g, " ").toLowerCase();
}

function parseDefinitionMarkup(value) {
  let text = "";
  let rangeStart = null;
  const ranges = [];

  for (const character of value) {
    if (character === "[") {
      if (rangeStart !== null) {
        throw new Error("Definition ranges cannot be nested.");
      }
      rangeStart = text.length;
      continue;
    }

    if (character === "]") {
      if (rangeStart === null) {
        throw new Error(
          "Definition ranges must be opened before they are closed.",
        );
      }
      if (rangeStart === text.length) {
        throw new Error("Definition ranges cannot be empty.");
      }
      ranges.push({ start: rangeStart, end: text.length });
      rangeStart = null;
      continue;
    }

    text += character;
  }

  if (rangeStart !== null) {
    throw new Error("Definition ranges must be closed.");
  }

  const trimmedText = text.trim();
  const leadingWhitespace = text.length - text.trimStart().length;

  return {
    text: trimmedText,
    ranges: ranges.map((range) => ({
      start: range.start - leadingWhitespace,
      end: range.end - leadingWhitespace,
    })),
  };
}

function normalizeOptional(value) {
  const normalized = value?.trim();
  return normalized || null;
}
