---
name: milkio
description: "milkio，后端，状态管理，Electron主进程，数据仓库，缓存，逻辑，测试；*.action.ts *.stream.ts __TEST__.test.ts *.config.ts *.table.ts *.cache.ts *.code.ts *.codes.ts *.event.ts *.handler.ts *.seed.ts"
---

## 什么是 Milkio

Milkio 是一个 AI native 的嵌入式逻辑层框架，它专注于处理和封装复杂的业务逻辑与状态，而不与 UI 视图耦合。

你的 vue 组件需要通过调用 milkio 来获取数据状态、执行操作等，无论是否必须经过网络传输。因此，它可以有多种用途：

- 作为后端服务器 (部署在云端，通过网络与前端通信)
- 作为前端的状态管理器 (替代诸如 pinia、redux 等 store library)
- 接管 Electron 的主进程并和渲染进程通信

## 工程架构

这是一个 monorepo，在 `/projects` 目录下存储着若干个工程。

假设用户在制作一个 Todo 应用，支持网页在线使用和桌面应用程序。那么，用户通常会有以下目录：

```
projects/
├── todo-app/               # 前端应用 (nuxt app，内部包括路由和网页等，不包括任何逻辑和状态)
├── todo-app-electron/      # 桌面应用程序 (milkio app，负责通过 electron 启动 BrowserWindow 并加载 todo-app)
├── todo-app-embed/         # 前端状态管理器 (milkio app，以 shared worker / worker 的形式和 todo-app 运行在同一个浏览器内)
└── todo-server/            # 后端服务器 (milkio app，运行在云端服务器中，通过网络与浏览器页面通信)
```

当用户启动了桌面应用程序后，实际产生的调用顺序如下：

```
`todo-app-electron`
(启动桌面应用程序并通过启动 BrowserWindow 来打开前端应用的网页)
====== ▼ ======
`todo-app`
(只负责界面呈现，具体逻辑与状态的处理，通过调用状态管理器完成)
====== ▼ ======
`todo-app-embed`
(发送网络请求将数据传递到后端服务器)
====== ▼ ======
`todo-server`
(处理数据并保存到数据库)
```

### 前端必须通过 embed 与后端通信

**严禁**前端（`todo-app`）直接调用后端服务器（`todo-server`）的端点。无论是读取还是写入，前端都**必须**通过 embed（`todo-app-embed`）来与后端通信。

```
❌ 错误：前端直连后端
todo-app → stargate.execute('/space/browse') → todo-server

✅ 正确：前端通过 embed 调用
todo-app → aurora.ipc.execute('/space/browse') → todo-app-embed → stargate.execute('/space/browse') → todo-server
```

理由：
1. **架构一致性**：所有对 server 的调用都通过 embed 统一代理，embed 可以缓存读取结果、统一管理错误处理和重试逻辑，保持前端与 server 的解耦。
2. **状态同步**：写操作后 embed 会自动 emit 事件通知前端；如果前端绕过 embed 直接调用 server，embed 无法感知数据变更，会导致状态不一致。
3. **缓存控制**：embed 可以在写操作后自动刷新相关缓存，前端直连 server 则无法做到。
4. **职责分离**：前端只负责 UI 呈现，embed 负责所有业务逻辑和数据通信，server 负责数据持久化。

因此，前端代码中**不应出现**直接使用 `stargate.execute('/xxx/...')` 调用 server 端点的代码，而应统一使用 `aurora.ipc.execute('/xxx/...')` 调用 embed 端点。如果 embed 中尚未定义所需的端点，应先在 embed 中创建对应的 action，再由前端调用。

---

## 文档

你必须阅读文档，了解实际的开发流程和规范。

你必须严格依据相关文档进行开发。编码完成后必须复查代码，确保完全符合文档要求。此外，若在编码结束后发现涉及的改动与某些尚未阅读的文档有关，务必阅读这些文档然后重新编码。切勿凭直觉编码，否则极有可能严重偏离规范与目标。

### 模块

模块是位于 `/app/modules` 目录下的文件夹，采用**小写字母+中划线**命名，并且必须使用**单数名词**（不以字母 s 结尾）。例如：用户模块为 `/app/modules/user`，用户设备模块为 `/app/modules/user-device`。创建文件夹即会自动注册为模块。

模块下可以嵌套子模块（例如，商品 `product` 为主模块，商品规格 `specification` 为其子模块，路径就是 `/app/modules/product/specification`）。父模块和子模块的资源可以互相调用，例如子模块操作父模块的 database 或 store，但是，不能跨模块互相调用。遇到需要跨模块调用的情形，必须通过 API 端点或者 events 的方式实现，可参阅相关文档。

- `./docs/events.md`：当你需要跨模块通信时阅读。

### 通信

Stargate 是 milkio 的客户端通信 SDK，你必须使用它进行通信。

**前端 vue 工程不得直接使用 stargate 与 server 通信，必须通过 `aurora.ipc.execute` 调用 embed 端点。** stargate 仅在 embed 和 server 等 Milkio 工程内部使用。

每一个 milkio app 都可以被外部的其他工程调用，通过类似以下方式发送"请求"至某一个 API 端点。注意，这里的"请求"并非一定会产生实际的网络请求，也可能实际上只是在 javascript 进程内互相调用函数。但是，它们都被封装为了一个统一的接口，你无需关心实际的通信方式。

```ts
// ❌ 错误：前端 vue 工程中直接使用 stargate 调用 server
const [error, result, details] = await stargate.execute("/user/login", {
  params: { hello: "Milkio" },
});

// ✅ 正确：前端 vue 工程中通过 embed 调用
const aurora = await useAurora();
const [error, result, details] = await aurora.ipc.execute("/user/login", {
  params: { hello: "Milkio" },
});
```

在 embed 等 Milkio 工程内部，使用 stargate 与其他 Milkio 工程通信：

```ts
// embed 工程中，使用 stargate 调用 server
const [error, result, details] = await stargate.execute("/user/login", {
  params: {
    hello: "Milkio",
  },
});

if (error) {
  // 处理错误..
}

console.log(result);
```

- `./docs/stargate.md`：当你要需要进行通信时阅读。
- `./docs/create-stargate.md`：当你需要创建一个与其他子工程通信用的 stargate 时阅读。

### API 端点与测试 (*.action.ts / *.stream.ts / __TEST__.test.ts)

每一个 milkio app 的 `./app/modules` 目录下，都包含了若干个 `.action.ts` 文件，每个 action 文件都对应一个 API 接口，它所在的位置，会自动映射成约定式路由。例如，`./app/modules/user/login.action.ts` 会被路由为 `/user/login`、`./app/modules/foo/index.action.ts` 会被路由为 `/foo`。

每个模块都必须在目录下创建一个 `__TEST__.test.ts` 文件，里面编写该模块所有端点的测试代码。当你修改了任何代码，都必须运行测试验证。

你可以使用 `co test` 命令运行测试，它会在运行测试前自动完成必要的准备工作（例如重新生成 `.milkio/` 目录下的声明文件）。如果你遇到端点不存在的 TS 类型错误，不用担心，这些类型错误在运行 co test 时会自动消除。下面是一个运行 `todo-app-embed` 工程中 `setting` 模块的测试例子：

```bash
# 运行单个测试文件
co test "./projects/todo-app-embed/app/modules/setting/__TEST__.test.ts"

# 运行多个指定测试文件
co test "./projects/todo-app-embed/app/modules/setting/__TEST__.test.ts" "./projects/todo-app-embed/app/modules/other/__TEST__.test.ts"

# 运行全部的测试 (对于大型仓库可能需要运行几十分钟)
co test
```

当然，作为了解原理的你，你现在一定知道：如果你只想生成声明文件，而不运行测试，可以使用 `co test --help` 即可，它会重新生成声明文件，但不会运行任何实际的测试。

千万不能使用 `npx vitest` 来运行测试，所有的测试都会发生真实的 HTTP 请求，而使用 `vitest` 或 `jest` 会因为服务器未启动而失败。使用 `co test` 来运行测试，它会自动启动所有 milkio app 并运行测试。

当你运行后，它会先启动所有的 milkio app，然后再运行测试。所以不用担心多个服务之间是否启动的问题。

- `./docs/point.md`：当你要修改或者编写 API 端点时阅读，或者修改对应端点的测试文件 `__TEST__.test.ts` 时阅读。你还需要额外阅读以下任意一篇文档，**你不能只阅读本文档**：
    * `./docs/point-server.md`：如果是用作后端服务器的工程。
    * `./docs/point-store.md`：如果是用作前端状态管理器的工程。

### 配置 (*.config.ts)

在开发过程中，通常需要妥善管理各种配置信息，例如数据库连接详情、密钥等敏感数据。这些配置往往与运行环境强相关，因此需要一种可维护、可扩展、类型安全的管理方式。Milkio 为此提供了一套基于环境的配置系统。

当你需要修改包括 common.config.ts、test.config.ts、dvlp-zh-cn.config.ts、prod-zh-cn.config.ts 等基于环境的配置文件时一定要阅读文档。

你可以通过 `context.config` 来访问配置。

- `./docs/config.md`：当你需要编写配置时阅读。

### 数据库（*.table.ts）

对于用作后端服务器的工程，通常需要操作数据库。使用 drizzle 操作数据库是首选的方式。

- `./docs/drizzle.md`：当你要需要编写数据库相关代码时阅读。

### 缓存（*.cache.ts）

对于用作后端服务器的工程，可以通过 Redis 实现缓存。Milkio 提供了基于 Redis 的多种缓存模式：查询缓存（useFetch）、Key-value 缓存（useCache）、计数器（useCount）和打卡记录器（useClockIn）。

缓存定义在模块的 `$caches` 目录下，文件名采用 `*.cache.ts` 格式，通过 `context.redis` 访问。

- `./docs/redis.md`：当你要编写缓存相关代码时阅读。

### 内部动作（$exports）

有些动作不需要对外暴露为 HTTP 接口，仅供模块内部或其他模块通过 `context.call()` 调用。这类动作放在模块的 `$exports` 目录下。**`$exports` 目录中的动作不会注册为端点。**

```ts
// 在 action 中调用 $exports
const result = await context.call(import('../point/$exports/add.action.ts'), {
  data: { userId: params.data.userId, points: 100 },
});
```

- `./docs/point-server.md`：内部动作的详细写法和 `context.call` 的用法在本文档的"$exports"章节中。

### 错误码（*.codes.ts）

**公共错误码**定义在 `/app/codes/` 目录下（如 `common.code.ts`），所有模块共享。**模块专属错误码**定义在模块的 `$codes` 目录下。

```ts
// 使用错误码
throw context.reject('DATA_NOT_FOUND', undefined);           // 公共错误码
throw context.reject('POINT_INSUFFICIENT', { required: 100, available: 50 }); // 模块错误码
```

- `./docs/point-server.md`：错误码的定义和使用规范在本文档的"错误处理"章节中。

### 启动引导、中间件（bootstrap）

Bootstrap 用于在服务启动时初始化中间件、数据库连接等基础设施。

- `./docs/bootstrap.md`：当你需要编写启动引导逻辑时阅读。

### 实时推送（*.stream.ts）

Stream 端点基于 Server-Sent Events (SSE) 实现服务端向客户端的实时推送，使用 `async function*` 异步生成器定义。路由路径末尾加 `~` 后缀。

- `./docs/stream.md`：当你需要编写实时推送功能时阅读。

### 事件与事件监听（*.event.ts + *.handler.ts）

事件是模块间通信的核心机制。模块通过 `$events` 目录定义事件（`*.event.ts`），通过 `$handlers` 目录监听事件（`*.handler.ts`），实现解耦协作。

- `./docs/events.md`：当你需要定义事件、编写事件监听、或进行跨模块通信时阅读。

### 模块目录总览

```
app/modules/{module-name}/
├── $databases/        # 数据库表定义（*.table.ts）
├── $caches/           # Redis 缓存（*.cache.ts）
├── $events/           # 事件定义（*.event.ts）
├── $handlers/         # 事件监听（*.handler.ts）
├── $exports/          # 内部动作（*.action.ts，不注册为端点）
├── $codes/            # 模块专属错误码（*.code.ts）
├── $seeds/            # 测试种子数据（*.seed.ts）
├── $configs/          # 模块配置（*.config.ts）
├── $stores/           # 前端存储（仅状态管理器工程）
├── $bootstraps/       # 模块级启动引导
├── add.action.ts      # API 端点
├── browse.action.ts
├── read.action.ts
├── edit.action.ts
├── delete.action.ts
└── __TEST__.test.ts      # 测试文件
```