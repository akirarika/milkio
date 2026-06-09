# Events

Milkio 的事件系统是后端模块间通信的核心机制。模块之间不需要直接引用对方的代码，而是通过触发和监听事件来协作。事件系统支持三种触发模式——普通触发、全员审批和任意审批——使模块间既能广播通知，也能实现"审批制"的业务约束。

## 文件规范

### 事件定义

事件定义文件命名为 `*.event.ts`，放置在模块的 `$events` 目录下。每个文件必须导出一个名为 `_` 的 interface，其键为事件名（字符串），值为事件数据类型：

```
app/modules/payment/
├── $events/
│   └── validate-payment.event.ts
├── $handlers/
├── add.action.ts
└── ...
```

```ts
// /app/modules/payment/$events/validate-payment.event.ts
import type { Payment, paymentTable } from '../$databases/payment.table.ts';
import type { MilkioContext } from '../../../../.milkio/declares.ts';

export interface _ {
  /**
   * 支付校验
   * ⚠️ 一笔订单，必须订阅此事件，并显式地把 allow 改为 true，此支付才可以成功创建
   */
  'payment:validate': {
    data: typeof paymentTable.$inferSelect & { allow: boolean };
    fromModule: Payment['fromModule'];
    context: MilkioContext;
    tx: MilkioContext['db'];
  };
  /** 支付成功 */
  'payment:paid': {
    data: typeof paymentTable.$inferSelect;
    fromModule: Payment['fromModule'];
    context: MilkioContext;
    tx: MilkioContext['db'];
  };
}
```

### 事件命名约定

- **冒号分隔**：事件名使用冒号 `:` 作为命名空间分隔符，格式为 `模块名:动作`，如 `payment:validate`、`user:login`、`space:delete`
- **`app:` 前缀**：以 `app:` 开头的事件会自动推送到前端（在 `watch.stream.ts` 中通过 `key.startsWith('app:')` 过滤）
- **`life-cycle:` 前缀**：生命周期事件，由框架触发，用于初始化流程（如 `life-cycle:mounted`）
- **`milkio:` 前缀**：框架内部事件，如 `milkio:executeBefore`、`milkio:httpRequest`、`milkio:httpResponse`
- **其他前缀**：如 `payment:`、`user:`、`storage:`、`captcha:` 等，是服务端内部事件，不会推送到前端

### 事件监听

事件监听文件命名为 `*.handler.ts`，放置在模块的 `$handlers` 目录下。每个文件导出一个默认函数，接收 `world` 参数，通过 `world.on()` 注册事件监听：

```ts
// /app/modules/payment/$handlers/handle-payment.handler.ts
import type { MilkioWorld } from 'milkio';
import type { generated } from '../../../../.milkio/index.ts';

export default (world: MilkioWorld<typeof generated>) => {
  world.on('payment:validate', async ({ data, tx, context, fromModule }) => {
    // 只处理特定模块的支付
    if (fromModule !== 'order') return;

    // 校验金额、币种等...
    if (data.amount !== 399) {
      throw context.reject('PAYMENT_ADD_FAILED', undefined);
    }

    // ✅ 审批通过：显式设置 allow 为 true
    data.allow = true;
  });

  world.on('payment:paid', async ({ data, tx, context, fromModule }) => {
    if (fromModule !== 'order') return;
    // 处理支付成功后的业务逻辑...
  });
};
```

## emit 的三种变体

### `context.emit(key, value)` — 普通触发

**返回值**：`Promise<void>`

纯广播模式。触发事件后，所有监听该事件的 handler 都会被执行，但触发方不关心 handler 的返回值。

```ts
// 支付回调中，广播支付成功事件
await context.emit('payment:paid', {
  data: payment,
  fromModule: payment.fromModule,
  context,
  tx: context.db,
});
```

```ts
// 用户登录后，广播登录事件，由其他模块响应
await context.emit('user:login', { context, db: context.db, data: user });
```

普通 `emit` 适合"通知型"场景——事件触发后，订阅方各自执行自己的逻辑，触发方不需要知道结果。

---

### `context.emitAllApproved(key, value)` — 全员审批

**返回值**：`Promise<boolean>`

所有订阅了该事件的 handler 都必须返回 `true`（或不抛出异常），`emitAllApproved` 才返回 `true`。只要有**任何一个** handler 抛出异常，整个审批就会失败（抛出异常），`emitAllApproved` 不会返回 `false`——而是直接将异常向上抛出。

这是最严格的审批模式，适用于**所有相关方都必须同意**的场景。

```ts
// 发送验证码前，必须通过验证码校验
await context.emitAllApproved('captcha:validate', { context, ...params.captcha });
// 如果 captcha 模块的 handler 抛出异常，上面的代码也会抛出异常，后续逻辑不会执行
```

在项目中，`captcha:validate` 事件目前只有一个 handler，所以 `emitAllApproved` 和 `emitAnyApproved` 效果相同。但使用 `emitAllApproved` 的语义是：**所有**验证都必须通过，如果未来增加更多验证方式，它们全部通过才算通过。

#### 审批模式的数据约定

使用审批模式时，事件数据中通常包含一个 `allow` 字段。handler 通过将 `data.allow` 设为 `true` 来表示审批通过：

```ts
// 触发方
const emitData = {
  data: { ...paymentData, allow: false },  // 初始 allow 为 false
  fromModule: 'order',
  context,
  tx: context.db,
};

// ⚠️ 这里用普通 emit，然后手动检查 allow
await context.emit('payment:validate', emitData);

if (!emitData.data.allow) {
  throw context.reject('PAYMENT_ADD_FAILED', undefined);
}
```

> **注意**：上面的 `payment:validate` 使用的是普通 `emit` + 手动检查 `allow` 的模式。这是因为 `payment:validate` 事件在 `emit` 期间可能需要修改 `data` 对象，触发方在 `emit` 返回后检查 `allow`。而 `emitAllApproved` / `emitAnyApproved` 则是直接通过返回值判断，handler 通过 `return true` 或设置 `data.allow = true` 来表示同意。

---

### `context.emitAnyApproved(key, value)` — 任意审批

**返回值**：`Promise<boolean>`

只要有**任意一个**订阅了该事件的 handler 返回 `true`（或将 `data.allow` 设为 `true`），`emitAnyApproved` 就返回 `true`。如果所有 handler 都没有返回 `true` 也没有设置 `data.allow = true`，则返回 `false`。

与 `emitAllApproved` 不同，**单个 handler 抛出异常不会导致整体失败**——只要有一个 handler 审批通过即可。

```ts
// 下载鉴权：只要有任意一个模块允许下载即可
const allow = await context.emitAnyApproved('sync:akira-storage:download-validate', emitData);
if (!allow) {
  context.logger.error('鉴权未被通过', emitData);
  throw context.reject('REQUEST_FAIL', undefined);
}
```

`emitAnyApproved` 适合"多鉴权源"场景——多个模块可能都有权放行，只要有一个模块同意即可。

---

### 三种变体对比

| 方法 | 返回值 | handler 抛异常时 | handler 返回 true 时 | 典型场景 |
|------|--------|-----------------|---------------------|---------|
| `emit` | `Promise<void>` | 异常向上抛出 | 忽略返回值 | 广播通知（登录、删除） |
| `emitAllApproved` | `Promise<boolean>` | 整体失败，异常向上抛出 | 全部 true 才返回 true | 全员审批（验证码、支付校验） |
| `emitAnyApproved` | `Promise<boolean>` | 不影响，继续检查其他 handler | 任一 true 即返回 true | 多源审批（下载鉴权） |

---

## 典型用法

### 1. 广播通知 — 用户登录

用户登录后，需要初始化空间、刷新缓存等，这些逻辑分散在不同模块中。通过 `user:login` 事件解耦：

**定义事件** `$events/user.event.ts`：

```ts
export interface _ {
  'user:login': {
    data: typeof userTable.$inferInsert;
    context: MilkioContext;
    db: MilkioContext['db'];
  };
}
```

**触发事件** `device/login/1-guest-login.action.ts`：

```ts
await context.emit('user:login', { context, db: context.db, data: user });
```

**监听事件** `space/$handlers/init-space.handler.ts`：

```ts
export default (world: MilkioWorld<typeof generated>) => {
  world.on('user:login', async ({ data, db, context }) => {
    // 为用户初始化默认空间
    const usrId = `usr:${data.id}`;
    // ...创建空间...
  });
};
```

### 2. 全员审批 — 验证码校验

发送短信/邮件验证码前，必须先通过验证码（CAPTCHA）校验。使用 `emitAllApproved` 确保**所有**验证都通过：

**定义事件** `$events/captcha.event.ts`：

```ts
export interface _ {
  'captcha:validate': {
    context: MilkioContext;
    scene: 'login' | 'safety';
    ret: number;
    ticket?: string;
    randstr: string;
  };
}
```

**触发审批** `user/device/login/2-captcha.action.ts`：

```ts
// 所有 captcha:validate 的 handler 都必须通过，否则抛出异常
await context.emitAllApproved('captcha:validate', { context, ...params.captcha });
// 通过后，继续发送验证码...
```

**处理审批** `captcha/$handlers/captcha.handler.ts`：

```ts
export default (world: MilkioWorld<typeof generated>) => {
  world.on('captcha:validate', async (event) => {
    // 调用验证码服务校验
    const result = await client.DescribeCaptchaResult({ ... });
    // 验证失败直接抛异常，阻止整个流程
    if (result.CaptchaCode !== 1 || (result.EvilLevel ?? 0) >= 80) {
      throw event.context.reject('CAPTCHA_INVALID', undefined);
    }
    return true;  // 验证通过
  });
};
```

### 3. 任意审批 — 下载鉴权

文件下载鉴权时，多个模块可能都有权放行（不限速下载、抢先体验等），只要有一个模块同意即可：

**定义事件** `$events/akira-storage.event.ts`：

```ts
export interface _ {
  'sync:akira-storage:download-validate': {
    url: string;
    timestamp: number;
    usageType: string;
    data: Record<string, any>;
    context: MilkioContext;
    db: MilkioContext['db'];
  };
}
```

**触发审批** `sync/akira-storage/eo-download-remote-auth.action.ts`：

```ts
const allow = await context.emitAnyApproved('sync:akira-storage:download-validate', emitData);
if (!allow) {
  context.logger.error('鉴权未被通过', emitData);
  throw context.reject('REQUEST_FAIL', undefined);
}
```

**处理审批** `subscription/$handlers/handle-storage-download-validate.handler.ts`：

```ts
export default (world: MilkioWorld<typeof generated>) => {
  world.on('sync:akira-storage:download-validate', async ({ data }) => {
    // 订阅模块允许下载
    data.allow = true;
  });
};
```

### 4. 手动审批 — 支付校验

支付创建时使用普通 `emit` + 手动检查 `data.allow` 的模式。这种模式允许在事件触发过程中修改数据，触发方在事件返回后再做判断：

**触发并检查** `payment/add.action.ts`：

```ts
const emitData = {
  data: { ...paymentData, allow: false },  // allow 初始为 false
  fromModule: params.fromModule,
  context,
  tx: context.db,
};

await context.emit('payment:validate', emitData);

// 事件处理完成后，检查是否有模块审批通过
if (!emitData.data.allow) {
  throw context.reject('PAYMENT_ADD_FAILED', undefined);
}
// 审批通过，继续创建支付订单...
```

**处理审批** `product/$handlers/handle-payment.handler.ts`：

```ts
world.on('payment:validate', async ({ data, tx, context, fromModule }) => {
  if (fromModule !== 'product') return;

  // 校验金额、币种等...
  if (!validatePaymentData(data)) throw context.reject('PAYMENT_ADD_FAILED', undefined);

  // 审批通过
  data.allow = true;
});
```

> 这种模式与 `emitAllApproved` 的区别在于：handler 通过修改 `data.allow` 而非返回值来审批，触发方在 `emit` 返回后自行检查。这适用于需要在同一个 `data` 对象上传递更多信息的场景。

### 5. 级联事件 — 用户删除触发空间删除

用户删除后，需要级联清理空间、存储、同步文档等。通过 `user:remove` → `space:delete` 的事件链实现：

```ts
// /app/modules/user/task-auto-remove.action.ts
await context.emit('user:remove', { data: user, context, db: context.db });

// /app/modules/space/$handlers/cleanup-user-spaces.handler.ts
world.on('user:remove', async ({ data, context, db }) => {
  // 标记用户的空间为删除
  await db.update(spaceTable).set({ deletedAt: new Date() }).where(...);
  // 触发空间删除事件
  await context.emit('space:delete', { data: space, context, db });
});

// /app/modules/storage/$handlers/clear-storage.handler.ts
world.on('space:delete', async ({ data, db, context }) => {
  // 清理空间下的存储文件
  await db.delete(storageTable).where(eq(storageTable.spaceId, data.id));
});

// /app/modules/sync-document/$handlers/clear-sync-document.handler.ts
world.on('space:delete', async ({ data, db, context }) => {
  // 清理空间下的同步文档
  await db.delete(syncDocumentTable).where(eq(syncDocumentTable.spaceId, data.id));
});
```

---

## 事件数据中的公共字段

在项目实践中，事件数据通常包含以下公共字段，以便 handler 获取上下文：

| 字段 | 类型 | 说明 |
|------|------|------|
| `context` | `MilkioContext` | 当前请求上下文，包含用户信息、配置、日志等 |
| `db` | `MilkioContext['db']` | 数据库实例（非事务） |
| `tx` | `MilkioContext['db']` | 事务实例（如果触发方在事务中） |
| `data` | 各种类型 | 事件的核心数据 |
| `fromModule` | `string` | 触发来源模块标识，用于 handler 过滤 |

---

## 最佳实践

1. **审批事件必须检查 `fromModule`**：handler 应先判断 `fromModule` 是否是自己关心的模块，避免误处理其他模块的事件。
2. **`emitAllApproved` 用于安全关键路径**：如验证码校验、支付校验等，确保所有校验都通过才继续。
3. **`emitAnyApproved` 用于多源授权**：如下载鉴权，多个模块可能都有权放行。
4. **审批通过时显式设置 `data.allow = true`**：不要依赖隐式逻辑，`allow` 默认为 `false`，handler 必须显式同意。
5. **审批失败时抛异常而非返回 false**：`emitAllApproved` 的 handler 如果校验失败，应 `throw context.reject(...)` 抛出异常，而非默默返回 `false`。
6. **非 `app:` 前缀的事件不会推送前端**：服务端内部事件不要使用 `app:` 前缀，避免不必要的推流。
7. **事件数据传引用**：事件数据对象是引用传递，handler 可以修改 `data.allow` 等字段，触发方可以在 `emit` 返回后读取修改后的值。
8. **事务中使用 `tx` 而非 `db`**：如果触发方在事务中，事件数据应传递 `tx`，让 handler 的操作也在同一事务中。
