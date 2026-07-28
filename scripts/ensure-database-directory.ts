import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const databasePath = process.env.DATABASE_PATH ?? "./data/acronymicon.sqlite";

mkdirSync(dirname(databasePath), { recursive: true });
