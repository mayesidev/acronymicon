import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import { parseAppConfig } from "../../../platform/config/runtime.server";
import {
  closeApplication,
  initializeApplication,
} from "../../../platform/database/lifecycle.server";
import { loadDuplicatePreview, submitAcronym } from "./api";

const applicationDirectories: string[] = [];

afterEach(() => {
  closeApplication();

  for (const directory of applicationDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("serves atomic submissions and duplicate previews through the feature API", async () => {
  initializeTestApplication();
  const values = {
    acronym: "API",
    definition: "Application Programming Interface",
  };

  await expect(
    submitAcronym(values, {
      id: "user-id",
      username: "user",
      displayName: "Local User",
    }),
  ).resolves.toEqual({ status: "created", acronym: "API" });
  await expect(loadDuplicatePreview(values)).resolves.toMatchObject({
    existingEntries: [{ definition: values.definition }],
    exactDuplicate: { definition: values.definition },
  });
});

function initializeTestApplication() {
  const directory = mkdtempSync(join(tmpdir(), "acronymicon-submission-api-"));
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
