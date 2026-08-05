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
  listPublishedAcronyms,
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

    await repository.createAcronymEntry({
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

  it("searches published entries through user-visible fields", async () => {
    const database = createTestDatabase();
    databases.push(database);
    const repository = createAcronymRepository(database.db);

    await repository.createAcronymEntry({
      acronym: "API",
      definition: "Application Programming Interface",
      notes: "Systems integration",
    });

    await expect(
      repository.listPublishedAcronyms("interface"),
    ).resolves.toHaveLength(1);
    await expect(
      repository.listPublishedAcronyms("integration"),
    ).resolves.toHaveLength(0);
    await expect(
      repository.listPublishedAcronyms("missing"),
    ).resolves.toHaveLength(0);
  });

  it("lists published entries alphabetically by default", async () => {
    const database = createTestDatabase();
    databases.push(database);
    const repository = createAcronymRepository(database.db);

    await repository.createAcronymEntry({
      acronym: "ZULU",
      definition: "Zulu Definition",
    });
    await repository.createAcronymEntry({
      acronym: "ALPHA",
      definition: "Alpha Definition",
    });

    await expect(repository.listPublishedAcronyms("")).resolves.toMatchObject([
      { acronym: "ALPHA", variant: 1 },
      { acronym: "ZULU", variant: 1 },
    ]);
  });

  it("ranks exact matches before substring and minor typo matches", async () => {
    const database = createTestDatabase();
    databases.push(database);
    const repository = createAcronymRepository(database.db);

    await repository.createAcronymEntry({
      acronym: "APP",
      definition: "Application Profile",
    });
    await repository.createAcronymEntry({
      acronym: "API",
      definition: "Application Programming Interface",
    });
    await repository.createAcronymEntry({
      acronym: "APR",
      definition: "Annual Performance Review",
    });

    await expect(
      repository.listPublishedAcronyms("api"),
    ).resolves.toMatchObject([
      { acronym: "API" },
      { acronym: "APP" },
      { acronym: "APR" },
    ]);
    await expect(
      repository.listPublishedAcronyms("applcation"),
    ).resolves.toMatchObject([{ acronym: "API" }, { acronym: "APP" }]);
  });

  it("assigns stable variants per acronym for shareable links", async () => {
    const database = createTestDatabase();
    databases.push(database);
    const repository = createAcronymRepository(database.db);

    await expect(
      repository.createAcronymEntry({
        acronym: "API",
        definition: "Application Programming Interface",
      }),
    ).resolves.toMatchObject({ variant: 1 });

    await expect(
      repository.createAcronymEntry({
        acronym: "API",
        definition: "Annual Performance Index",
      }),
    ).resolves.toMatchObject({ variant: 2 });

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

    await expect(
      createAcronymEntry({
        acronym: "API",
        definition: "Application Programming Interface",
      }),
    ).resolves.toMatchObject({ variant: 1 });
    await expect(
      findExactDuplicate({
        acronym: "api",
        definition: "Application Programming Interface",
      }),
    ).resolves.toMatchObject({ definition: "Application Programming Interface" });
    await expect(findPublishedByAcronym("API")).resolves.toHaveLength(1);
    await expect(findPublishedByVariant("API", 1)).resolves.toMatchObject({
      acronym: "API",
    });
    await expect(listPublishedAcronyms("API")).resolves.toHaveLength(1);
  });
});
