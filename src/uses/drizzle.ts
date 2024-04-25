import * as schema from "../../generated/database-schema"
import { defineUse } from "milkio"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"

export const useDrizzle = defineUse(async () => {
  const connection = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "root",
    database: "test"
  })

  const db = drizzle(connection, { schema, mode: "default" })
  return db
})
