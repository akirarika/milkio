#!/usr/bin/env bun
import { exit } from "node:process";

console.log("Drizzle Migrating..");

// load config and schema
const config = await import("./drizzle.config.ts");
const schema = await import("./generated/database-schema.ts");

// run drizzle-kit
// generate the modified content into SQL and store it in the drizzle folder
const { execSync } = await import("node:child_process");
execSync(`npx drizzle-kit generate:mysql`, { stdio: "inherit" });

// load drizzle and execute migrations
const mysql = await import("mysql2/promise");
const { drizzle } = await import("drizzle-orm/mysql2");
const { migrate } = await import("drizzle-orm/mysql2/migrator");
const connection = await mysql.createConnection(config.default.dbCredentials);
const db = drizzle(connection, { schema, mode: "default" });
await migrate(db, { migrationsFolder: "drizzle" });

console.log("Drizzle Migration Completed!");
exit(0);
