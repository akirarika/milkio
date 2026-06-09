# Point

## 示例

如前文所述，一个模块通常包含五个端点，合称 BREAD：`browse.action.ts`（浏览列表）、`read.action.ts`（读取单条）、`edit.action.ts`（编辑）、`add.action.ts`（添加）、`delete.action.ts`（删除）。以下是各端点的示例。

`add.action.ts` 的示例：

```
// /app/modules/application/add.action.ts
import { MilkioContext, MilkioMeta } from '../../../.milkio/declares.ts';
import { articleTable, type ArticleInsert } from "./$databases/article.table.ts";
import { createId } from "../../utils/create-id.ts";

export const meta: MilkioMeta = {
  allow: [],
};

type Params = {
  data: ArticleInsert;
}

type Result = {
  id: string;
}

export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  context.logger.info('端点请求参数 (add.action.ts)', JSON.stringify(params));

  const id = createId();
  const data = {
    ...params.data,
    id,
  } satisfies typeof articleTable.$inferInsert;

  await context.db.insert(articleTable).values(data);

  const result = { id };
  context.logger.info('端点请求结果 (add.action.ts)', JSON.stringify(result));
  
  return result;
};
```

`browse.action.ts` 的示例：

```
// /app/modules/application/browse.action.ts
import { MilkioContext, MilkioMeta } from '../../../.milkio/declares.ts';
import type typia from "typia";
import { and, asc, gt, type SQL } from "drizzle-orm";
import { articleTable, type Article } from "./$databases/article.table.ts";

export const meta: MilkioMeta = {
  allow: [],
};

type Params = {
  limit?: number & typia.tags.Maximum<128>;
  cursor?: string;
}

type Result = {
  data: Article[];
  cursor: string | undefined;
}

export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  context.logger.info('端点请求参数 (browse.action.ts)', JSON.stringify(params));

  const whereCase: Array<SQL> = [];
  if (params.cursor) whereCase.push(gt(articleTable.id, params.cursor));

  const data = await context.db.query.articleTable.findMany({
    where: and(...whereCase),
    limit: params.limit ?? 128,
    orderBy: [asc(articleTable.id)],
  });

  const cursor = data.at(-1)?.id;

  const result = {
    data,
    cursor,
  };
  context.logger.info('端点请求结果 (browse.action.ts)', JSON.stringify(result));

  return result;
};
```

注意：默认使用游标分页，如示例所示。**仅当用户明确需要时，才改用 offset 分页。**

`delete.action.ts` 的示例：

```
// /app/modules/application/delete.action.ts
import { MilkioContext, MilkioMeta } from '../../../.milkio/declares.ts';
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { articleTable } from "./$databases/article.table.ts";

export const meta: MilkioMeta = {
  allow: [],
};

type Params = {
  id: string | Array<string>;
}

type Result = {
}

export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  context.logger.info('端点请求参数 (delete.action.ts)', JSON.stringify(params));

  const whereCase: Array<SQL> = [];
  if (!Array.isArray(params.id)) whereCase.push(eq(articleTable.id, params.id));
  if (Array.isArray(params.id)) whereCase.push(inArray(articleTable.id, params.id));

  await context.db.delete(articleTable).where(and(...whereCase));

  return {};
};
```

`edit.action.ts` 的示例：

注意，更新时采用了乐观锁机制，防止并发更新导致数据覆盖。

原理：将读取时的 `updatedAt` 作为更新条件，若期间有其他请求修改了该行，`updatedAt` 已变化，更新影响 0 行即检测到冲突。

```
// /app/modules/application/edit.action.ts
import { MilkioContext, MilkioMeta } from '../../../.milkio/declares.ts';
import { and, eq, type SQL } from "drizzle-orm";
import { articleTable, type Article } from "./$databases/article.table.ts";

export const meta: MilkioMeta = {
  allow: [],
};

type Params = {
  data: Article;
}

type Result = {
}

export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  context.logger.info('端点请求参数 (edit.action.ts)', JSON.stringify(params));

  const whereCase: Array<SQL> = [];
  whereCase.push(eq(articleTable.id, params.data.id));
  whereCase.push(eq(articleTable.updatedAt, params.data.updatedAt));

  const result = await context.db.update(articleTable).set({ ...params.data, updatedAt: undefined }).where(and(...whereCase)).limit(1);
  if (result[0].affectedRows === 0) throw context.reject("DATA_CONFLICT", undefined);

  return {};
};
```

`read.action.ts` 的示例：

```
// /app/modules/application/read.action.ts
import { MilkioContext, MilkioMeta } from '../../../.milkio/declares.ts';
import { and, eq, type SQL } from "drizzle-orm";
import { articleTable, type Article } from "./$databases/article.table.ts";

export const meta: MilkioMeta = {
  allow: [],
};

type Params = {
  id: string;
}

type Result = {
  data: Article;
}

export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  context.logger.info('端点请求参数 (read.action.ts)', JSON.stringify(params));

  const whereCase: Array<SQL> = [];
  if (params.id) whereCase.push(eq(articleTable.id, params.id));
  if (whereCase.length === 0) {
    context.logger.error('缺少查询条件 (read.action.ts)', JSON.stringify(params));
    throw context.reject("DATA_NOT_FOUND", undefined);
  }

  const data = await context.db.query.articleTable.findFirst({
    where: and(...whereCase),
  });
  if (!data) {
    context.logger.error('数据不存在 (read.action.ts)', JSON.stringify(params));
    throw context.reject("DATA_NOT_FOUND", undefined);
  }

  const result = {
    data,
  };
  context.logger.info('端点请求结果 (read.action.ts)', JSON.stringify(result));

  return result;
};
```

`read-many.action.ts` 的示例：

```
// /app/modules/application/read-many.action.ts
import { MilkioContext, MilkioMeta } from '../../../.milkio/declares.ts';
import { and, inArray, type SQL } from "drizzle-orm";
import { articleTable, type Article } from "./$databases/article.table.ts";

export const meta: MilkioMeta = {
  allow: [],
};

type Params = {
  ids: Array<string>;
}

type Result = {
  data: Article[];
}

export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  context.logger.info('端点请求参数 (read-many.action.ts)', JSON.stringify(params));

  const whereCase: Array<SQL> = [];
  if (params.ids) whereCase.push(inArray(articleTable.id, params.ids));

  const data = await context.db.query.articleTable.findMany({
    where: and(...whereCase),
  });

  const result = {
    data,
  };
  context.logger.info('端点请求结果 (read-many.action.ts)', JSON.stringify(result));

  return result;
};
```

## 内部动作（$exports）

有些动作不需要对外暴露为 HTTP 接口，仅供模块内部或其他模块调用，这类动作放在 `$exports` 目录下。**`$exports` 目录中的动作不会注册为端点。**

例如，更新用户点数的动作不应由前端直接调用，而应由支付模块等其他模块内部调用：

```
// /app/modules/points/$exports/add.action.ts
import { MilkioContext, MilkioMeta } from '../../../../.milkio/declares.ts';
import { pointsTable, type PointsInsert } from "./$databases/points.table.ts";
import { createId } from "../../utils/create-id.ts";

export const meta: MilkioMeta = {
  allow: [],
};

type Params = {
  data: {
    userId: string;
    points: number;
  };
}

type Result = {
  points: number;
}

export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
    context.logger.info('端点请求参数 ($exports/add.action.ts)', JSON.stringify(params));

    // 操作用户的点数...
    const result = {
        points: params.data.points,
    };
    context.logger.info('端点请求结果 ($exports/add.action.ts)', JSON.stringify(result));
    
    return result;
};
```

在其他动作中，可通过 `context.call` 调用内部动作：

```ts
const result = await context.call(import('../points/$exports/add.action.ts'), {
  data: {
    userId: params.data.userId,
    points: 100,
  },
});
console.log(result.points); // 100
```

## 参数类型

参数类型应尽量基于数据库表类型派生，**避免直接使用 `number`、`string` 等基础类型**。可以通过 `Omit` 排除不需要的字段：

```ts
import { User } from "../../users/$databases/users.table.ts";

export type Params = Omit<User, 'uploadAt' | 'clientId' | 'clientIp'>;

export async function handler(
  context: MilkioContext,
  params: Params,
) {
    // ...
};
```

也可以只选取需要的字段：

```ts
import { User } from "../../users/$databases/users.table.ts";

type Params = {
  id: User['id'];
  username: User['username'];
}

export async function handler(
  context: MilkioContext,
  params: Params,
) {
    // ...
};
```

分页、排序等数据库中无对应字段的参数，才可直接使用基础类型。

类型定义很重要——Milkio 基于 typia 会根据你定义的类型对前端传参进行校验：被 `Omit` 排除的字段会被自动过滤；缺少必填字段则会直接返回失败响应。

**不要解构参数**，避免 `const { userId, points } = params.data` 这种写法，应直接使用 `params.data.userId`、`params.data.points` 访问。

## 错误处理

要使动作失败并返回错误，使用 `throw context.reject("错误码", 数据)`。例如数据不存在时：`throw context.reject("DATA_NOT_FOUND", undefined)`。

系统公共错误码定义在 `/app/codes` 目录下的文件中，**目录中的所有文件均为有效错误码**。

模块专属错误码定义在 `/app/modules/模块名/$codes/模块名.code.ts` 中。例如点数模块的两个错误码：

```
// /app/modules/point/$codes/point.code.ts
export interface _ {
  /**
   * 点数兑换失败
   */
  POINT_EXCHANGE_FAILED: undefined;
  /**
   * 点数不足
   */
  POINT_INSUFFICIENT: {
    required: number;
    available: number;
  };
}
```

抛出示例：

```ts
// 点数兑换失败
throw context.reject("POINT_EXCHANGE_FAILED", undefined);

// 点数不足
throw context.reject("POINT_INSUFFICIENT", {
  required: 100,
  available: 50,
});
```

**重点：错误码的数据结构中不得包含 `message` 等文本字段。** 具体的错误提示文案应由前端根据错误码生成——后端返回文本会导致国际化困难，且增加传输体积。前端根据错误码决定展示内容；对于携带数据的错误码，前端可利用这些数据拼装出完整的提示信息。

## 测试

前文提到，你应该在对应模块的目录下创建一个 `__TEST__.test.ts`，在里面存放该模块所有相关的测试代码，并且在每次编写完成代码之后，运行一遍相关的测试。

### 测试用例示例

以下示例展示了针对不同动作（增、删、改、查、批量查）的标准测试写法：

**基础创建与查询测试 (`add`, `read`)**：
```ts
import { expect, test } from "vitest";
import { astra } from "../../utils/test.ts";

/**
 * 调试测试：快速执行创建动作
 * 目的：在开发过程中快速验证接口是否可正常调用，
 * 不做断言，仅用于调试和观察返回值。
 */
test("adjust", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  // 调试：执行创建动作，generateParams 会自动生成符合接口定义的随机参数
  await world.execute("/application/add", { generateParams: true });
});

/**
 * 基础创建与查询测试
 * 验证数据的创建和查询流程：
 * 1. 调用 add 接口创建一条新数据
 * 2. 使用返回的 ID 调用 read 接口查询该数据
 * 3. 断言查询结果中的 ID 与创建时返回的 ID 一致
 */
test("basic", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  // 关键：清理数据库，确保测试环境干净，避免其他测试数据的干扰
  await world.cleanDatabase();

  // 1. 调用创建接口，generateParams 会自动填充所需的参数字段
  const [errorAdd, resultAdd] = await world.execute("/application/add", { generateParams: true });
  if (errorAdd) throw reject("创建失败", errorAdd);
  // 获取新建数据的 ID，用于后续查询
  const newId = resultAdd.id;

  // 2. 调用查询接口，通过 ID 查询刚创建的数据，验证数据已正确持久化
  const [errorGet, resultGet] = await world.execute("/application/read", { generateParams: false, params: { id: newId } });
  if (errorGet) throw reject("查询失败", errorGet);

  // 3. 断言：查询结果中的 ID 应与创建时返回的 ID 一致，确认数据完整性
  expect(resultGet.data?.id).toBe(newId);
});
```

**查询列表测试 (`browse`)**：
```ts
import { expect, test } from "vitest";
import { astra } from "../../utils/test.ts";

/**
 * 调试测试：快速执行列表查询动作
 * 目的：在开发过程中快速验证 browse 接口是否可正常调用，
 * 不做断言，仅用于调试和观察返回值。
 */
test("adjust", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  // 调试：执行列表查询动作，generateParams 会自动生成查询参数
  await world.execute("/application/browse", { generateParams: true });
});

/**
 * 查询列表测试
 * 验证列表查询接口能正确返回已创建的数据：
 * 1. 先创建一条数据
 * 2. 调用 browse 接口查询列表
 * 3. 断言列表中包含刚创建的数据
 */
test("basic", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  // 关键：清理数据库，确保测试环境干净，避免其他测试数据的干扰
  await world.cleanDatabase();

  // 创建一条数据，后续用来验证列表查询结果
  const [errorAdd, resultAdd] = await world.execute("/application/add", { generateParams: true });
  if (errorAdd) throw reject("Execution failed", errorAdd);
  // 记录创建数据的 ID，用于后续在列表中查找匹配
  const id = resultAdd.id;

  // 调用 browse 接口查询数据列表
  const [errorBrowse, resultBrowse] = await world.execute("/application/browse", { generateParams: false });
  if (errorBrowse) throw reject("Execution failed", errorBrowse);

  // 断言：列表中应能找到刚创建的数据，确认 browse 接口返回完整数据
  const found = resultBrowse.data.find((item) => item.id === id);
  expect(Boolean(found)).toBe(true);
});
```

**删除测试 (`delete`)**：
```ts
import { expect, test } from "vitest";
import { astra } from "../../utils/test.ts";

/**
 * 调试测试：快速执行删除动作
 * 目的：在开发过程中快速验证 delete 接口是否可正常调用，
 * 不做断言，仅用于调试和观察返回值。
 */
test("adjust", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  // 调试：执行删除动作，generateParams 会自动生成包含 ID 的删除参数
  await world.execute("/application/delete", { generateParams: true });
});

/**
 * 删除测试
 * 验证删除接口能正确移除数据：
 * 1. 先创建一条数据
 * 2. 调用 delete 接口删除该数据
 * 3. 再次查询该数据，断言应返回 DATA_NOT_FOUND 错误
 */
test("basic", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  // 关键：清理数据库，确保测试环境干净，避免其他测试数据的干扰
  await world.cleanDatabase();

  // 创建一条数据，后续用来测试删除功能
  const [errorAdd, resultAdd] = await world.execute("/application/add", { generateParams: true });
  if (errorAdd) throw reject("创建失败", errorAdd);
  // 记录创建数据的 ID，用于后续删除和验证
  const id = resultAdd.id;

  // 调用删除接口，通过 ID 删除刚创建的数据
  const [errorDelete, resultDelete] = await world.execute("/application/delete", { generateParams: false, params: { id } });
  if (errorDelete) throw reject("删除失败", errorDelete);

  // 再次查询该数据，验证其已被删除
  const [errorGet, resultGet] = await world.execute("/application/read", { generateParams: false, params: { id } });

  // 关键断言：确保错误类型是 DATA_NOT_FOUND，说明数据已被成功删除
  if (!errorGet || errorGet.DATA_NOT_FOUND === undefined) {
    throw reject("删除后查询未返回预期错误", errorGet);
  }
});
```

**更新测试 (`edit`)**：
```ts
import { expect, test } from "vitest";
import { astra } from "../../utils/test.ts";

/**
 * 调试测试：快速执行更新动作
 * 目的：在开发过程中快速验证 edit 接口是否可正常调用，
 * 不做断言，仅用于调试和观察返回值。
 */
test("adjust", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  // 调试：执行更新动作，generateParams 会自动生成更新所需的参数
  await world.execute("/application/edit", { generateParams: true });
});

/**
 * 更新测试
 * 验证更新接口能正确修改数据：
 * 1. 先创建一条数据
 * 2. 查询并记录更新前的数据快照
 * 3. 调用 edit 接口更新该数据
 * 4. 查询更新后的数据
 * 5. 断言更新前后的数据不一致，确认更新生效
 */
test("basic", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  // 关键：清理数据库，确保测试环境干净，避免其他测试数据的干扰
  await world.cleanDatabase();

  // 创建一条数据，后续用来测试更新功能
  const [errorAdd, resultAdd] = await world.execute("/application/add", { generateParams: true });
  if (errorAdd) throw reject("创建失败", errorAdd);
  // 记录创建数据的 ID，用于后续查询和更新定位
  const id = resultAdd.id;

  // 记录更新前的数据快照，用于与更新后的数据做对比
  const [errorBefore, resultBefore] = await world.execute("/application/read", { generateParams: false, params: { id } });
  if (errorBefore) throw reject("查询失败（更新前）", errorBefore);

  // 执行更新动作：params 中的 id 用于定位要更新的数据，generateParams 会生成其他更新字段
  const [errorUpdate, resultUpdate] = await world.execute("/application/edit", {
    params: { data: { id } },
    generateParams: true,
  });
  if (errorUpdate) throw reject("更新失败", errorUpdate);

  // 获取更新后的数据，用于与更新前做对比
  const [errorAfter, resultAfter] = await world.execute("/application/read", { generateParams: false, params: { id } });
  if (errorAfter) throw reject("查询失败（更新后）", errorAfter);

  // 断言：更新前后的数据不应完全相同，确认更新操作确实修改了数据
  expect(resultBefore.data).not.toEqual(resultAfter.data);
});
```

**批量查询测试 (`read-many`)**：
```ts
import { expect, test } from "vitest";
import { astra } from "../../utils/test.ts";

/**
 * 调试测试：快速执行批量查询动作
 * 目的：在开发过程中快速验证 read-many 接口是否可正常调用，
 * 不做断言，仅用于调试和观察返回值。
 */
test("adjust", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  // 调试：执行单条查询动作（注意这里用 read 做快速调试）
  await world.execute("/application/read", { generateParams: true });
});

/**
 * 批量查询测试
 * 验证 read-many 接口能正确批量返回多条数据：
 * 1. 批量创建随机数量的数据，记录所有 ID
 * 2. 调用 read-many 接口，传入所有 ID
 * 3. 断言返回的数据条数与创建的条数一致
 */
test("basic", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  // 关键：清理数据库，确保测试环境干净，避免其他测试数据的干扰
  await world.cleanDatabase();

  // 批量创建随机数量的数据（0~32 条），模拟真实的批量场景
  const count = Math.floor(Math.random() * 33);
  // 收集所有创建数据的 ID，用于后续批量查询
  const ids: Array<string> = [];

  for (let i = 0; i < count; i++) {
    const [errorAdd, resultAdd] = await world.execute("/application/add", { generateParams: true });
    if (errorAdd) throw reject("创建失败", errorAdd);
    // 将每条新建数据的 ID 添加到数组中
    ids.push(resultAdd.id);
  }

  // 执行批量查询，传入所有创建数据的 ID 列表
  const [errorReadMany, resultReadMany] = await world.execute("/application/read-many", { generateParams: false, params: { ids } });
  if (errorReadMany) throw reject("批量查询失败", errorReadMany);

  // 断言：返回的数据条数应与创建的条数一致，确认批量查询返回了完整的结果
  expect(resultReadMany.data.length).toEqual(count);
});
```

### 测试用例注释

编写的测试需要包含详尽的中文注释，确保可读性。包括在测试开头添加多行注释，描述测试的意图，以及在测试的实际代码中，描述每一个步骤的作用。下面是一个实际的例子：

```ts
/**
 * 无效时间精度测试
 * 验证 effectiveAt 必须是 UTC 0 点整：
 * 1. 传入包含时分秒的时间（非 UTC 0 点）
 * 2. 应返回 INVALID_TIME_PRECISION 错误
 */
test('invalidTimePrecision', async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  await world.cleanDatabase();

  const invalidDate = new Date('2025-01-15T10:30:00Z');

  // 调用点数模块的动作，来添加用户的点数
  const [errorAdd, resultAdd] = await world.execute('/point/$exports/add', {
    generateParams: false,
    params: {
      userId: userSeed.id,
      points: 100,
      effectiveAt: invalidDate,
      days: 30,
      type: 'gift',
    },
  });

  // 断言：返回的错误码应该是 INVALID_TIME_PRECISION
  if (!errorAdd || !('INVALID_TIME_PRECISION' in errorAdd)) {
    throw reject('应该返回 INVALID_TIME_PRECISION 错误', errorAdd);
  }
});
```

### 测试策略建议
*   **成功路径测试**：如以上示例，验证动作在正常情况下的行为是否符合预期。
*   **失败路径测试**：**至关重要**。应编写测试来验证代码在边界条件、异常输入或非法操作下的处理逻辑是否正确（例如，传递非法ID、重复创建、权限不足等）。
*   **测试工具**：我们使用 **Vitest** 作为测试运行器。

## 错误处理规范

在动作代码中，使用 `throw context.reject("ERROR_CODE", undefined);` 抛出业务错误。

在测试代码中，请使用以下**正确方式**检查错误类型：

```typescript
// 正确：检查错误对象中是否存在特定的错误码属性
if ("VERIFICATION_CODE_INVALID" in error) {
    // 处理验证码无效的错误
}

if (!("VERIFICATION_CODE_INVALID" in error)) {
    // 处理其他类型的错误
}
```

**重要**：请勿使用以下方式判断错误类型，尽管它们可能在某些情况下运行正常，但会导致 TypeScript 类型推断不准确，违反项目规范：

```typescript
// 错误！禁止使用
expect(error?.code).toBe("VERIFICATION_CODE_INVALID");
expect(error?.VERIFICATION_CODE_INVALID).toBeDefined();
```

## 随机参数生成

编写测试时，你可以随机生成参数。当 `generateParams`: 设为 `true` 时，系统会自动生成所需参数。

```ts
// 示例：创建一个随机用户
const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
const [errorAdd, resultAdd] = await world.execute("/user/add", { generateParams: true });
if (errorAdd) throw reject("创建用户失败", errorAdd);
const userId = resultAdd.id;
```

当然，如果你指定了一些参数，那么这些参数将不会随机生成。

```ts
// 示例：创建一个随机用户，指定用户名
const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
const [errorAdd, resultAdd] = await world.execute("/user/add", { generateParams: true, params: { data: { username: "test-user" } } });
if (errorAdd) throw reject("创建用户失败", errorAdd);
const userId = resultAdd.id;
```

注意，这个自动生成数据的规则是"浅层"的，只针对 params 中的浅层参数有效，不会尝试递归生成深层的随机参数。

### generateParams 的取值

**`generateParams` 是必填字段**，每次调用 `world.execute` 都必须显式指定，不能省略：

- **`generateParams: true`**：自动生成符合接口类型定义的随机参数。适用于 `adjust` 调试测试，或当参数全部可以随机生成的场景。如果同时提供了 `params`，则 `params` 中指定的字段使用你的值，其余字段自动生成。
- **`generateParams: false`**：不自动生成参数，仅使用你提供的 `params`。**当你手动指定了 `params` 时必须设为 `false`**，否则 TypeScript 会报类型错误——因为 `generateParams: true` 的分支要求参数类型为可选，与手动传入的完整参数类型不兼容。

```ts
// 错误：有 params 但缺少 generateParams，会报类型错误
await world.execute("/application/read", { params: { id: newId } });

// 正确：手动指定参数时设为 false
await world.execute("/application/read", { generateParams: false, params: { id: newId } });

// 正确：不需要参数时也设为 false
await world.execute("/application/browse", { generateParams: false });

// 正确：调试时用 true 自动生成
await world.execute("/application/add", { generateParams: true });
```

### result 类型与非空断言

`world.execute` 返回的 `result` 中，某些属性的类型可能为 `null` 或 `undefined`（如 `result.data`、`result.voice` 等）。TypeScript 不会从 `expect(...).not.toBeNull()` 中推断类型窄化，因此在断言后访问这些属性仍需使用非空断言 `!`：

```ts
// 错误：result.data 可能为 undefined，TS 报错
const id = resultAdd.data.id;

// 正确：使用 ! 非空断言
const id = resultAdd.data!.id;

// 或者在 expect 断言之后
expect(resultInit.voice).not.toBeNull();
expect(resultInit.voice!.volume).toBe(50);
```

## 填充默认数据

在测试时，我们可能需要用到一些固定的种子数据，例如用户 ID、设备 ID 等。这些信息不能是随机的，否则和数据库中的数据不一致，可能会导致逻辑无法正常运行。

每个模块中，都有可能存在 `$seeds` 目录，这里会存储一些会被填充到数据库中的种子数据，例如默认的管理员账号等。下面，是一个使用用户 ID 进行测试的示例：

```ts
import { userSeed } from "../../modules/user/$seeds/user.seed.ts";

// 示例：使用默认用户 ID 进行测试
const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
const [errorAdd, resultAdd] = await world.execute("/foo/bar/baz", { generateParams: false, params: { userId: userSeed.id } });
```

对于后端服务器工程而言，一些常用的种子数据包括：

*   默认的用户账号：`/modules/user/$seeds/user.seed.ts` (userSeed)
*   默认的设备：`/modules/user/$seeds/user-device.seed.ts` (userDeviceSeed)
*   默认的用户属性（管理员）：`/modules/user/$seeds/user-property.seed.ts` (userPropertySeed)
*   默认的空间：`/modules/space/$seeds/space.seed.ts` (spaceUserDefaultSeed)