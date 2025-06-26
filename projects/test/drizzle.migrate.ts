import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./.milkio/drizzle-schema.ts";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { sql } from "drizzle-orm";

console.log("\n🔗 DATABASE URL: ", process.env.DATABASE_URL);

const db = drizzle(process.env.DATABASE_URL as string, { mode: "default", schema });

let retry = 2;
while (retry--) {
  if (retry <= 0) throw new Error("🔗 DATABASE CONNECTION FAILED");
  try {
    const result: any = await db.execute(sql`SELECT VERSION()`);
    console.log(`🔗 DATABASE VERSION: ${result[0][0]["VERSION()"]}`);
    break;
  } catch (error) {
    console.log("\n🔗 DATABASE CONNECTION FAILED, RETRYING...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

await migrate(db, { migrationsFolder: "./projects/kecream-server/drizzle" });

console.log("\n✅ MIGRATION DONE!");
