# Create Stargate

Stargate 是 Milkio 的客户端通信 SDK。每个需要与 Milkio 后端通信的工程，都需要创建一个 stargate 实例。

**重要**：stargate 实例仅供 embed（前端状态管理器）和 server（后端服务器）等 Milkio 工程内部使用。**前端 vue 工程（如 `kecream-app`）不得直接使用 stargate 调用 server 端点**，必须通过 `aurora.ipc.execute` 调用 embed 端点来间接通信。详见 SKILL.md 中"前端必须通过 embed 与后端通信"章节。

## 创建实例

```ts
// /app/utils/stargate.ts
import type { generated } from '../../../todo-server/.milkio';

export const stargate = await createStargate<typeof generated>({
  baseUrl: 'http://localhost:9000',
});
```

### 配置项

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `baseUrl` | `string \| (() => string) \| (() => Promise<string>)` | 是 | 后端服务地址，支持函数形式（可用于延迟计算） |
| `timeout` | `number` | 否 | 请求超时时间（毫秒），默认 `6000` |
| `fetch` | `typeof fetch` | 否 | 自定义 fetch 实现，用于非浏览器环境 |
| `abort` | `typeof AbortController` | 否 | 自定义 AbortController 实现 |
| `cacheStorage` | `CacheStorage` | 否 | 自定义缓存存储，配合 `cacheStrategy` 使用 |
| `cacheEncryption` | `boolean` | 否 | 是否启用缓存加密，默认使用 AES-CTR |

### baseUrl 动态配置

在实际项目中，`baseUrl` 通常需要根据运行环境动态确定：

```ts
const isClient = typeof window !== 'undefined';

export const stargate = await createStargate<typeof generated>({
  baseUrl: (() => {
    if (import.meta.env.MODE === 'prod-zh-cn' && isClient) return 'https://zh-cn.server.example.com';
    if (import.meta.env.MODE === 'prod-zh-cn' && !isClient) return 'https://internal-api.example.com';
    if (import.meta.env.MODE?.startsWith('prod-') && isClient) return 'https://en.server.example.com';
    return 'http://localhost:9000';
  })(),
});
```

## 事件钩子

Stargate 提供三个事件钩子，用于在请求的不同阶段进行拦截处理。

### `milkio:executeBefore`

请求执行前触发，可用于添加通用请求头：

```ts
stargate.on('milkio:executeBefore', async (event) => {
  // event.path: 请求路径
  // event.options.headers: 请求头对象
  event.options.headers['X-Custom-Header'] = 'value';
});
```

### `milkio:fetchBefore`

实际发送 HTTP 请求前触发，此时请求体（body）已序列化完毕，可用于签名等操作：

```ts
const headerPrefix = 'Milkio';

stargate.on('milkio:fetchBefore', async (event) => {
  const timestamp = Date.now();
  event.options.headers[`${headerPrefix}-Timestamp`] = `${timestamp}`;

  // 添加 Authorization 头
  const accessToken = await getAccessToken();
  if (accessToken) {
    event.options.headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // 生成签名
  const signContent = `${timestamp}#${event.path}#${event.body}#${signQuery}`;
  const signature = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signContent));
  event.options.headers[`${headerPrefix}-Signature`] = /* 签名结果 */;
});
```

### `milkio:executeError`

请求执行出错时触发，可用于统一的错误处理（如登录过期跳转）：

```ts
stargate.on('milkio:executeError', async (event) => {
  // event.path: 请求路径
  // event.error: 错误对象
  // event.handleError: 错误处理辅助函数

  if ('INVALID_TOKEN' in event.error || 'LOGIN_REQUIRED' in event.error) {
    // 处理登录过期...
    await logout();
    return;
  }

  // 使用 handleError 处理特定错误码
  await event.handleError(event.error, 'SPECIFIC_ERROR', (err) => {
    // 返回 true 表示已处理，错误会从 error 对象中移除
    handleSpecificError(err);
    return true;
  });
});
```

## 缓存策略

`stargate.execute` 的 `cacheStrategy` 选项支持三种模式：

| 策略 | 说明 |
|------|------|
| `'off'`（默认） | 不使用缓存 |
| `'fallback'` | 网络请求失败时回退到缓存数据 |
| `'throttle'` | 在 `cacheThrottleMs` 毫秒内直接返回缓存，过期后重新请求 |

使用示例：

```ts
const [error, result, details] = await stargate.execute('/user/read-my', {
  cacheStrategy: 'throttle',
  cacheThrottleMs: 5000,
  onCacheHit: (cachedResult) => {
    // 缓存命中时回调，可用于乐观更新 UI
  },
});
```

如果需要自定义缓存存储（默认使用 IndexedDB），可以在创建 stargate 时传入 `cacheStorage`：

```ts
const stargate = await createStargate<typeof generated>({
  baseUrl: 'http://localhost:9000',
  cacheStorage: {
    get: async (key) => { /* 返回 { data, timestamp } 或 null */ },
    set: async (key, data) => { /* 存储数据 */ },
  },
  cacheEncryption: true, // 启用缓存加密
});
```

## 重试策略

通过 `retryStrategy` 选项配置网络错误时的自动重试：

```ts
const [error, result, details] = await stargate.execute('/user/read-my', {
  retryStrategy: true, // 默认重试 2 次
  // 或指定具体次数
  // retryStrategy: 3,
});
```

仅在**网络错误**时重试，业务错误（如 `DATA_NOT_FOUND`）不会触发重试。

## Ping 方法

`stargate.ping()` 用于检测与服务端的连通性和延迟：

```ts
const [error, result] = await stargate.ping();

if (error) {
  console.log('连接失败', error.error);
} else {
  console.log('连接成功，延迟', result.delay, 'ms');
  console.log('服务器时间戳', result.serverTimestamp);
}
```

## 类型工具

`stargate.$types` 提供了完整的类型信息，可用于泛型约束等场景：

```ts
type Paths = keyof stargate.$types.generated['routeSchema'];
type ParamsOf<P extends Paths> = stargate.$types.params[P];
type ResultOf<P extends Paths> = stargate.$types.results[P];
type ErrorCode = stargate.$types.error;
```

## 多 Stargate 实例

当项目需要同时与多个后端通信时，可以创建多个 stargate 实例。例如，主应用同时与云端后端和 Electron 主进程通信：

```ts
// 主 stargate（与云端后端通信）
export const stargate = await createStargate<typeof generated>({
  baseUrl: 'https://zh-cn.server.example.com',
});

// Electron stargate（与 Electron 主进程通信）
export const electronStargate = await createStargate<typeof electronGenerated>({
  baseUrl: 'http://localhost:9006',
});
```
