import { relations, sql } from 'drizzle-orm';
import { char, datetime, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

// 示例表：可按需修改或删除。
const tableName = 'user';

export const userTable = mysqlTable(
  tableName,
  {
    // 主键 ID，24 位随机字符串
    id: char({ length: 24 }).notNull().primaryKey(),
    // 名称
    name: varchar({ length: 32 }).notNull(),
    // 创建时间
    createdAt: datetime({ fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    // 更新时间
    updatedAt: datetime({ fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
  },
  () => [],
);

export const userRelations = relations(userTable, () => ({}));

export type User = typeof userTable.$inferSelect;
