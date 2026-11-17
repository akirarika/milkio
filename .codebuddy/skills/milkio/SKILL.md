---
name: milkio
description: 'cookbook，co 命令，milkio，后端，状态管理，Electron主进程，数据仓库，缓存，逻辑，测试；*.action.ts *.stream.ts __TEST__.test.ts *.config.ts *.table.ts *.cache.ts *.code.ts *.codes.ts *.event.ts *.handler.ts *.seed.ts *.types.ts *.data.ts *.utils.ts'
metadata:
    xMilkioUpdatedAt: '2026-11-17T14:30:19.000Z'
    xMilkioDoNotEdit: 'This document is managed and overwritten automatically by cookbook. Do not edit it; edit the canonical skill in the milkio repository instead.'
---

## 什么是 Milkio

Milkio 是一个 AI native 的嵌入式逻辑层框架，它专注于处理和封装复杂的业务逻辑与状态，而不与 UI 视图耦合。

你的 vue 组件需要通过调用 milkio 来获取数据状态、执行操作等，无论是否必须经过网络传输。因此，它可以有多种用途：

- 作为后端服务器 (部署在云端，通过网络与前端通信)
- 作为前端的状态管理器 (替代诸如 pinia、redux 等 store library)
- 接管 Electron 的主进程并和渲染进程通信

## 工程架构

这是一个 monorepo，在 `./projects` 目录下存储着若干个工程。

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

## 模式

模式 (mode) ，它的作用是区分当前的开发环境。不同的模式会启用不同的配置文件，也会注入不同的环境变量。它也等同于设置 Vite 的模式，参见：[Env Variables and Modes](https://vite.dev/guide/env-and-mode)

启动后，所有的工程都会收到 `MODE`、`VITE_MODE` 作为环境变量。我们推荐你使用 `VITE_MODE` 作为模式的依据，这样，能够兼容大部分 VITE 工程。在绝大多数情况下，例如，本地开发时，模式都最好固定是 `test`。因为，当模式为 `test` 时，我们会允许一些开发时可用的特性，例如启动开发服务器，允许 `co test` 正常工作。但是，这些特性会产生安全风险。因此，生产环境务必使用其他的模式，例如 `prod` 等。

想要添加或修改模式，直接修改 `cookbook.toml` 中的 `general->modes` 字段即可。除了 `test` 模式是必须的，其他都是可以自由定义的。

## 开发命令（`co` CLI）

`co` 是 milkio 的开发工具链（cookbook），负责生成声明文件、启动/停止各工程、运行测试等。

### `co generate`

重新生成所有工程的声明文件，即 `.milkio/` 目录（typia 类型推导 + 路由类型）。

如果你遇到端点不存在的 TS 类型错误，不用担心，这些类型错误在运行 `co generate` 时会自动消除。这是一个基础命令，当你运行其他如 `co start` 或者 `co test` 的命令时，它们会在内部先运行 `co generate`。

```bash
co generate --mode=test
```

### `co start`

启动 `./projects` 目录下的所有工程。

当你运行后，它会先启动所有的工程，包括前端工程（这等于运行 `npm run dev`）。并且，会自动按模式加载对应的模式配置。所以，不用担心多个服务之间是否启动的问题。

```bash
co start --mode=test
```

### `co stop`

停止所有由 `co start` 启动的工程进程。

```bash
co stop
```

### `co test`

运行测试，内部会使用 `vitest` 来运行测试。

注意，你不能直接使用 `npx vitest` 来运行测试，由于所有的测试都会发生真实的 HTTP 请求，而使用 `vitest` 或 `jest` 会因为服务器未启动而失败。因此，你需要使用 `co test` 来运行测试，当你运行后，它会先启动所有的工程，然后再运行测试。所以不用担心多个服务之间是否启动的问题。

```bash
# 运行单个测试文件
co test "./projects/todo-app-embed/app/modules/setting/__TEST__.test.ts" --mode=test

# 运行多个指定测试文件
co test "./projects/todo-app-embed/app/modules/setting/__TEST__.test.ts" "./projects/todo-app-embed/app/modules/other/__TEST__.test.ts" --mode=test

# 运行全部的测试 (对于大型仓库可能需要运行几十分钟)
co test --mode=test
```

### `co logs`

查看统一日志收集器收集到的日志。`co start` / `co dev` / `co test` 启动的所有进程（后台 dev 进程、各 project 的开发服务器、测试子进程、类型检查/构建子进程等）的输出都会带时间戳、来源和 stdout/stderr 标记写入同一个日志存储，进程崩溃、被强杀、健康检查失败等事件的错误信息也会被记录下来。

日志按「一次运行（session）」分组：

- 每次 `co start` / `co dev` / `co test` 都会创建一个新的 session，**不会清空历史日志**。
- 直接运行 `co logs` 时：如果有正在运行的 session，则查看**本次运行**；否则查看**上一次运行**的最末尾。
- 查看更早的运行需要显式使用 `--sessions` / `--session`。

```bash
# 查看本次运行的日志（新的在最上面；默认一页，约 64KB）
co logs

# 列出保留的所有运行（编号、开始时间、模式、状态、磁盘占用）
co logs --sessions

# 查看历史运行：--session 1 = 最新/本次，2 = 上一次，也接受 session id 前缀
co logs --session 2
co logs --session 2 -e
# 合并所有保留的运行
co logs --session all
```

默认输出为**倒序（越新越靠上）**，每行都带本地时间（精确到毫秒）、来源和 stream。一页显示不下时，日志结尾会有醒目的英文提示，并给出可直接复制执行的翻页命令：

```text
════════════════════════════════════════════════════════════════════════════
  MORE LOGS AVAILABLE — OLDER ENTRIES CONTINUE ON PAGE 2  (newest first)

  To view older logs, run:
      co logs --cursor=c1.eyJ2IjoxLC...

  To return to the newest logs, run:
      co logs
════════════════════════════════════════════════════════════════════════════
```

翻页采用**游标（cursor）**而不是页码：`--cursor` 是当前位置的书签，新日志不断写入也不会让旧页内容漂移或重复。翻页命令已经携带了当时的 session、过滤条件和每页大小，所以只需复制整条命令即可；`--cursor` 不能和 `--session`、`-e`、`-s`、`--from`、`--to`、`--project`、`--ready`、`--page-size` 一起使用。

```bash
# 只看错误（stderr、含英文单词 error/fail（不区分大小写，含 errors/failed/failure 等词形），
# 或含中文 错误/异常 的行）
co logs -e
co logs --errors

# 查看各进程是何时就绪的（健康检查通过的时间、耗时、探测次数、URL）
co logs --ready
# 只看某个项目的就绪情况（匹配 worker:<name> 或事件里的 project 字段）
co logs --ready --project todo-server

# 关键词搜索（大小写不敏感；可重复，多个条件同时满足）
co logs -s timeout
co logs -e -s ECONNREFUSED -s "数据库"

# 按时间范围筛选（精确到秒，含边界；不带时区时按本机时区解析）
# 支持 YYYY-MM-DD、YYYY-MM-DD HH:mm、YYYY-MM-DD HH:mm:ss 和 ISO 8601
co logs --from "2026-10-21 00:05:00" --to "2026-10-21 00:10:00"
co logs -e --from "2026-10-21" --to "2026-10-21 23:59:59"

# 统计当前筛选条件下总共有多少条匹配日志（会完整扫描一遍，内存占用仍是常数级）
co logs -e --count

# 调整每页数据量（默认 64kb；页面按完整行累计，不会把一行拆到两页）
co logs --page-size 32kb
co logs --page-size 128kb

# 实时跟踪当前运行的新日志（仅 TTY；仅在 session 正在运行时可用；忽略分页）
co logs -f
co logs -f -e

# 关闭颜色（输出到管道时也会自动关闭）
co logs --no-color
```

补充说明：

- 日志位置：`<工作目录>/node_modules/.cookbook/logs/sessions/<sessionId>/`。
- 逐出机制避免无限膨胀：默认最多 256MB、20 个 session、当前 session 最多 128MB；可用环境变量 `COOKBOOK_LOG_MAX_BYTES`、`COOKBOOK_LOG_MAX_SESSIONS`、`COOKBOOK_LOG_MAX_SESSION_BYTES` 覆盖。超过上限时优先删除最旧的、已经结束的 session；当前正在运行的 session 永不删除。
- `--ready` 依赖后台 dev 进程统一执行健康检查（轮询间隔 500ms、单次请求超时 5s、总超时默认 600s，可用 `COOKBOOK_READY_TIMEOUT_MS` 覆盖）。失败/超时同时会作为错误事件出现在 `co logs -e` 中。
- 单行日志上限 1MB（极端超长行会被截断并标记），正常日志不会被截断；分页只在完整行之间断开。
- 进程被强制结束（例如 Windows 上 `taskkill /F`）时，最多丢失最后约 50ms 的缓冲；`co stop` 自身会向对应 session 写入停止事件，便于事后追溯。
- `co logs` 自身不会创建 session，也不会写入日志文件。

### 技能自动更新

本技能由 `co` 自带。当 milkio 版本变化（`.milkio/.version` 与当前 `co` 版本不一致）并重新生成 `.milkio/` 声明文件时（例如运行 `co generate`、`co start`、`co test`），`co` 会检索当前仓库内各 AI 工具的技能目录（`.agents/skills/milkio`、`.claude/skills/milkio`、`.codebuddy/skills/milkio`、`.trae/skills/milkio`、`.workbuddy/skills/milkio`、`.dsh/skills/milkio` 等），把其中已有的 `milkio` 技能目录整体替换为当前版本，保证多份技能副本与 `co` 版本一致。不会创建原本不存在的技能目录，也不会触碰全局（用户目录下的）技能目录。

因此，如果你发现某个技能副本内容不一致，优先检查 `co` 版本是否已升级；升级后运行一次 `co generate --mode=<模式>` 即可让所有副本对齐。

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
const [error, result, details] = await stargate.execute('/user/login', {
  params: { hello: 'Milkio' },
});

// ✅ 正确：前端 vue 工程中通过 embed 调用
const aurora = await useAurora();
const [error, result, details] = await aurora.ipc.execute('/user/login', {
  params: { hello: 'Milkio' },
});
```

在 embed 等 Milkio 工程内部，使用 stargate 与其他 Milkio 工程通信：

```ts
// embed 工程中，使用 stargate 调用 server
const [error, result, details] = await stargate.execute('/user/login', {
  params: {
    hello: 'Milkio',
  },
});

if (error) {
  // 处理错误..
}

console.log(result);
```

- `./docs/stargate.md`：当你要需要进行通信时阅读。
- `./docs/create-stargate.md`：当你需要创建一个与其他子工程通信用的 stargate 时阅读。

### API 端点与测试 (`*.action.ts / *.stream.ts / __TEST__.test.ts`)

每一个 milkio app 的 `./app/modules` 目录下，都包含了若干个 `.action.ts` 文件，每个 action 文件都对应一个 API 接口，它所在的位置，会自动映射成约定式路由。例如，`./app/modules/user/login.action.ts` 会被路由为 `/user/login`、`./app/modules/foo/index.action.ts` 会被路由为 `/foo`。

每个模块都必须在目录下创建一个 `__TEST__.test.ts` 文件，里面编写该模块所有端点的测试代码。当你修改了任何代码，都必须运行 `co test` 进行测试验证。

- `./docs/point.md`：当你要修改或者编写 API 端点时阅读，或者修改对应端点的测试文件 `__TEST__.test.ts` 时阅读。此外，你还需要额外阅读以下任意一篇文档，**你不能只阅读本文档**：
  - `./docs/point-server.md`：如果是用作后端服务器的工程时阅读。
  - `./docs/point-store.md`：如果是用作前端状态管理器的工程时阅读。

### 配置 (`*.config.ts`)

在开发过程中，通常需要妥善管理各种配置信息，例如数据库连接详情、密钥等敏感数据。这些配置往往与运行模式强相关，因此需要一种可维护、可扩展、类型安全的管理方式。Milkio 为此提供了一套基于模式的配置系统。

当你需要修改包括 common.config.ts、test.config.ts、dvlp-zh-cn.config.ts、prod-zh-cn.config.ts 等基于模式的配置文件时一定要阅读文档。

你可以通过 `context.config` 来访问配置。

- `./docs/config.md`：当你需要编写配置时阅读。

### 数据库（`*.table.ts`）

对于用作后端服务器的工程，通常需要操作数据库。使用 drizzle 操作数据库是首选的方式。

- `./docs/drizzle.md`：当你要需要编写数据库相关代码时阅读。

迁移命令由 **AI 自己运行**（如 `co drizzle generate --project=<项目名> --mode=<模式名> --yes --json`），无需用户执行；详见该文档的「数据库迁移」章节。

### 缓存（`*.cache.ts`）

Milkio 内置缓存功能（进程内缓存），可以避免热点数据对数据库造成太大的压力，或者实现布隆过滤器。

它不是分布式缓存，因此不适合实现分布式锁。需要幂等或锁的场景，应当依赖数据库自身的原子性（唯一索引、条件更新、事务）来保证。

- `./docs/cache.md`：当你要编写缓存相关代码时阅读。

### 内部动作（`$exports`）

有些动作不需要对外暴露为 HTTP 接口，仅供模块内部或其他模块通过 `context.call()` 调用。这类动作放在模块的 `$exports` 目录下。**`$exports` 目录中的动作不会注册为端点。**

```ts
// 在 action 中调用 $exports
const result = await context.call(import('../point/$exports/add.action.ts'), {
  data: { userId: params.data.userId, points: 100 },
});
```

- `./docs/point-server.md`：内部动作的详细写法和 `context.call` 的用法在本文档的"$exports"章节中。

### 错误码（`*.code.ts`）

错误码分为两类，**定义在同一个 `*.code.ts` 里**，每个文件必须同时导出 `Fail` 与 `Fault`（可以为空）：

- `Fail`：业务侧预期内的拒绝（warn 级、无堆栈、data 返回客户端）；
- `Fault`：意料外/内部错误（error 级、带堆栈、对客户端完全隐藏，仅本工程内部使用）。

**公共错误码**定义在 `/app/codes/` 目录下（如 `common.code.ts`），所有模块共享。**模块专属错误码**定义在模块的 `$codes` 目录下。

```ts
// 使用错误码
throw context.fail('DATA_NOT_FOUND', undefined); // 公共错误码
throw context.fail('POINT_INSUFFICIENT', { required: 100, available: 50 }); // 模块错误码
throw context.fault('POINT_LEDGER_INVARIANT_BROKEN', { ledgerId }); // 内部 fault-code
```

- `./docs/point-server.md`：错误码的定义、fail/fault 判定和使用规范在本文档的"错误处理"章节中。

### 启动引导、中间件（`bootstrap`）

Bootstrap 用于在服务启动时初始化中间件、数据库连接等基础设施。

- `./docs/bootstrap.md`：当你需要编写启动引导逻辑时阅读。

### 实时推送（`*.stream.ts`）

Stream 端点基于 Server-Sent Events (SSE) 实现服务端向客户端的实时推送，使用 `async function*` 异步生成器定义。路由路径末尾加 `~` 后缀。

- `./docs/stream.md`：当你需要编写实时推送功能时阅读。

### 事件与事件监听（`*.event.ts + *.handler.ts`）

事件是模块间通信的核心机制。模块通过 `$events` 目录定义事件（`*.event.ts`），通过 `$handlers` 目录监听事件（`*.handler.ts`），实现解耦协作。

- `./docs/events.md`：当你需要定义事件、编写事件监听、或进行跨模块通信时阅读。

### 类型、数据与工具方法（`$types` / `$data` / `$utils`）

模块目录下**禁止**直接散放共享 `.ts` 文件（如 `xxx-shared.ts`、`xxx-service.ts`）。模块内需要复用的代码，按性质归入以下三个目录：

- **类型 → `$types`**（`*.types.ts`）：跨文件复用的 type / interface 定义。
- **数据 → `$data`**（`*.data.ts`）：常量表、模块级运行时缓存（如 `Map` 缓存）等静态或长生命周期数据。
- **工具方法 → `$utils`**（`*.utils.ts`）：纯函数工具。**抽离前必须确认调用处至少为两处**（测试文件不计入）；只有一处调用时，直接以过程式的写法，内联在调用处所在文件的逻辑中，不要抽离成公共方法。

### 模块目录总览

```
app/modules/{module-name}/
├── $databases/        # 数据库表定义（*.table.ts）
├── $caches/           # 二级缓存（*.cache.ts）
├── $events/           # 事件定义（*.event.ts）
├── $handlers/         # 事件监听（*.handler.ts）
├── $exports/          # 内部动作（*.action.ts，不注册为端点）
├── $codes/            # 模块专属错误码（*.code.ts）
├── $seeds/            # 测试种子数据（*.seed.ts）
├── $configs/          # 模块配置（*.config.ts）
├── $types/            # 类型定义（*.types.ts）
├── $data/             # 常量表、模块级缓存等数据（*.data.ts）
├── $utils/            # 工具方法（*.utils.ts，调用处 ≥2 才允许抽离）
├── $stores/           # 前端存储（仅状态管理器工程）
├── $bootstraps/       # 模块级启动引导
├── add.action.ts      # API 端点
├── browse.action.ts
├── read.action.ts
├── edit.action.ts
├── delete.action.ts
└── __TEST__.test.ts      # 测试文件
```
