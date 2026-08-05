import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

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
    const environment = {
      ...process.env,
      DATABASE_PATH: join(directory, "acronymicon.sqlite"),
      DRIZZLE_MIGRATIONS_PATH: join(process.cwd(), "drizzle"),
      NODE_ENV: "test",
    };

    const firstImport = runImporter([inputPath], environment);
    const secondImport = runImporter(["--", inputPath], environment);

    expect(firstImport).toContain("1 inserted, 0 duplicates skipped, 0 failed");
    expect(secondImport).toContain("0 inserted, 1 duplicates skipped, 0 failed");
  });
});

function runImporter(arguments_: string[], environment: NodeJS.ProcessEnv) {
  return execFileSync(
    "pnpm",
    ["run", "import:acronyms", ...arguments_],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}
