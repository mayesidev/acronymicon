import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import { parseAppConfig } from "../../../platform/config/runtime.server";
import { createAcronymRepository } from "../../../platform/database/acronym-repository.server";
import {
  closeApplication,
  getAppDatabase,
  initializeApplication,
} from "../../../platform/database/lifecycle.server";
import { listPublishedAcronyms, lookupDefinition } from "./api";

const applicationDirectories: string[] = [];

afterEach(() => {
  closeApplication();

  for (const directory of applicationDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("serves dictionary reads through the feature API", async () => {
  initializeTestApplication();
  const repository = createAcronymRepository(getAppDatabase());
  repository.createAcronymEntry({
    acronym: "API",
    definition: "Application Programming Interface",
    submittedByUserId: "user-id",
    submittedByUsername: "user",
  });
  repository.createAcronymEntry({
    acronym: "API",
    definition: "Annual Performance Index",
    submittedByUserId: "user-id",
    submittedByUsername: "user",
  });

  await expect(
    listPublishedAcronyms("annual", "alphabetical"),
  ).resolves.toMatchObject([{ acronym: "API", variant: 2 }]);
  await expect(
    lookupDefinition({ acronym: "api", variant: "2" }),
  ).resolves.toMatchObject({
    status: "entry",
    entry: { definition: "Annual Performance Index", variant: 2 },
  });
});

function initializeTestApplication() {
  const directory = mkdtempSync(join(tmpdir(), "acronymicon-dictionary-api-"));
  applicationDirectories.push(directory);
  initializeApplication(
    parseAppConfig({
      NODE_ENV: "test",
      DATABASE_PATH: join(directory, "acronymicon.sqlite"),
      DRIZZLE_MIGRATIONS_PATH: join(process.cwd(), "drizzle"),
    }),
    { registerShutdownHandlers: false },
  );
}
