import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  closeApplication,
  getAppDatabase,
  initializeApplication,
} from "./bootstrap.server";
import { parseAppConfig } from "./platform/config/runtime.server";
import { acronymEntries } from "./db/schema";

describe("application lifecycle", () => {
  const directories: string[] = [];

  afterEach(() => {
    closeApplication();

    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("requires startup before database access", () => {
    closeApplication();

    expect(() => getAppDatabase()).toThrow(
      "Application database is not initialized",
    );
  });

  it("initializes once, migrates, and releases the owned database", async () => {
    const directory = mkdtempSync(join(tmpdir(), "acronymicon-bootstrap-"));
    directories.push(directory);
    const config = parseAppConfig({
      NODE_ENV: "test",
      DATABASE_PATH: join(directory, "acronymicon.sqlite"),
      DRIZZLE_MIGRATIONS_PATH: join(process.cwd(), "drizzle"),
    });

    const first = initializeApplication(config, {
      registerShutdownHandlers: false,
    });
    const second = initializeApplication(config, {
      registerShutdownHandlers: false,
    });

    expect(second).toBe(first);
    await expect(first.select().from(acronymEntries)).resolves.toEqual([]);

    closeApplication();
    expect(() => getAppDatabase()).toThrow(
      "Application database is not initialized",
    );
  });
});
