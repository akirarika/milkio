import { relations } from "drizzle-orm"
import { mysqlTable, varchar, bigint } from "drizzle-orm/mysql-core"
import { usersToGroups } from "./users-to-groups"

export const groups = mysqlTable("groups", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  name: varchar("name", { length: 255 })
})

export const groupsRelations = relations(groups, ({ many }) => ({
  usersToGroups: many(usersToGroups)
}))
