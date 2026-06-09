# Bootstrap

## 概述

Bootstrap 是 Milkio 的启动引导机制，用于在服务启动时初始化中间件、数据库连接、缓存等基础设施。Bootstrap 分为两种：**全局 Bootstrap** 和 **模块级 Bootstrap**。

## 全局 Bootstrap

全局 Bootstrap 在项目入口文件 `index.ts` 中注册，在服务启动时按顺序执行。

### 注册方式

```ts
// /index.ts
import { createWorld, type MilkioInit } from 'milkio';
import { generated } from './.milkio/index.ts';
import { configSchema } from './.milkio/config-schema.ts';
import { loadDrizzle } from './app/bootstrap/drizzle/index.ts';
import { loadRedis } from './app/bootstrap/redis/index.ts';
import { loadUserAuth } from './app/modules/user/$bootstraps/user-auth.ts';

export async function create(options: MilkioInit) {
  const world = await createWorld(generated, configSchema, {
    ...options,
    bootstraps: [loadRedis, loadDrizzle, loadUserAuth],
  });

  return world;
}
```

**注意**：Bootstrap 的注册顺序很重要——Redis 应在 Drizzle 之前加载，认证应在数据库之后加载。

### 典型全局 Bootstrap 示例

#### 数据库连接（Drizzle）

```ts
// /app/bootstrap/drizzle/index.ts
import { drizzle } from 'drizzle-orm/mysql2';

export const loadDrizzle = async (world: MilkioWorld<typeof generated>) => {
  const connection = await mysql.createConnection(world.config.drizzle.url);
  const db = drizzle(connection, { schema, mode: 'default' });

  world.on('milkio:executeBefore', async (event) => {
    event.context.db = db;
  });
};
```

#### Redis 连接

```ts
// /app/bootstrap/redis/index.ts
import Redis from 'ioredis';

export const loadRedis = async (world: MilkioWorld<typeof generated>) => {
  const redis = new Redis(world.config.redis.url);

  world.on('milkio:executeBefore', async (event) => {
    event.context.redis = createRedisHelper(redis);
  });
};
```

## 模块级 Bootstrap（$bootstraps）

模块级 Bootstrap 放在模块的 `$bootstraps` 目录下，用于实现模块专属的启动逻辑，通常是认证中间件等。

### 目录结构

```
app/modules/user/
├── $bootstraps/
│   └── user-auth.ts     # 用户认证引导
├── $caches/
├── $databases/
└── ...
```

### 示例：用户认证中间件

```ts
// /app/modules/user/$bootstraps/user-auth.ts
import { type MilkioWorld } from 'milkio';
import type { generated } from '../../../../.milkio/index.ts';

export const loadUserAuth = async (world: MilkioWorld<typeof generated>) => {
  world.on('milkio:executeBefore', async (event) => {
    const authorization = event.context.http.request.headers.get('authorization');
    const accessToken = (authorization ?? '').slice(7); // "Bearer ".length

    if (!accessToken || accessToken.length !== 64) {
      // 未携带 Token
      event.context.userProperties = [{ key: 'guest', permanent: true, id: ':guest' }];
      if (event.meta.allow && event.meta.allow.includes('guest')) return;

      // 测试环境放通
      if (world.config.mode === 'test') {
        console.log('⚠️ 该接口需登录，但未在请求中传递 token，测试环境下请求放通');
        return;
      }

      throw event.reject('LOGIN_REQUIRED', undefined);
    }

    // 通过 Token 查询用户信息...
    const user = await getUserByToken(event.context, accessToken);
    if (!user) {
      throw event.reject('INVALID_TOKEN', undefined);
    }

    event.context.userDevice = user.userDevice;
    event.context.userProperties = user.properties;
  });
};
```

### 关键要点

1. **`milkio:executeBefore` 事件**：模块级 Bootstrap 通常通过监听此事件实现请求拦截。
2. **`event.context`**：可以在 context 上挂载自定义属性（如 `userDevice`、`userProperties`），后续 action 中可通过 `context.userDevice` 等访问。
3. **`event.meta.allow`**：action 的 `meta.allow` 数组用于声明允许的访问方式（如 `['guest']` 表示允许未登录访问）。
4. **`event.reject()`**：认证失败时使用 `event.reject()` 抛出错误，与 action 中的 `context.reject()` 用法相同。

## 全局 Bootstrap vs 模块级 Bootstrap

| 维度 | 全局 Bootstrap | 模块级 Bootstrap |
|------|---------------|-----------------|
| 位置 | `app/bootstrap/` | `app/modules/{模块}/$bootstraps/` |
| 注册 | 在 `index.ts` 的 `bootstraps` 数组中 | 同样在 `index.ts` 的 `bootstraps` 数组中 |
| 用途 | 基础设施（数据库、Redis、日志） | 业务中间件（认证、权限） |
| 作用域 | 全局 | 通常只关注特定模块的逻辑 |
| 典型示例 | Drizzle、Redis、CDN 配置、签名验证 | 用户认证 |

## 可用的事件钩子

Bootstrap 中可以监听以下 Milkio 框架事件：

| 事件名 | 触发时机 | 常见用途 |
|--------|---------|---------|
| `milkio:executeBefore` | 每个 API 请求执行前 | 认证、注入 context 属性 |
| `milkio:httpRequest` | HTTP 请求到达时 | 日志、限流 |
| `milkio:httpResponse` | HTTP 响应发送前 | 日志、响应头修改 |

## 最佳实践

1. **顺序很重要**：全局 Bootstrap 的注册顺序决定了初始化顺序和事件监听优先级。
2. **测试环境放通**：认证 Bootstrap 应在测试环境下放通请求，方便测试。
3. **错误提前抛出**：在 `milkio:executeBefore` 中发现不合法请求时，应立即 `throw event.reject()`，不要让请求继续执行。
4. **context 挂载**：通过在 context 上挂载属性（如 `context.userDevice`），可以在后续的 action 中直接使用，避免重复查询。
