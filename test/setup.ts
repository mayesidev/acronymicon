import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

const testDirectory = mkdtempSync(join(tmpdir(), "acronymicon-vitest-"));

process.env.DATABASE_PATH = join(testDirectory, "acronymicon.sqlite");
process.env.DRIZZLE_MIGRATIONS_PATH = join(process.cwd(), "drizzle");
process.env.SESSION_SECRET = "vitest-session-secret";
