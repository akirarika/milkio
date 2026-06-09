# Stargate

## 最简单的示例

```ts
const [error, result, details] = await stargate.execute("/foo/bar", {
  params: {
    hello: "Milkio",
  },
});

if (error) {
  // 处理错误..
}

result;
```

`execute` 方法始终返回一个包含三个成员的数组，`[error,result,details]`。

- `error`：错误信息（失败时存在，成功时为 `null`）
- `result`：成功返回的数据（失败时为 `null`）
- `details`：一些杂项数据

你只有在显式判断 `error === null` 时，才能安全使用 `result`，否则 typescript 编译器会报错。

### 为什么要这样设计？

比如说 golang 中，我们经常会看到：

```go
if err != nil {
  fmt.Printf("错误: %v\n", err)
  return
}
```

通过这种方式来处理错误，这和 stargate 很像，stargate 通过这种限制你必须先处理错误，再使用 result 中的值的方式。尽管有些啰嗦，但是这在限制你写出健壮的代码。

## 在 vue 工程中处理失败

**重要**：在 vue 前端工程中，不得直接使用 `stargate.execute` 调用后端服务器端点。前端必须通过 `aurora.ipc.execute` 调用 embed 端点，由 embed 统一代理与后端的通信。详见 SKILL.md 中"前端必须通过 embed 与后端通信"章节。

前端通过 `aurora.ipc.execute` 调用 embed 端点时，错误处理方式与直接使用 `stargate.execute` 相同：

我们必须使用 `'YOUR_ERR_CODE' in error` 的方式来判断错误类型。注意，不得使用 `typeof error?.'YOUR_ERR_CODE' !== undefined` 的方式来判断是否有错误产生。这会导致 typescript 类型错误。

```ts
const aurora = await useAurora();
const [error, result, details] = await aurora.ipc.execute("/foo/bar", {
  params: {
    hello: "Milkio",
  },
});

if (error) {
    if ('USER_EMAIL_UPDATE_LIMIT' in error) {
        return alert('你最近修改过邮箱了，从上次修改之日起7天内不能重复修改');
    } else if ('USER_EMAIL_EXIST' in error) {
        return alert('该邮箱已被其他用户使用');
    }
    else {
        throw showError({ data: { error, result, details } }); // 对于意料外的错误，直接显示 nuxt 的错误页面
    }
}

result;
```

这里只是简单地使用 `alert` 弹出了错误消息，实际的业务开发中，你不得使用如此简陋的方式来展示错误消息。你应该遵循：

- 对于后台式的执行错误，认为应该不打扰用户的，例如后台定时上报数据，你可以简单地忽略，不做任何错误处理。
- 对于可接受的错误，例如用户输入错误，你应该在页面友好地提示，例如在输入框下方展示错误信息，或者弹出 toast（根据你使用的 UI 框架来定），并让用户可以继续操作。
- 对于需要显式要求用户操作的错误，例如需要用户主动点击重试、或者需要用户输入验证码等，你应该采用弹窗等交互方式，让用户可以继续操作。
- 对于意料外的、无法重试的、属于程序异常的错误，你应该直接显示 nuxt 的错误页面，阻止用户的其他操作，不要静默处理，这很可能让错误不受控地扩散甚至产生脏数据。

不得忽略错误，宁愿中断用户的操作（使用 `showError({ data: { error, result, details } })` 直接显示 nuxt 的错误页面）也不要忽略任何错误。必须要阻止错误不受控地扩散甚至产生脏数据。

## 在 milkio 工程中处理失败

由于 milkio 工程通常不是与用户交互的一线，所以不需要处理失败，只需要在执行失败时，直接抛出错误即可。

**重要**：当 milkio 工程作为中间层（如 embed）调用其他 milkio 工程并需要将错误向上传递时，必须使用 `throw context.reject(error)` 而非 `throw error`。直接 `throw error` 会导致错误码无法正确序列化，前端无法通过 `'ERROR_CODE' in error` 匹配到具体错误类型。

```ts
const [error, result, details] = await stargate.execute("/foo/bar", {
  params: {
    hello: "Milkio",
  },
});

if (error) throw context.reject(error);

result;
```

当然，对于一些特殊的场景，你也许需要在执行失败时，继续执行后续的逻辑或者进行重试，你可以根据错误类型来进行处理。具体情况具体分析。

## 调用 Stream 端点

除了普通的 action 端点，Milkio 还支持 stream 端点（`.stream.ts`）。调用 stream 时，路径末尾需要加 `~` 后缀，`stargate.execute` 会返回一个 `AsyncGenerator`：

```ts
const [error, iterator, details] = await stargate.execute('/event/watch~', {
  params: {},
});

if (error) {
  // 连接失败处理
  throw context.reject(error);
}

// iterator 是一个 AsyncGenerator，持续接收服务端推送的数据
for await (const chunk of iterator) {
  const [chunkError, chunkData] = chunk;
  if (chunkError) {
    // 数据块错误
    console.error(chunkError);
    continue;
  }
  // 处理推送数据
  console.log(chunkData);
}
```

**与 action 调用的区别**：
- 路径以 `~` 结尾（如 `/event/watch~`）
- 成功时返回 `[null, AsyncGenerator, details]`
- `AsyncGenerator` 的每个 yield 值为 `[chunkError, chunkData]` 格式
- 连接会持续保持，直到服务端关闭或客户端主动 break

## 事件钩子

Stargate 实例支持注册事件钩子，用于在请求的不同阶段进行拦截处理。详细用法请参阅 `./docs/create-stargate.md`。

- `stargate.on('milkio:executeBefore', ...)` — 请求执行前
- `stargate.on('milkio:fetchBefore', ...)` — HTTP 请求发送前（可用于签名）
- `stargate.on('milkio:executeError', ...)` — 请求执行出错时

## 缓存与重试

Stargate 支持请求级别的缓存策略和重试策略：

```ts
const [error, result, details] = await stargate.execute('/user/read-my', {
  cacheStrategy: 'throttle',  // 'off' | 'fallback' | 'throttle'
  cacheThrottleMs: 5000,
  onCacheHit: (cachedResult) => {
    // 缓存命中回调
  },
  retryStrategy: true,  // true=重试2次, 或指定次数
});
```

详细配置请参阅 `./docs/create-stargate.md`。