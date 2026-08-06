import { afterEach, describe, expect, it } from "vitest";

import {
  buildNewAcronymEntry,
  createAcronymRepository,
} from "./acronym-repository.server";
import { createTestDatabase } from "../../../test/helpers/database";

describe("acronym repository", () => {
  const databases: Array<ReturnType<typeof createTestDatabase>> = [];

  afterEach(() => {
    for (const database of databases.splice(0)) {
      database.remove();
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
      submittedByUserId: "user-id",
      submittedByUsername: "user",
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
      submittedByUserId: "user-id",
      submittedByUsername: "user",
    });
    repository.createAcronymEntry({
      acronym: "ALPHA",
      definition: "Alpha Definition",
      submittedByUserId: "user-id",
      submittedByUsername: "user",
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
        submittedByUserId: "user-id",
        submittedByUsername: "user",
      }),
    ).toMatchObject({
      status: "created",
      entry: { variant: 1 },
    });

    expect(
      repository.createAcronymEntry({
        acronym: "API",
        definition: "Annual Performance Index",
        submittedByUserId: "user-id",
        submittedByUsername: "user",
      }),
    ).toMatchObject({
      status: "created",
      entry: { variant: 2 },
    });

    expect(
      repository.createAcronymEntry({
        acronym: " api ",
        definition: "[A]pplication [P]rogramming [I]nterface",
        submittedByUserId: "user-id",
        submittedByUsername: "user",
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
});
