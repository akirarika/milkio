## 何时使用缓存

除非用户明确告知需要使用缓存，否则，不得使用缓存。

现代的一主多从架构的数据库其实性能已经足够强大。编写缓存会使代码变得复杂、难以调试。因此，除非用户明确告知某处要使用缓存，否则，尽可能地避免使用缓存。

## 定义缓存

缓存定义在模块的 `$caches` 目录下，每个缓存文件的文件名，采用 `*.cache.ts` 的格式，例如 `fetch-application.cache.ts`。

下方演示了如何定义一个缓存，用于从数据库中查询应用程序信息，来减少对数据库的查询次数。（将数据库的查询结果，缓存 30 分钟）

```
// /app/modules/application/$caches/fetch-application.cache.ts
import type { MilkioContext } from '../../../../.milkio/declares.ts';

/**
 * 优先从缓存中应用程序信息
 */
export async function useApplicationCache(context: MilkioContext, applicationId: string) {
  return context.redis.useFetch(`application:${applicationId}`, {
    expireMs: 30 * 60 * 1000, // 缓存 30 分钟
    async fetch() {
      // 执行具体的查询，然后返回结果..
      const application = await context.db.query.applicationTable.findFirst({
        where: (table, { and, eq }) => and(eq(table.id, applicationId)),
      });
      return application;
    },
  });
}
```

使用它时：

```ts
const applicationCache = await useApplicationCache(event.context, applicationId);

// 从缓存中获取应用程序信息
const application = await applicationCache.fetch();

// 刷新缓存，无论是否过期，都重新获取数据
// 注意，此方法无返回值，仅用于刷新缓存。如果你需要后获取刷新后的数据，需要在刷新后再调用 fetch 方法来读取
await applicationCache.refresh();
```

## Key-value 缓存

有些时候，我们不是想缓存数据库或者 API 的查询结果，而是想缓存一些简单的 Key-value 数据，例如缓存用户认证令牌，然后可以根据令牌快速获取到所关联的用户 ID。

```
// /app/modules/user/$caches/generate-auth-token.cache.ts
import type { MilkioContext } from '../../../../.milkio/declares.ts';

/**
 * 获取用户认证令牌
 */
export async function useUserAuthTokenCache(context: MilkioContext, token: string) {
  return context.redis.useCache<{ // 存储的数据内容，支持任意可被 JSON 序列化的类型，和 Date 类型
    userId: string;
  }>(`user-auth-token:${token}`);
}
```

使用它时：

```ts
const userAuthTokenCache = await useUserAuthTokenCache(context, params.token);

// 设置数据，过期时间 15 秒
await userAuthTokenCache.set(data, 15 * 1000);

// 获取数据
const cachedData = await userAuthTokenCache.get();

// 获取后删除数据，通常用于验证码等场景，可保障原子性
const cachedData = await userAuthTokenCache.pull();

// 判断是否存在数据
const hasCached = await userAuthTokenCache.has();

// 删除数据
await userAuthTokenCache.del();
```

## 计数器

我们可以将缓存用来当作计数器来使用，例如对某个文章的点赞数进行计数。这能够让我们确保计数器的原子性，不会因为并发操作而导致计数器数据不一致的问题。

```
// /app/modules/article/$caches/like-article.cache.ts
import type { MilkioContext } from '../../../../.milkio/declares.ts';

/**
 * 点赞文章数量
 */
export async function useLikeArticleCache(context: MilkioContext, articleId: string) {
  return context.redis.useCount(`like-article:${articleId}`);
}
```

使用它时：

```ts
const likeArticleCache = await useLikeArticleCache(context, articleId);
// 点赞数加一
await likeArticleCache.add(1);

// 点赞数减一
await likeArticleCache.sub(1);

// 获取点赞数，如果没有数据，返回 0
const likeCount = await likeArticleCache.get();

// 点赞数加一，但是如果数据是由此次设置的而出现的，这条数据的过期时间将会被设置为 15 秒
// 即：redisClient.MULTI().INCRBY(key, amount).PEXPIRE(key, expireMs).EXEC()
await likeArticleCache.add(1, 15 * 1000);
```

## 打卡记录器

我们可以将缓存来当作打卡记录器来使用。此功能背后依赖 Redis Bitmap，例如记录用户连续打卡、每日签到等场景。Bitmap 使用位来存储数据，每个位代表一个时间点（如一天），1 表示已打卡，0 表示未打卡。这种方式非常节省内存，并且支持高效的统计和查询操作。

注意，打卡记录器有一个潜在的限制。数组的长度不得超过 64，因此拿来按周或者按月记录打卡是完全合适的，但是不适合拿来按季或按年。同时，这么长的时间下，万一 Redis 出现故障导致数据丢失，那么就会丢失掉这部分数据，这也是得不偿偿失的。因此，如果使用此功能，建议最多只记录最近一个月的打卡记录，历史记录要实时存入数据库来持久保存。

换句话说，打卡记录仅作为缓存层，来减轻查询压力，不作为实际打卡记录的事实来源。一切数据的事实来源都要以数据库为准。

```
// /app/modules/user/$caches/user-clock-in.cache.ts
import type { MilkioContext } from '../../../../.milkio/declares.ts';

/**
 * 用户打卡记录
 */
export async function useUserClockInCache(context: MilkioContext, userId: string) {
  const cleanDate = dayjs().tz('Asia/Shanghai').add(1, 'month').startOf('month').utc().toDate();
  return context.redis.useClockIn(`user-clock-in:${userId}:${cleanDate.toISOString()}`, cleanDate);
}
```

使用它时：

```ts
const userClockInCache = await useUserClockInCache(context, userId);
const today = new Date().getDate() - 1; // getDate() 返回当月日期（1-31），减 1 后得到 offset（0-30）

// 打卡，today 是一个 number 类型的数字，代表了打卡的日期（从 0 开始）
await userClockInCache.clockIn(today);

// 检查是否已打卡，today 是一个 number 类型的数字，代表了打卡的日期（从 0 开始）
const hasClockIn = await userClockInCache.check(today);

// 获取本月所有打卡记录（转换为布尔数组，length 是指定该数组长度，例如传入 31，则数组中有 31 个元素，索引从 0 到 30）
const clockInArray = await userClockInCache.toArray(31); // 31 天

// 获取第一次打卡的日期，返回的是从 0 开始的位位置索引，如果没有打卡过则返回 -1
const firstClockInDay = await userClockInCache.firstClockIn();

// 获取最后一次打卡的日期，返回的是从 0 开始的位位置索引，如果没有打卡过则返回 -1
const lastClockInDay = await userClockInCache.lastClockIn();

// 统计打卡次数（位为 1 的数量）
const clockInCount = await userClockInCache.count();

// 清空打卡记录
await userClockInCache.clean();
```

## 使用原生 Redis 客户端

如果用户需要直接使用原生的 Redis 客户端。这样你可以直接调用 Redis 的命令，例如 `redisClient.GET(key)` 等。

但是，你要注意，在这种情况下你要自己处理数据的序列化和反序列化逻辑。尤其要考虑，数据中是否存在 Date 对象？除非有必要，否则不推荐直接使用原生的 Redis 客户端。

```
// /app/modules/user/$caches/user-auth-token.cache.ts
import type { MilkioContext } from '../../../../.milkio/declares.ts';

/**
 * 用户认证令牌
 */
export async function useUserAuthTokenCache(context: MilkioContext, token: string) {
  const redisClient = context.redis.redis; // 获取原生的 Redis 客户端
  const cache = {
    // 编写你对外提供的方法..
    async pull() {
      const resultRaw = await redisClient.MULTI().GET(key).DEL(key).EXEC();
      const result = resultRaw[0];
      if (result === null) return options?.defaultValue;
      return JSON.parse(result as any as string);
    }
  };
  return cache;
}
```
