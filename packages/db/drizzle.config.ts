import { appConfig } from "@repo/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: appConfig.database.url,
  },
  strict: true,
  verbose: true,
});
