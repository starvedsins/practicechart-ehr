import "dotenv/config";
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED });
const runtimeUser = new URL(process.env.DATABASE_URL!).username;
if (runtimeUser !== "practicechart_app")
  throw Error("Use the dedicated practicechart_app runtime role.");
const database = new URL(process.env.DATABASE_URL_UNPOOLED!).pathname.slice(1);
if (!/^practicechart[_a-z0-9]+$/.test(database))
  throw Error("Use a PracticeChart database.");
await pool.query(
  `GRANT CONNECT ON DATABASE ${database} TO practicechart_app; GRANT USAGE ON SCHEMA public TO practicechart_app; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO practicechart_app; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO practicechart_app; REVOKE UPDATE,DELETE ON clinical_revisions,audit_events,prescriptions FROM practicechart_app; REVOKE ALL ON migrations FROM practicechart_app; REVOKE CREATE ON SCHEMA public FROM PUBLIC;`,
);
await pool.end();
console.log("Runtime grants applied.");
