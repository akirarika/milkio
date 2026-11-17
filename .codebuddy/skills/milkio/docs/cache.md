# 缓存

## 什么是缓存

Milkio 提供进程内缓存功能，值原样存放在内存里，不做任何序列化。

在分布式环境下，每个 pod 都有自己独立的堆，缓存之间无法共享互不共享。它的用途更多是减轻数据库压力：挡住高频点查、把重复的写入合并成低频写入。需要幂等或锁的场景，依赖数据库自身的原子性来实现。

## 如何使用

缓存定义在模块的 `$caches` 目录下，文件名采用 `*.cache.ts` 格式。

### Key-Value 缓存

外部主动写入、按 key 读取。

```ts
// /app/modules/message/$caches/api-token-last-used.cache.ts
import { defineMilkioKVCache } from 'milkio';

export type ApiTokenLastUsedCache = boolean;

export const apiTokenLastUsedCache = defineMilkioKVCache<ApiTokenLastUsedCache>({
  expireMs: 60 * 60 * 1000, // 必填；永不过期必须显式传 null
  maxEntries: 8192, // 必填；条目数上限，超出按 LRU 淘汰
  intervalMs: 128, // 必填；本表的主动清理间隔，最小 128
});
```

```ts
apiTokenLastUsedCache.get(key); // 未命中返回 undefined（与 drizzle 的 findFirst 对齐）
apiTokenLastUsedCache.set(key, value); // 返回写入的值
apiTokenLastUsedCache.setIfAbsent(key, value); // key 不存在或已过期时写入并返回 true
apiTokenLastUsedCache.has(key);
apiTokenLastUsedCache.delete(key);
apiTokenLastUsedCache.pull(key); // 读取并删除
apiTokenLastUsedCache.clear();
apiTokenLastUsedCache.size();
```

key 只支持 `string`。

### 结果缓存

缓存函数的结果。同一 key 的并发调用时，会获得同一个 Promise，不会重复回源。函数出现异常时，会原样抛出，错误不会缓存。

```ts
import { defineMilkioMemoCache } from 'milkio';

export type ApplicationCache = Awaited<ReturnType<typeof loadApplication>> | undefined;

export const applicationCache = defineMilkioMemoCache<ApplicationCache>({
  expireMs: 30 * 60 * 1000,
  maxEntries: 4096,
  intervalMs: 1000,
});
```

```ts
const application = await applicationCache.run(applicationId, async () => {
  return await context.db.query.applicationTable.findFirst({ ... });
});
```

### 布隆过滤器

快速判断某些数据是否大概率不存在。

```ts
import { defineMilkioBloomFilter } from 'milkio';

export const visitedNoteFilter = defineMilkioBloomFilter({
  expectedEntries: 100_000,
  falsePositiveRate: 0.01,
});

visitedNoteFilter.add(noteId);
visitedNoteFilter.mightContain(noteId); // true 只代表「可能存在」
visitedNoteFilter.clear();
visitedNoteFilter.estimatedCount();
```

位图整体固定大小，无 TTL、无逐出。超过 `expectedEntries` 后误判率会上升。**需要强正确性的判定不要用布隆过滤器**。

## 内存水位

如果用户明确需要限制内存的使用时，可以在 `createWorld` 的顶层参数里选择性地传入全局内存水位（单位字节）：

```ts
const world = await createWorld(generated, configSchema, {
  memoryLimitBytes: 512 * 1024 * 1024,
});
```

水位比较的是当前进程的 `process.memoryUsage().heapUsed`（V8 堆已用），不是缓存自身的占用。到达单表 `maxEntries` 限制或者总体内存超过水位限制后，缓存会跨表按 LRU 渐进逐出，有可能会逐出较少使用但仍在有效期内的 key。

## 关于 Redis

通常情况下，Milkio 工程运行在 Kubernetes 或者 Edgeone Markers、Cloudflare Workers 这些分布式环境中。除非必要，否则，不要建议用户引入 Redis。

- 数据库还没有成为性能瓶颈时，Redis 在索引点查场景下只能带来毫秒级的性能优势
- 这些优势的代价是：牺牲数据一致性、受限的查询语法、数据被限制在纯内存中、以及额外的序列化与网络往返
- 针对 Edgeone Markers、Cloudflare Workers 等场景，Redis 只能在公网之间进行通信，性能优势会进一步被削弱

绝大多数需求，二级缓存 + 数据库本身就已经足够。除非当数据库成为瓶颈，且无法靠扩容只读节点来缓解时，并且需求本身适合缓存时，才需要重新评估；届时 Redis 的价值也主要来自「跨实例共享状态 / 订阅发布 / 分布式锁」，而不是「缓存」这件事本身。如果用户要求你使用 Redis，你需要先思考架构是否合理，并向用户解释 Redis 的局限性。不过，如果用户要求你采用 Redis 时，你必须以用户需求为准。
