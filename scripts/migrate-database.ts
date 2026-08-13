import { getDatabaseConfig } from "../app/platform/config/runtime.server";
import { runDatabaseMigration } from "../app/platform/database/migration.server";

const config = getDatabaseConfig();
const database = await runDatabaseMigration(config);

database.close();
