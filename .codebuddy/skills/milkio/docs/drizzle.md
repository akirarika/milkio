# Drizzle

## 示例

```ts
// 获取一条
const user = await db.query.user.findFirst();
// 获取多条
const users = await db.query.user.findMany();
// 筛选条件
const users = await db.query.user.findMany({
    where: and(
        eq(userTable.id, 1),
        eq(userTable.name, "张三"),
    ),
});
// 排序
const users = await db.query.user.findMany({
    orderBy: [asc(userTable.id)],
});
```

使用 drizzle 时，请优先使用 db.query.<表名>.findMany(...) 这种方式来查询。除非必要，否则尽可能不要使用 `await db.select(...).from(...)` 的形式进行查询。

## 事务

可以通过 `await context.db.transaction((tx) => { ... })` 开启事务。事务应尽量简短，不要把整个方法包裹在事务中，尤其不要将查询语句纳入事务。**单条插入、更新、删除无需事务，只有需要同时执行两条及以上写操作时才使用。**

如果事务内的操作没有顺序依赖，可以用 `Promise.all` 并行执行：

```ts
await context.db.transaction((tx) => Promise.all([
    tx.insert(storageAssetTable).values({
        id: assetId,
        storageId: storageId,
    }),
    tx.insert(storageTable).values({
        id: storageId,
        spaceId: params.data.spaceId,
    }),
]));
```

## 乐观锁

所有 `edit` 端点必须使用乐观锁，防止并发更新导致数据覆盖。

原理：将读取时的 `updatedAt` 作为更新条件，若期间有其他请求修改了该行，`updatedAt` 已变化，更新影响 0 行即检测到冲突。

```ts
const result = await context.db.update(articleTable).set({ ...params.data, updatedAt: undefined }).where(
  and(
    eq(articleTable.id, params.data.id),
    eq(articleTable.updatedAt, params.data.updatedAt),
  )
);
if (result[0].affectedRows === 0) throw context.reject("DATA_CONFLICT", undefined);
```

不要将 `updatedAt` 包含在 `.set()` 中——MySQL 的 `ON UPDATE CURRENT_TIMESTAMP(3)` 仅在该列未出现于 SET 子句时自动生效，显式传入会导致时间戳不会更新。

## 数据库表

所有数据库表文件均存放在模块的 `$databases` 目录下。

我们使用 drizzle 作为 ORM 工具。每个文件代表一张数据库表，采用小写字母+中划线命名，并使用单数名词。主表文件名必须与模块名严格一致。副表（如中间表、扩展表）的文件名需以模块名开头，中间表使用 `to` 连接相关表名。注意：**数据库中的实际表名需转换为驼峰命名**。例如：
-   用户模块主表：`user.table.ts`（对应表 `user`）
-   用户设备表：`user-device.table.ts`（对应表 `userDevice`）
-   用户-设备中间表：`user-to-user-device.table.ts`（对应表 `userToUserDevice`）

数据库表文件写法示例如下（**注意：使用 MySQL 作为数据库，因此，请使用 `drizzle-orm/mysql-core`，而非 `drizzle-orm/pg-core`**）：

```typescript
// /app/modules/application/$databases/application.table.ts
import type typia from "typia";
import { relations, sql } from "drizzle-orm";
import { char, int, datetime, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { user } from "../../user/$databases/user.table.ts";

// 应用程序表
const tableName = "application";

export const applicationTable = mysqlTable(
  tableName,
  {
    // 主键 ID，24位随机字符串
    id: char({ length: 24 }).$type<string & typia.tags.Pattern<"^[a-zA-Z0-9]{24}$">>().notNull().primaryKey(),
    // 用户 ID
    userId: char({ length: 24 }).$type<string & typia.tags.Pattern<"^[a-zA-Z0-9]{24}$">>().notNull(),
    // 名称
    name: varchar({ length: 32 }).$type<string & typia.tags.Pattern<"^\\S{2,32}$">>().unique(),
    // 创建时间
    createdAt: datetime({ fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    // 更新时间
    updatedAt: datetime({ fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
  },
  (t) => ([]),
);

export const applicationRelations = relations(applicationTable, ({ one, many }) => ({
  user: one(user, {
    fields: [applicationTable.userId],
    references: [user.id],
  }),
}));

export type Application = typeof applicationTable.$inferSelect;
export type ApplicationInsert = Omit<typeof applicationTable.$inferInsert, "createdAt" | "updatedAt">;
```

### 字段定义规范

定义数据库表时，务必遵循以下规范。

-   每张表必须包含 `createdAt` 和 `updatedAt` 字段。
-   **字符串**：使用 `string & typia.tags.Pattern<"<正则表达式>">` 严格约束格式、长度和内容。
-   **数字**：使用 `number & typia.tags.Minimum<>`、`Maximum<>`、`ExclusiveMaximum<>`、`ExclusiveMinimum<>`、`MultipleOf<>` 等标签约束。
-   **布尔值**：使用 `boolean` 类型。
-   **枚举值**：使用 `varchar` 类型，并通过 `.$type<"foo" | "bar" | "baz">()` 限制取值。
-   **JSON**：定义普通的 TypeScript 类型。
-   **时间**：一律使用 `datetime({ fsp: 3 })`，不附加额外类型。
-   **价格**：使用 `int` 类型，单位为“分”。禁止使用 `bigint` 或小数类型。
-   **主键**：固定为 24 位长度随机字符串：`id: char({ length: 24 }).$type<string & typia.tags.Pattern<"^[a-zA-Z0-9]{24}$">>().notNull().primaryKey()`。
-   每个字段上方，都必须添加详细的说明其含义的注释，不可省略。



### Typia 类型标签

你可能注意到了，我们使用 typia 来约束可存入数据的类型。当数据库的类型被端点的 `Params` 所引用时，Milkio 会自动使用 typia 来确保接收到的值符合 `Params` 的类型。任何不符合你方法预期类型的输入都将被拒绝，而任何符合类型要求的额外属性将被移除。

匹配正则表达式：

```ts
string & typia.tags.Pattern<"^[a-z]+$">
```

限制字符串长度:

```ts
string & typia.tags.MaxLength<3> & typia.tags.MinLength<191>
```

限制数组中的数量：

```ts
Array<string> & typia.tags.MinItems<3> & typia.tags.MaxItems<10>
```

限制数字为整数类型：

```ts
number & typia.tags.Type<"uint32">
number & typia.tags.Type<"int32">
```

限制数字范围：

```ts
number & typia.tags.Minimum<0> & typia.tags.Maximum<100>
number & typia.tags.ExclusiveMinimum<19> & typia.tags.Maximum<100>
```

数字必须是某数的倍数：

```ts
number & typia.tags.MultipleOf<5>
```

其他格式：

```ts
string & typia.tags.Format<"ipv4">
string & typia.tags.Format<"ipv6">
string & typia.tags.Format<"url">
```

格式标签支持联合类型（允许匹配多种格式之一）：

```ts
string & (typia.tags.Format<"ipv4"> | typia.tags.Format<"ipv6">)
```

数组元素去重：

```ts
Array<string> & typia.tags.UniqueItems
```

数组元素同时约束格式与数量：

```ts
Array<string & typia.tags.Format<"uuid">> & typia.tags.MinItems<1> & typia.tags.MaxItems<100>
```

注意，不要使用本文档未列出的类型标签，它们很可能是不存在的。

### 定义表关系

如果表之间存在关联，需定义关系（relations）。例如：
-   **多对多关系（用户-角色）**：
    在中间表 `user-to-role.table.ts` 末尾添加：
    ```typescript
    export const userToRoleRelations = relations(userToRole, ({ one, many }) => ({
      user: one(user, {
        fields: [userToRole.userId],
        references: [user.id],
      }),
      role: one(role, {
        fields: [userToRole.roleId],
        references: [role.id],
      }),
    }));
    ```
    在 `user.table.ts` 和 `role.table.ts` 末尾分别添加 `many(userToRole)` 和 `many(roleToUser)` 关系。
-   **一对多关系（文章-评论）**：
    在 `article.table.ts` 末尾添加 `many(comment)` 关系。
    在 `comment.table.ts` 末尾添加 `one(article)` 关系。

**请使用相对路径引用其他数据库表，且不要为关系添加不必要的表引用。**

## 索引

drizzle 使用表的第二个参数来定义索引。例如：

```
mysqlTable(
  tableName,
  {
    // 字段定义...
  },
  (t) => ([ // 注意：此处是数组，只有在旧版中才是对象
    index('index__userId').on(t.userId),
  ])
);
```

## 数据库迁移

**禁止自行编写迁移 SQL 文件。** 修改表结构（如新增字段、索引）后，只需在 `*.table.ts` 中声明变更，然后通知用户运行 `co drizzle generate` 命令生成迁移文件。该命令只有用户有权限执行。

涉及步骤：
1. 在 `*.table.ts` 中修改表定义（加字段、加索引等）
2. 告知用户运行 `co drizzle generate` 生成迁移
3. 告知用户运行 `co drizzle migrate` 执行迁移

不要手动创建 `drizzle/` 目录下的 `.sql` 文件或修改 `_journal.json`。

## 重要注意事项

1.  **禁止自行编写迁移 SQL 文件**，必须由用户运行 `co drizzle generate` 生成。
2.  数据库表名称必须以模块名开头，或完全等于模块名。请勿省略模块名。
3.  **禁止使用外键约束**。如需创建索引，请使用单字段索引。
4.  严格遵循一个文件一张数据库表的原则，切勿在单个文件中编写多张表。

在编写代码前，请先阐述你设计的数据库表之间的关系，供用户决策，然后再编写表结构代码。请务必仔细评估需求，考虑到可能需要创建多张表的场景。