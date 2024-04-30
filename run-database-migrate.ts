import { env, exit } from "node:process";
import { useDrizzle } from "./src/uses/drizzle";

async function databaseMigrate() {
	// (optional) migrate the database structure to the production environment
	const drizzle = await useDrizzle();
	const { migrate } = await import("drizzle-orm/mysql2/migrator");
	await migrate(drizzle, { migrationsFolder: "drizzle" });
	exit(0);
}

databaseMigrate();
