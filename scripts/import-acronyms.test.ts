import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("acronym import command", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("accepts the JSON path with and without pnpm's separator", () => {
    const directory = mkdtempSync(join(tmpdir(), "acronymicon-import-cli-"));
    directories.push(directory);
    const inputPath = join(directory, "entries.json");
    writeFileSync(
      inputPath,
      JSON.stringify([
        {
          acronym: "API",
          definition: "Application Programming Interface",
        },
      ]),
    );
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_PATH: join(directory, "acronymicon.sqlite"),
      DRIZZLE_MIGRATIONS_PATH: join(process.cwd(), "drizzle"),
      NODE_ENV: "production",
      OIDC_CLIENT_ID: "unrelated-partial-configuration",
      SESSION_SECRET: "",
    };

    const firstImport = runImporter([inputPath], environment);
    const secondImport = runImporter(["--", inputPath], environment);

    expect(firstImport).toContain("1 inserted, 0 duplicates skipped, 0 failed");
    expect(secondImport).toContain("0 inserted, 1 duplicates skipped, 0 failed");
  });

  it(
    "serializes competing writers and skips their shared exact duplicate",
    async () => {
      const directory = mkdtempSync(join(tmpdir(), "acronymicon-import-race-"));
      directories.push(directory);
      const databasePath = join(directory, "acronymicon.sqlite");
      const leftInputPath = join(directory, "left.json");
      const rightInputPath = join(directory, "right.json");
      const sharedEntry = {
        acronym: "RACE",
        definition: "Shared Concurrent Definition",
      };
      writeFileSync(
        leftInputPath,
        JSON.stringify([
          sharedEntry,
          ...buildCompetingEntries("left", 19),
        ]),
      );
      writeFileSync(
        rightInputPath,
        JSON.stringify([
          sharedEntry,
          ...buildCompetingEntries("right", 19),
        ]),
      );
      const environment: NodeJS.ProcessEnv = {
        ...process.env,
        DATABASE_PATH: databasePath,
        DRIZZLE_MIGRATIONS_PATH: join(process.cwd(), "drizzle"),
        NODE_ENV: "production",
        OIDC_CLIENT_ID: "unrelated-partial-configuration",
        SESSION_SECRET: "",
      };
      runCommand("db:migrate", [], environment);
      environment.RUN_MIGRATIONS_ON_STARTUP = "false";

      const outputs = await Promise.all([
        runImporterAsync([leftInputPath], environment),
        runImporterAsync([rightInputPath], environment),
      ]);
      const summaries = outputs.map(parseImportSummary);

      expect(
        summaries.reduce((total, result) => total + result.inserted, 0),
      ).toBe(39);
      expect(
        summaries.reduce((total, result) => total + result.duplicates, 0),
      ).toBe(1);
      expect(summaries.every((result) => result.failed === 0)).toBe(true);

      const database = new Database(databasePath, { readonly: true });
      try {
        const variants = database
          .prepare(
            "SELECT variant FROM acronym_entries WHERE normalized_acronym = 'RACE' ORDER BY variant",
          )
          .pluck()
          .all();
        expect(variants).toEqual(
          Array.from({ length: 39 }, (_, index) => index + 1),
        );
      } finally {
        database.close();
      }
    },
    15_000,
  );
});

function runImporter(arguments_: string[], environment: NodeJS.ProcessEnv) {
  return runCommand("import:acronyms", arguments_, environment);
}

function runCommand(
  command: string,
  arguments_: string[],
  environment: NodeJS.ProcessEnv,
) {
  return execFileSync(
    "pnpm",
    ["run", command, ...arguments_],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

async function runImporterAsync(
  arguments_: string[],
  environment: NodeJS.ProcessEnv,
) {
  const result = await execFileAsync(
    "pnpm",
    ["run", "import:acronyms", ...arguments_],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: environment,
    },
  );
  return result.stdout;
}

function buildCompetingEntries(source: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    acronym: "RACE",
    definition: `Concurrent definition ${source} ${index}`,
  }));
}

function parseImportSummary(output: string) {
  const match = output.match(
    /Import complete: (\d+) inserted, (\d+) duplicates skipped, (\d+) failed/,
  );

  if (!match) {
    throw new Error(`Importer output did not contain a result summary: ${output}`);
  }

  return {
    inserted: Number(match[1]),
    duplicates: Number(match[2]),
    failed: Number(match[3]),
  };
}
