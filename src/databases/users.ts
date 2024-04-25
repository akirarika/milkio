import { relations } from "drizzle-orm"
import { mysqlTable, uniqueIndex, bigint, varchar } from "drizzle-orm/mysql-core"
import { usersToGroups } from "./users-to-groups"

export const users = mysqlTable(
  "users",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    name: varchar("name", { length: 255 })
  },
  (t) => ({
    nameIndex: uniqueIndex("name_idx").on(t.name)
  })
)

export const usersRelations = relations(users, ({ many }) => ({
  usersToGroups: many(usersToGroups)
}))
