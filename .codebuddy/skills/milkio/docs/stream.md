# Stream

## 概述

Stream 端点（`.stream.ts`）是 Milkio 中实现服务端实时推送的机制。与 action 端点的一次性请求-响应不同，stream 端点基于 Server-Sent Events (SSE) 建立持久连接，服务端可以持续向客户端推送数据。

## 文件规范

### 命名与位置

Stream 文件以 `.stream.ts` 结尾，放在模块目录下，与 `.action.ts` 文件同级：

```
app/modules/event/
├── watch.stream.ts      # 事件订阅流
└── ...
```

### 路由映射

Stream 文件的路由映射规则与 action 相同：`app/modules/event/watch.stream.ts` 映射为 `/event/watch~`。注意路径末尾的 `~` 后缀用于区分 stream 和 action。

## 定义 Stream 端点

Stream 端点使用 `async function*`（异步生成器）定义：

```ts
// /app/modules/event/watch.stream.ts
import { createFlow } from 'milkio';
import type { MilkioContext, MilkioMeta } from '../../../.milkio/declares';

export const meta: MilkioMeta = {};

export async function* handler(
  context: MilkioContext,
  params: {},
): AsyncGenerator<{ key: string; data: any }> {
  const flow = createFlow<{ key: string; data: any }>();

  // 监听所有事件
  context._.on('*', ({ key, value }) => {
    // 只推送特定前缀的事件
    if (!key.startsWith('app:')) return;
    flow.emit({ key, data: value });
  });

  // 触发生命周期事件，通知前端初始化完成
  void context.emit('life-cycle:mounted', context).then(() =>
    flow.emit({ key: 'app:life-cycle:after-mounted', data: undefined })
  );
  flow.emit({ key: 'life-cycle:mounted', data: undefined });

  // 持续产出数据
  for await (const chunk of flow) yield chunk;
}
```

## 核心概念

### createFlow

`createFlow` 是 Milkio 提供的流控工具，用于创建一个可手动触发的异步流：

```ts
import { createFlow } from 'milkio';

const flow = createFlow<{ key: string; data: any }>();

// 手动向流中推送数据
flow.emit({ key: 'app:tabs', data: tabData });

// 通过 for await 消费流
for await (const chunk of flow) {
  yield chunk;
}
```

`createFlow` 桥接了事件回调和异步生成器——你可以在任意回调中调用 `flow.emit()`，而生成器会自动将数据推送给客户端。

### context._.on()

`context._.on('*', handler)` 用于监听服务端内部的所有事件。`*` 表示通配，监听所有事件。handler 接收 `{ key, value }` 参数，你可以通过 `key` 过滤只推送特定事件。

### meta 定义

Stream 的 `meta` 与 action 的 `meta` 用法相同：

```ts
export const meta: MilkioMeta = {
  allow: [],  // 访问控制
};
```

## 客户端调用

前端通过 `stargate.execute` 调用 stream，路径末尾加 `~`：

```ts
const [error, iterator, details] = await stargate.execute('/event/watch~', {
  params: {},
});

if (error) throw context.reject(error);

for await (const chunk of iterator) {
  const [chunkError, chunkData] = chunk;
  if (chunkError) {
    console.error(chunkError);
    continue;
  }
  // 处理推送数据
  handleStreamData(chunkData);
}
```

## 典型场景：事件订阅

在前端状态管理器工程中，`watch.stream.ts` 是核心的事件订阅端点，负责将后端的 `app:` 前缀事件实时推送到前端：

```
后端 action 中 context.emit('app:tabs', data)
        ↓
watch.stream.ts 中 context._.on('*') 捕获，过滤 app: 前缀
        ↓
flow.emit() 推送到 SSE 流
        ↓
前端通过 stargate.execute('/event/watch~') 接收
        ↓
aurora/defineAurora 解析并更新 ipcRefs
        ↓
Vue 组件通过 useIpcRefs() 响应式读取
```

详细的前端使用方式请参阅 `./docs/point-store.md` 中的"事件系统"章节。

## 最佳实践

1. **过滤事件**：在 stream 中务必过滤事件，只推送客户端需要的数据（如 `app:` 前缀），避免推送不必要的服务端内部事件。
2. **初始数据**：stream 建立连接后，应立即推送初始数据（如通过 `life-cycle:mounted` 事件），确保客户端首次连接时能获取到数据。
3. **避免阻塞**：`flow.emit()` 是非阻塞的，不要在回调中执行耗时操作。
4. **连接管理**：客户端断开连接时，生成器会自动结束，无需手动处理。
