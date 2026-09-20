import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
export function createDatabase(url = process.env.DATABASE_URL) { if (!url) throw new Error("DATABASE_URL is required for Live persistence"); return drizzle(postgres(url, { prepare: false }), { schema }); }
export type Database = ReturnType<typeof createDatabase>;
