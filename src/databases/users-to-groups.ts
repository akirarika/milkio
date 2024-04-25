import { bigint, mysqlTable, primaryKey } from "drizzle-orm/mysql-core"
import { users } from "./users"
import { groups } from "./groups"
import { relations } from "drizzle-orm"

export const usersToGroups = mysqlTable(
  "users_to_groups",
  {
    userId: bigint("user_id", { mode: "number" }).notNull(),
    groupId: bigint("group_id", { mode: "number" }).notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.groupId] })
  })
)

export const usersToGroupsRelations = relations(usersToGroups, ({ one }) => ({
  group: one(groups, {
    fields: [usersToGroups.groupId],
    references: [groups.id]
  }),
  user: one(users, {
    fields: [usersToGroups.userId],
    references: [users.id]
  })
}))
