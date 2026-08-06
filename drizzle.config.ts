import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./app/platform/database/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? "./data/acronymicon.sqlite",
  },
});
