# Drizzle

## @milkio/drizzle 工具集

`@milkio/drizzle` 是一个**极简工具集**（不包装 drizzle-orm、不隐藏实现细节），只提供测试随机数据库相关的基础设施。连接、迁移、seed、删库、挂载 `context.db` 的代码都在你自己工程的样板里，可自由修改。

**导出的纯函数 / 常量：**

| 导出 | 说明 |
|------|------|
| `TEST_DATABASE_PREFIX` | 测试库名前缀 `milkio_test`（启动清理时按此前缀 DROP） |
| `TEST_DATABASE_HEADER` | 请求头名 `x-milkio-test-db`，astra 与 server 共享同一约定 |
| `TEST_DATABASE_MAX_LENGTH` | 数据库名最大长度（64） |
| `generateTestDatabaseId(filePath?)` | 生成 `milkio_test_<文件片段>_<随机>`，≤64 字符 |
| `sanitizeDatabasePart(input)` | 清洗标识符为合法库名片段 |
| `withTestDatabase(url, databaseId)` | 替换 URL 的数据库名；`databaseId` 为空时原样返回 |
| `extractDatabaseName(url)` | 从 URL 提取数据库名 |
| `getTestDatabaseId(headers)` | 从请求头读取随机库名，无则返回 `null`（走默认库） |

**随机库名带测试文件路径**，例如 `app/modules/oc/__TEST__.test.ts` → `milkio_test_oc_test_a1b2c3d4`，便于追溯是哪个测试文件创建了该库。

### 测试基建：cleanDatabase 钩子

`@milkio/astra` 的 `world.cleanDatabase()` 被标准化为**钩子调度器**：每次显式调用都会**新建一个随机库并切换**，然后并行执行所有通过 `hooks.onCleanDatabase(...)` 注册的钩子（从黄金库克隆 DDL + seed、清 Redis 命名空间等）。**每次运行测试前**，globalSetup 会先把上一次遗留的 `milkio_test_*` 库全部删掉。

`@milkio/drizzle` 与 `@milkio/redis` **都不在包内提供 hook 默认实现**；hook 是样板代码，写在你项目的 `app/utils/drizzle-test.ts` / `redis-test.ts` 中，可自由修改。

```ts
// app/utils/astra.ts
import { fileURLToPath } from 'node:url';
import { createAstra } from '@milkio/astra';
import { drizzleCleanHook } from './drizzle-test.ts';
import { redisCleanHook } from './redis-test.ts';

export const astra = await createAstra({
  stargate,
  bootstrap: async (hooks) => {
    hooks.onCleanDatabase(drizzleCleanHook({                  // 建库+迁移+seed
      baseUrl: () => testConfig.drizzle.url,
      migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
    }));
    hooks.onCleanDatabase(redisCleanHook({ url: () => testConfig.redis.url }));
    return {};
  },
});
```

**每次运行测试前**删除上一次遗留的 `milkio_test_*` 库，必须放在 vitest `globalSetup`（每次运行只执行一次），**不能放在每个测试文件的 astra bootstrap 里**——并行运行时后启动的文件会把先启动文件正在使用的库删掉。`globalSetup` 还负责准备「黄金库」：完整迁移在这里只跑一次，之后每个测试库直接克隆黄金库的 DDL（`CREATE TABLE ... LIKE`），几秒内即可建好一个全新随机库，避免每个测试都重放几十个迁移文件（本机实测单次完整迁移约 40s）：

```ts
// app/utils/astra-global-setup.ts（在 vitest.config.ts 的 globalSetup 注册）
import { fileURLToPath } from 'node:url';
import { dropAllTestDatabases, ensureGoldenDatabase } from './drizzle-test.ts';
import { flushTestRedis } from './redis-test.ts';

export default async function setup() {
  await dropAllTestDatabases(testConfig.drizzle.url);
  await flushTestRedis(testConfig.redis.url);
  await ensureGoldenDatabase({
    baseUrl: testConfig.drizzle.url,
    migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
    force: true,
  });
}
```

测试代码里照常使用，无需改动：

```ts
const [context, fail, world] = await astra.createMirrorWorld(import.meta.url);
await world.cleanDatabase();   // 新建随机库 + 完整迁移 + seed + 清当前库 redis 命名空间
```

由于每个测试用各自独立的随机库，文件之间互不干扰，可以安全地并行运行（在 `vitest.config.ts` 中放开 `fileParallelism` / `maxWorkers`）。

**测试文件里直连数据库 / redis 时**（绕过 HTTP 直接断言行数据），也必须跟随当前随机库，不能连默认库。样板在 `drizzle-test.ts` 提供跟随当前库的 `db` 代理、`getCurrentTestDbUrl()`，在 `redis-test.ts` 提供 `testRedisKey(key)`（服务端测试模式下所有业务 key 带 `${databaseId}:` 前缀，redis 清理只按前缀删，绝不能 `flushDb`）：

```ts
import { db } from '../../utils/drizzle-test.ts';
import { testRedisKey } from '../../utils/redis-test.ts';

await world.cleanDatabase();
await db.execute(sql`INSERT INTO ocItem ...`);           // 写入当前随机库
await redis.incrBy(testRedisKey(quotaKey), 999900);       // 写入当前库的 redis 命名空间
```

另外几点并行注意事项（样板已内置，改样板时不要回退）：

- **完整迁移很慢**：几十个迁移文件单次重放可达数十秒（BaiduSync 等慢盘更甚），超过 vitest 默认 testTimeout 会让每个测试都超时。因此样板采用「黄金库」：globalSetup 里 `ensureGoldenDatabase({ force: true })` 完整迁移一次，`drizzleCleanHook` 里 `cloneGoldenDatabase()` 用 `CREATE TABLE ... LIKE` 克隆 DDL（几秒）再 seed。若你的迁移足够快，可改回每次完整迁移。
- **MySQL 连接数**：`world.cleanDatabase()` 每次都切到新库，服务端按 URL 懒建的连接只增不减会撞 `max_connections`（Too many connections）。样板在 bootstrap/drizzle 里给缓存连接加了 LRU 上限；淘汰时**不能 `await end()`**——被淘汰的连接可能仍有请求在途（测试超时后请求还在服务端跑），`await` 会把当前请求挂起。
- **磁盘占用**：分区表克隆每库可达 100MB+（每分区独立 .ibd），一轮 co test 约 200 个库 ≈ 20GB，小磁盘直接撑爆。样板采用**切库即删**：`drizzleCleanHook` 每次切换新库时删除上一个测试库，同时存在的测试库数量 = 并行测试文件数（个位数）；globalSetup teardown 再兜底清理文件结束后的最后一个库与黄金库。
- **migrationsFolder**：`migrate()` 的迁移目录按进程 cwd 解析，从 monorepo 根跑 vitest 时 `./drizzle` 会指错位置，必须用 `import.meta.url` 解析为绝对路径。

完整的样板代码（含 `drizzleCleanHook` / `dropAllTestDatabases` / `truncateAll` 的可改实现）见 `template-milkio` 模板的 `app/utils/drizzle-test.ts`。

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
if (result[0].affectedRows === 0) throw context.fail("DATA_CONFLICT", undefined);
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

**由 AI 自己运行 `co drizzle`，无需用户执行。** `co drizzle` 默认**完全非交互**：不会弹出任何确认。只有一个候选 project / mode 时会自动选中；存在多个候选且未指定 `--project` / `--mode` 时会立即以退出码 3 失败并列出候选，不会等待输入。

**禁止自行编写迁移 SQL 文件。** 修改表结构（如新增字段、索引、关系）后，只需在 `*.table.ts` 中声明变更，然后由你自己运行 `co drizzle generate` 生成迁移文件。不要手动创建或修改 `drizzle/` 目录下的 `.sql` 文件与 `_journal.json`。

### 一条命令完成「生成迁移 + 应用迁移」

```bash
co drizzle generate --project=<项目名> --mode=<模式名> --yes --json
```

-   `--yes`：授权执行写数据库的操作（migrate，以及 generate 之后的自动 migrate）。不带 `--yes` 时，generate 只生成迁移文件、不应用迁移。
-   项目若存在 `drizzle.migrate.ts`，generate 成功且带 `--yes` 时会自动执行它。
-   不想自动应用迁移可加 `--no-auto-migrate`。

### 其他命令

-   `co drizzle migrate --project=<项目名> --mode=<模式名> --yes --json`：应用迁移。
-   `co drizzle pull --project=<项目名> --mode=<模式名> --json`：从数据库内省 schema（不会提示）。
-   `co drizzle push --project=<项目名> --mode=<模式名> --yes --json`：直接把 schema 推到数据库，属于高风险命令，必须带 `--yes`；若包含数据丢失语句（删表、删列等），还需额外 `--force`（或用 `--answers` 显式选择 `Yes`）。
-   `co drizzle check --project=<项目名> --mode=<模式名> --json`：迁移后检查状态。
-   `co drizzle export ...`：导出 SQL（可选）。

### 输出与退出码

带 `--json` 时，stdout 只有一个 JSON 文档，日志全部写在 stderr。结果字段：

| 字段 | 说明 |
|------|------|
| `ok` | 是否成功 |
| `status` | `generated` / `no_changes` / `migrated` / `pushed` / `introspected` / `checked` / `upgraded` / `exported` / `decisions_required` / `failed` |
| `project` / `mode` / `database` | 本次操作的工程、模式、数据库（不含密码） |
| `migrations` | `[{ tag, file, sql }]` |
| `autoMigrate` | `{ ran, exitCode }` |
| `decisions` / `fingerprint` / `resume` | 仅 `decisions_required` 时出现，见下节 |
| `next` | 建议的下一步 |
| `output` | `export` 时导出的 SQL 文本 |
| `note` / `error` | 补充说明 / 失败原因 |

退出码：

-   `0`：成功或无需变更。
-   `1`：失败。
-   `2`：需要 AI 决策（此时未写入任何迁移文件）。
-   `3`：参数 / 授权 / 项目 / mode 错误。
-   `4`：并发锁冲突。

### 退出码 2：需要 AI 决策

schema 变更存在歧义时（典型：重命名列 / 表，drizzle-kit 分不清是 rename 还是 drop+create），命令不会卡住等待输入，而是以退出码 2 输出：

```json
{
  "ok": false,
  "status": "decisions_required",
  "command": "generate",
  "project": "test",
  "mode": "test",
  "fingerprint": "bb99d84e5d42d35e",
  "decisions": [
    {
      "index": 0,
      "kind": "rename_or_create",
      "entity": "column",
      "question": "Is nickname column in user table created or renamed from another column?",
      "options": [
        { "index": 0, "label": "nickname", "choice": "create" },
        { "index": 1, "label": "name › nickname", "choice": "rename" }
      ],
      "digest": "479ffdcc84f0"
    }
  ],
  "resume": "co drizzle generate --project=test --mode=test --yes --json --answers='{\"fingerprint\":\"bb99d84e5d42d35e\",\"digests\":[\"479ffdcc84f0\"],\"choices\":[\"<option index>\"]}'"
}
```

处理流程：

1. 读取 `decisions`，为每个问题按 `options[].index` 选一个选项（`choice` 字段说明了语义：`create` = 新建、`rename` = 重命名、`yes` / `no` = 确认或拒绝）。
2. 把 `resume` 命令里尖括号占位符 `<option index>` 按提示顺序替换成对应的数字 index（例如重命名选 `1`，即 `"choices":[1]`），然后执行该命令即可一次成功。`resume` 会保留原命令的授权：原命令没有 `--yes` 时，resume 也不会带 `--yes`（不会因为重跑而自动应用迁移）。命令中的 `digests` 会逐个校验两次运行看到的是同一批问题；若不一致会再次以退出码 2 返回**新的** `decisions`（并带 `note` 提示），不会猜测作答。`fingerprint` 是整批决策的摘要，便于日志排查，不用于放行判断。
3. 也可以直接自己拼 `--answers`：`--answers='{"fingerprint":"<fingerprint>","digests":["<digest>",...],"choices":[<index>,...]}'`。`digests` 与 `fingerprint` 可省略，但不建议省略（省略后不做一致性校验）。
4. 已知会重命名时，可以一次成型（仅当恰好出现**一个**歧义提示时生效；出现第二个提示时仍会 exit 2 要求显式 answers，避免把 drop+create 误当成 rename）：

```bash
co drizzle generate --project=<项目名> --mode=<模式名> --yes --on-prompt=rename --json
```

**不要自己手写迁移 SQL，也不要修改 `drizzle/` 下的 `.sql` 或 `_journal.json` 来绕过决策。**

### `--interactive` 仅人类使用

`--interactive` 只给人类使用：显式开启后才会恢复 project / mode 选择与确认提示。AI 不要使用。

### 涉及步骤

1. 在 `*.table.ts` 中修改表定义（加字段、加索引、加关系等）。
2. 自己运行 `co drizzle generate --project=<项目名> --mode=<模式名> --yes --json`，一次完成迁移文件的生成与应用。
3. 按退出码处理：`0` 成功；`2` 走上面的决策流程；`3` / `4` 修正参数或稍后重试。

## 重要注意事项

1.  **禁止自行编写迁移 SQL 文件**，由 AI 自己运行 `co drizzle generate ...`（见上节）生成。
2.  数据库表名称必须以模块名开头，或完全等于模块名。请勿省略模块名。
3.  **禁止使用外键约束**。如需创建索引，请使用单字段索引。
4.  严格遵循一个文件一张数据库表的原则，切勿在单个文件中编写多张表。

在编写代码前，请先阐述你设计的数据库表之间的关系，供用户决策，然后再编写表结构代码。请务必仔细评估需求，考虑到可能需要创建多张表的场景。