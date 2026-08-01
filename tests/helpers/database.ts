import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDatabase } from "../../app/db/client.server";

export function createTestDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "acronymicon-db-test-"));
  const database = createDatabase({
    databasePath: join(directory, "acronymicon.sqlite"),
    migrationsFolder: join(process.cwd(), "drizzle"),
  });

  return {
    ...database,
    remove: () => {
      database.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
