import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
const owner = process.env.DATABASE_URL_UNPOOLED;
if (
  !owner ||
  !/^practicechart[_a-z0-9]+$/.test(new URL(owner).pathname.slice(1))
)
  throw Error("Use the separate PracticeChart owner connection.");
process.env.EHR_DATABASE_URL = owner;
const { db, pool } = await import("../src/lib/db");
const { rows, manageUser, event } = await import("../src/lib/service");
const { sql } = await import("drizzle-orm");
try {
  const file = path.resolve(process.argv[2] || "");
  const privateRoot = path.resolve(".private") + path.sep;
  if (!file.startsWith(privateRoot) || !file.endsWith(".json"))
    throw Error("Supply an input JSON file inside .private.");
  const input = z
    .object({
      actorUsername: z.string(),
      action: z.enum(["create", "update", "audit"]),
      targetId: z.uuid().optional(),
      data: z.record(z.string(), z.unknown()).default({}),
    })
    .parse(JSON.parse(await readFile(file, "utf8")));
  const [user] = await rows(
    sql`SELECT id,username,name,role,protected,version FROM users WHERE username=${input.actorUsername} AND active`,
  );
  if (!user)
    throw Error(
      "Use an active staff identity to attribute this operator action.",
    );
  const actor = {
    ...user,
    role: "operator",
  } as unknown as import("../src/lib/schema").Staff;
  if (input.action === "audit") {
    await event(db, actor, "operator_review", "audit");
    console.log(
      JSON.stringify(
        await rows(
          sql`SELECT id,actor_id,action,entity,entity_id,created_at FROM audit_events ORDER BY created_at DESC LIMIT 100`,
        ),
        null,
        2,
      ),
    );
  } else {
    if (input.action === "update" && !input.targetId)
      throw Error("An update needs targetId.");
    const result = await manageUser(
      actor,
      input.data,
      input.action === "update" ? input.targetId : undefined,
    );
    await event(db, actor, "operator_cli", "user", result.id);
    console.log(JSON.stringify({ id: result.id, status: "saved" }));
  }
} finally {
  await pool.end();
}
