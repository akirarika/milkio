import { mysqlTable, uniqueIndex, bigint, varchar } from "drizzle-orm/mysql-core"

export const devices = mysqlTable(
  "devices",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    name: varchar("name", { length: 255 })
  },
  (t) => ({
    nameIndex: uniqueIndex("name_idx").on(t.name)
  })
)
