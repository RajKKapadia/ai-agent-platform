import { appConfig } from "@repo/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const createQueryClient = () =>
  postgres(appConfig.database.url, {
    max: 10,
    prepare: false,
  });

const createDbClient = (queryClient: postgres.Sql) =>
  drizzle(queryClient, { schema });

const globalForDb = globalThis as typeof globalThis & {
  __queryClient?: postgres.Sql;
  __dbClient?: ReturnType<typeof createDbClient>;
};

export const queryClient = globalForDb.__queryClient ?? createQueryClient();
export const db = globalForDb.__dbClient ?? createDbClient(queryClient);

if (appConfig.isDevelopment) {
  globalForDb.__queryClient = queryClient;
  globalForDb.__dbClient = db;
}

export type DbClient = typeof db;

export async function closeDbConnection(): Promise<void> {
  await queryClient.end({ timeout: 5 });
}
