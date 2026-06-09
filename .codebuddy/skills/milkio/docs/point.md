# Point

## 概述

端点是若干个以 `.action.ts` 结尾的文件，使用小写字母+中划线命名，采用动词命名。

通常，一个模块会包含五个端点，即 BREAD。BREAD 是 browse.action.ts (浏览)、read.action.ts(读取单个)、edit.action.ts(编辑)、add.action.ts(添加)、delete.action.ts(删除) 的缩写。

一般而言，每个模块，都包含这五个端点，但是，有些模块可能不需要这么多，例如一些只读性质的模块。又或者，可能会拥有更多的端点，例如用户模块，除了以上五个端点之外，还包含 login.action.ts、logout.action.ts、register.action.ts 这种特殊的端点。

端点需要存放在 `/app/modules` 目录下。例如：

```
/app/modules/user/$databases/user.table.ts
/app/modules/user/edit.action.ts
```

## 示例

```
// /app/modules/application/add.action.ts
import { MilkioContext, MilkioMeta } from '../../../.milkio/declares.ts';

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
  const id = ...;
  // 执行添加逻辑...
  return { id };
};
```

这是一个典型的端点。必须强调，你必须显式定义 `Params` 和 `Result` 的类型，不编写类型由编译器推导是严格禁止的。

注意，返回值必须是一个 object 对象，你不能返回数组或者原始类型（如字符串、数字等）。因此，示例中的返回值使用对象包裹，而不是直接返回。

## 类型校验

`Params` 类型决定了你的端点可以接受哪些值。Milkio 会自动使用 typia 来确保接收到的值符合 `Params` 的类型。任何不符合你方法预期类型的输入都将被拒绝，而任何符合类型要求的额外属性将被移除。

Typia 通过分析你的代码并执行 AOT（提前）编译，将代码中的验证部分转换为适合你类型的专有代码。即使代码被捆绑成了普通的 javascript 类型校验也依然有效。

## 测试

你必须编写完善且详细的测试用例，采用集成测试的思路，通过按照指定顺序调用一个或多个端点，最终验证数据是否被正确处理（你每次运行测试之前，状态/数据库都会被清空）。

你应该在对应模块的目录下创建一个 `__TEST__.test.ts`，在里面存放该模块所有相关的测试代码。每个模块只应有一个测试文件，将模块中所有端点的测试集中放在这个文件中。

```
// /app/modules/application/__TEST__.test.ts
test("test-bar", async () => {
    const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, result] = await world.execute("/application/add", {
        generateParams: true
    });
    if (error) throw reject('测试失败', error);
    expect(typeof result.id).toBe('string');
 });
```

注意，测试过程中是启动了真实 HTTP 服务器，因此，工程代码与测试代码没有运行在一个实例中，他们内存不共享。

## 日志

你必须编写详尽的日志，以便在排查问题时能够快速定位原因。Milkio 提供了 `context.logger` 日志器，支持 `info` 和 `error` 两个方法。

### `context.logger.info(message, ...data)`

记录常规信息日志，用于记录关键的业务流程节点和操作结果。

```ts
export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
    context.logger.info('端点请求参数 (edit-phone.action.ts)', JSON.stringify(params));

  // 记录关键业务操作
  context.logger.info('手机号修改成功 (edit-phone.action.ts)', JSON.stringify({
    userId: currentUser.id,
    oldPhone: currentUser.phone,
    newPhone: params.phone,
  }));

  // 记录外部服务调用结果
  context.logger.info('短信发送结果 (edit-phone.action.ts)', JSON.stringify(result));
  
  const result = { foo: 'bar' };
  context.logger.info('端点请求结果 (edit-phone.action.ts)', JSON.stringify(result));
  
  return result;
};
```

### `context.logger.error(message, ...data)`

记录错误日志，用于在业务校验失败或异常情况时记录详细信息。**注意**：`logger.error` 只负责记录日志，不会中断执行流程。如果你需要在记录错误后中断请求，必须在下一行 `throw context.reject(...)`。

```ts
export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  if (!params.phone) {
    // 先记录错误日志，再抛出拒绝
    context.logger.error('新手机号不能为空 (edit-phone.action.ts)', JSON.stringify(params));
    throw context.reject('DATA_NOT_FOUND', undefined);
  }

  if (!currentUser) {
    context.logger.error('用户不存在 (edit-phone.action.ts)', JSON.stringify(params));
    throw context.reject('DATA_NOT_FOUND', undefined);
  }
};
```

1. **必须记录关键业务操作**：如登录成功、数据修改、支付创建等，确保重要操作有迹可循。
2. **错误日志必须附带上下文数据**：记录错误时应将相关的参数一并传入，方便排查。例如 `context.logger.error('用户不存在', JSON.stringify(params))` 而非仅 `context.logger.error('用户不存在')`。
3. **消息中标注来源**：在日志消息中用括号标注当前文件名，如 `'用户不存在 (edit-phone.action.ts)'`，方便在海量日志中快速定位来源。
4. **请求与响应日志**:一个合适的 action 端点尽可能保证要有一条参数日志，一条打印返回值日志。当然，没有任何参数，或者没有任何返回值的端点，可以不记录。
5. **还原现场**：日志要尽可能地详细，出现任何问题时，你只能得到日志作为参考。如果不够详细，你将无法推断和修复错误。
6. **对象必须使用 `JSON.stringify` 包裹**：日志中的对象参数必须用 `JSON.stringify()` 序列化后传入，避免某些运行时环境下对象被输出为 `[object Object]` 而丢失信息。例如 `context.logger.info('请求参数', JSON.stringify(params))` 而非 `context.logger.info('请求参数', params)`。

## 端点编码规范

在编写端点代码时，你必须遵循以下规则：

1. **过程式编程**：所有功能采用过程式风格实现。
2. **禁止使用 class、enum 和 interface**：不得在端点代码中使用 `class` 或 `interface` 关键字，所有类型定义必须使用 `type`。对于 enum 类型，可以 `type Qux = 'foo' | 'bar'` 这种为字符串添加类型约束来实现。
3. **禁止私有函数封装**：不得将逻辑封装为仅被调用一两次的非导出函数。这只会增加复杂度和维护成本，且破坏了从上到下线性阅读的代码风格。只有对外导出的函数（如 `export function ... {}`）才是允许的。
4. **详尽的注释**：必须添加详细清晰的注释。修改代码时，若注释与代码不一致，必须同步更新注释。严格确保注释与代码都含义一致。

```ts
// ❌ 坏例子 1：将逻辑封装到仅被调用一次的私有函数中
async function createFoo(context: MilkioContext) {
  // ...创建 Foo 的逻辑...
}

async function updateBar(context: MilkioContext, id: string) {
  // ...更新 Bar 的逻辑...
}

async function notifyUser(context: MilkioContext, userId: string) {
  // ...发送通知的逻辑...
}

export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  // 仅仅是为了"组织代码"而拆分出多个函数，实际上每个函数只在这里被调用一次
  // 这增加了代码的复杂度，阅读者需要在多个函数之间跳转才能理解完整流程
  await createFoo(context);
  await updateBar(context, params.id);
  await notifyUser(context, params.userId);
  // ...其余逻辑...
};
```

```ts
// ❌ 坏例子 2：使用 class 来组织端点逻辑
class FooService {
  private context: MilkioContext;

  constructor(context: MilkioContext) {
    this.context = context;
  }

  async createFoo() {
    // ...创建 Foo 的逻辑...
  }

  async updateBar(id: string) {
    // ...更新 Bar 的逻辑...
  }

  async notifyUser(userId: string) {
    // ...发送通知的逻辑...
  }
}

export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  // 端点逻辑不应该用 class 封装，class 增加了不必要的抽象层
  const service = new FooService(context);
  await service.createFoo();
  await service.updateBar(params.id);
  await service.notifyUser(params.userId);
  // ...其余逻辑...
};
```

```ts
// ❌ 坏例子 3：封装仅被调用两次的工具函数，破坏了线性阅读
function buildNotificationPayload(userId: string, message: string) {
  // ...构建通知载荷的逻辑...
}

async function createFoo(context: MilkioContext) {
  // ...创建 Foo 的逻辑...
  const payload = buildNotificationPayload(context.userId, 'Foo 已创建');
  // ...发送通知...
}

async function updateBar(context: MilkioContext) {
  // ...更新 Bar 的逻辑...
  const payload = buildNotificationPayload(context.userId, 'Bar 已更新');
  // ...发送通知...
}

export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  await createFoo(context);
  await updateBar(context);
  // ...其余逻辑...
};
```

```ts
// ✅ 好例子：采用过程式风格，从上到下线性阅读，逻辑一目了然
export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  // 创建 Foo
  // ...创建 Foo 的逻辑...

  // 更新 Bar
  // ...更新 Bar 的逻辑...

  // 发送通知
  // ...发送通知的逻辑...

  // 返回结果
  return { ... };
};
```

```ts
// ✅ 好例子：即使逻辑较长，也保持在 handler 内部线性展开，辅以清晰的注释分段
export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  // ========================================================================
  // 参数校验与预处理
  // ========================================================================
  // ...校验参数的逻辑...
  // ...预处理数据的逻辑...

  // ========================================================================
  // 核心业务逻辑
  // ========================================================================
  // ...执行主要业务逻辑...

  // ========================================================================
  // 数据持久化
  // ========================================================================
  // ...写入数据库的逻辑...

  // ========================================================================
  // 后置操作（通知、日志等）
  // ========================================================================
  // ...发送通知的逻辑...
  // ...记录日志的逻辑...

  // ========================================================================
  // 返回结果
  // ========================================================================
  return { ... };
};
```