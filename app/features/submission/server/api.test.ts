import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq, sql } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../../../platform/audit/runtime.server", () => ({
  auditPublisher: {
    publish: () => Promise.resolve({ status: "recorded" }),
  },
  publishStoredAuditEvent: () => Promise.resolve({ status: "recorded" }),
}));

import { parseAppConfig } from "../../../platform/config/runtime.server";
import {
  closeApplication,
  getAppDatabase,
  initializeApplication,
} from "../../../platform/database/lifecycle.server";
import { acronymEntries } from "../../../platform/database/schema";
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

  const outcome = await submitAcronym(values, {
    id: "user-id",
    username: "user",
    displayName: "Local User",
  });
  expect(outcome.status).toBe("created");
  if (outcome.status !== "created") {
    throw new Error("Expected the test submission to be created.");
  }
  expect(outcome).toMatchObject({ status: "created", acronym: "API" });
  expect(outcome.entryId).toEqual(expect.any(String));
  await expect(loadDuplicatePreview(values)).resolves.toMatchObject({
    existingEntries: [{ definition: values.definition }],
    exactDuplicate: { definition: values.definition },
  });
});

it("returns a content-free 503 without saving when the audit queue is full", async () => {
  initializeTestApplication();
  const database = getAppDatabase();
  database.run(sql`
    WITH RECURSIVE sequence(value) AS (
      SELECT 1
      UNION ALL
      SELECT value + 1 FROM sequence WHERE value < 10000
    )
    INSERT INTO pending_audit_events (correlation_id, event)
    SELECT 'capacity-' || value, '{}' FROM sequence
  `);
  const acronym = `PRIVATE-${crypto.randomUUID()}`;

  let response: unknown;
  try {
    await submitAcronym(
      { acronym, definition: "Private definition" },
      { id: "user-id", username: "user" },
    );
  } catch (error) {
    response = error;
  }

  expect(response).toBeInstanceOf(Response);
  if (!(response instanceof Response)) {
    throw new Error("Expected the audit capacity response.");
  }
  expect(response.status).toBe(503);
  await expect(response.text()).resolves.toBe("");
  expect(JSON.stringify([...response.headers])).not.toContain(acronym);
  expect(
    database
      .select()
      .from(acronymEntries)
      .where(eq(acronymEntries.acronym, acronym))
      .all(),
  ).toEqual([]);
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
    { registerShutdownHandlers: false, startAuditDelivery: false },
  );
}
