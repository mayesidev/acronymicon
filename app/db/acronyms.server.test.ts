import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { closeApplication, initializeApplication } from "../bootstrap.server";
import { parseAppConfig } from "../config.server";
import {
  buildNewAcronymEntry,
  createAcronymEntry,
  createAcronymRepository,
  findExactDuplicate,
  findPublishedByAcronym,
  findPublishedByVariant,
  listPublishedEntries,
} from "./acronyms.server";
import { createTestDatabase } from "../../test/helpers/database";

describe("acronym repository", () => {
  const databases: Array<ReturnType<typeof createTestDatabase>> = [];
  const applicationDirectories: string[] = [];

  afterEach(() => {
    closeApplication();

    for (const database of databases.splice(0)) {
      database.remove();
    }

    for (const directory of applicationDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("builds a published entry with normalized duplicate keys", () => {
    const entry = buildNewAcronymEntry({
      acronym: " api ",
      definition: " Application   Programming Interface ",
      notes: "  A protocol boundary. ",
      submittedByUsername: " user ",
    });

    expect(entry).toMatchObject({
      acronym: "api",
      normalizedAcronym: "API",
      definition: "Application   Programming Interface",
      normalizedDefinition: "application programming interface",
      notes: "A protocol boundary.",
      status: "published",
      submittedByUsername: "user",
    });
  });

  it("enforces exact duplicates while allowing distinct definitions", async () => {
    const database = createTestDatabase();
    databases.push(database);
    const repository = createAcronymRepository(database.db);

    repository.createAcronymEntry({
      acronym: "API",
      definition: "Application Programming Interface",
    });

    const duplicate = await repository.findExactDuplicate({
      acronym: " api ",
      definition: "[A]pplication   [P]rogramming [I]nterface",
    });

    expect(duplicate?.id).toEqual(expect.any(String));
    expect(duplicate?.definition).toBe("Application Programming Interface");

    await expect(
      repository.findExactDuplicate({
        acronym: "API",
        definition: "Annual Performance Index",
      }),
    ).resolves.toBeNull();
  });

  it("lists published entries as feature read models", async () => {
    const database = createTestDatabase();
    databases.push(database);
    const repository = createAcronymRepository(database.db);

    repository.createAcronymEntry({
      acronym: "ZULU",
      definition: "Zulu Definition",
    });
    repository.createAcronymEntry({
      acronym: "ALPHA",
      definition: "Alpha Definition",
    });

    await expect(repository.listPublishedEntries()).resolves.toMatchObject([
      { acronym: "ALPHA", variant: 1 },
      { acronym: "ZULU", variant: 1 },
    ]);
  });

  it("assigns stable variants per acronym for shareable links", async () => {
    const database = createTestDatabase();
    databases.push(database);
    const repository = createAcronymRepository(database.db);

    expect(
      repository.createAcronymEntry({
        acronym: "API",
        definition: "Application Programming Interface",
      }),
    ).toMatchObject({
      status: "created",
      entry: { variant: 1 },
    });

    expect(
      repository.createAcronymEntry({
        acronym: "API",
        definition: "Annual Performance Index",
      }),
    ).toMatchObject({
      status: "created",
      entry: { variant: 2 },
    });

    expect(
      repository.createAcronymEntry({
        acronym: " api ",
        definition: "[A]pplication [P]rogramming [I]nterface",
      }),
    ).toMatchObject({
      status: "duplicate",
      duplicate: { definition: "Application Programming Interface" },
    });

    await expect(
      repository.findPublishedByVariant("api", 2),
    ).resolves.toMatchObject({
      acronym: "API",
      definition: "Annual Performance Index",
      variant: 2,
    });
    await expect(
      repository.findPublishedByVariant("api", 3),
    ).resolves.toBeNull();
  });

  it("serves route-facing operations through the initialized application", async () => {
    const directory = mkdtempSync(join(tmpdir(), "acronymicon-app-db-test-"));
    applicationDirectories.push(directory);
    const config = parseAppConfig({
      NODE_ENV: "test",
      DATABASE_PATH: join(directory, "acronymicon.sqlite"),
      DRIZZLE_MIGRATIONS_PATH: join(process.cwd(), "drizzle"),
    });
    initializeApplication(config, { registerShutdownHandlers: false });

    expect(
      createAcronymEntry({
        acronym: "API",
        definition: "Application Programming Interface",
      }),
    ).toMatchObject({
      status: "created",
      entry: { variant: 1 },
    });
    await expect(
      findExactDuplicate({
        acronym: "api",
        definition: "Application Programming Interface",
      }),
    ).resolves.toMatchObject({
      definition: "Application Programming Interface",
    });
    await expect(findPublishedByAcronym("API")).resolves.toHaveLength(1);
    await expect(findPublishedByVariant("API", 1)).resolves.toMatchObject({
      acronym: "API",
    });
    await expect(listPublishedEntries()).resolves.toHaveLength(1);
  });
});
