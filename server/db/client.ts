import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

let cachedDatabase: Database | undefined;
let cachedUrl: string | undefined;

/**
 * Reuses one PostgreSQL client for warm serverless invocations.  A process must
 * never switch databases after it has created the live client.
 */
export function createDatabase(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is required for Live persistence");
  if (cachedDatabase) {
    if (cachedUrl !== url) throw new Error("DATABASE_URL cannot change within a running process");
    return cachedDatabase;
  }

  cachedUrl = url;
  cachedDatabase = drizzle(postgres(url, { prepare: false, max: 1 }), { schema });
  return cachedDatabase;
}
