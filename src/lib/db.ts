import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
const globalDb = globalThis as unknown as { practicePool?: Pool };
export const pool =
  globalDb.practicePool ??
  new Pool({
    connectionString: process.env.EHR_DATABASE_URL || process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 12000,
  });
if (process.env.NODE_ENV !== "production") globalDb.practicePool = pool;
export const db = drizzle(pool, { schema });
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Executor = typeof db | Tx;
