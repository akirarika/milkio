# Point Store

当 Milkio 工程用作前端状态管理器（embed）时，你可以通过 Milkio 的事件系统 (Events) 来推送给前端视图层 (vue 组件)，触发前端内容的更新。

## 具体示例

首先，我们需要在模块的 `$states` 目录下定义实际的状态，用任何方式定义都可以，甚至，你的状态可以使用普通的 JavaScript 对象来实现。这些文件以 `*.state.ts` 命名。内容你可以自由组织，只需要确保它对外导出了一个可增删改查数据的内容即可，甚至是导出一个普通的 JavaScript 对象。但是，不得在其中编写任何逻辑代码。如果你要导出方法，你只能导出普通的诸如 `get`、`set` 等方法，而不能在里面封装任何业务逻辑，甚至包括数据校验、数据结构重组等方法，也不能在这里编写。

换句话说，它必须要符合"贫血模型"的概念，贫血模型是软件设计中的一种领域模型模式，其核心特征是领域对象（如实体、值对象）仅包含数据属性或者简单的访问方法（getter/setter），而将所有业务逻辑都剥离到外部去处理。相似的代码你必须重复地在端点中编写多次，而不应该“封装”在 state 内。

### 文件规范

```
app/modules/example/
├── $states/
│   └── sidebar.state.ts    # 状态定义文件
├── toggle-sidebar.action.ts
└── ...
```

注意，每个状态文件，都必须显式导出类型和实例。再次强调，状态文件中不得编写任何业务逻辑。

你可以写这样的代码：

```ts
// /app/modules/example/$states/panel.state.ts
export type PanelState = {
  open: boolean;
  activeTab: string;
};

const instances = new Map<string, Promise<PanelState>>();

async function __createPanelState(): Promise<PanelState> {
  return {
    open: false,
    activeTab: 'foo',
  } satisfies PanelState;
}

export function usePanelState(userId: string): Promise<PanelState> {
  if (instances.has(userId)) return instances.get(userId)!;
  const promise = __createPanelState();
  instances.set(userId, promise);
  return promise;
}
```

通常情况下，你大概率都需要隔离状态，因为，用户可能会退出登录 / 重新登录，尽管属于低频场景，但是不同账号的状态确实是应该不一样的。当你认为状态确实不需要按 id 隔离时，`useXxxState` 无需接受参数，内部使用 `const staticKey = '$'` 作为固定的 key：

```ts
// /app/modules/example/$states/sidebar.state.ts
export type SidebarState = {
  open: boolean;
  width: number;
  activeId: string | null;
};

const instances = new Map<string, Promise<SidebarState>>();

async function __createSidebarState(): Promise<SidebarState> {
  return {
    open: true,
    width: 260,
    activeId: null,
  } satisfies SidebarState;
}

export function useSidebarState(): Promise<SidebarState> {
  const staticKey = '$';
  if (instances.has(staticKey)) return instances.get(staticKey)!;
  const promise = __createSidebarState();
  instances.set(staticKey, promise);
  return promise;
}
```

使用示例：

在 action 中读写：

```ts
// /app/modules/example/toggle-sidebar.action.ts
import { useSidebarState } from "./$states/sidebar.state.ts";

export async function handler(context: MilkioContext, params: Params) {
  context.logger.info('端点请求参数 (toggle-sidebar.action.ts)', JSON.stringify(params));

  const sidebarState = await useSidebarState();
  if (params.open !== undefined) sidebarState.open = params.open;

  // 修改后 emit 到 ipcRefs，通知前端
  await context.emit('app:sidebar', { ...sidebarState });

  const result = { success: true };
  context.logger.info('端点请求结果 (toggle-sidebar.action.ts)', JSON.stringify(result));
  
  return result;
};
```

这里只是一个简单的示例，在大多数情况下，使用普通的 JavaScript 对象来存储状态就足够了。如果你需要持久化地保存数据，你可能需要使用 `localforage`、`dexie` 之类的库来实现。谨记这需要是一个贫血模型，不要在状态中编写任何业务逻辑，你应该直接导出这个普通的 JavaScript 对象本身，或者导出一个 `localforage` 的 instance 等。总之，你需要根据你的实际业务需要，来选择最合适的技术栈来存储状态。但是必须遵循贫血模型的概念。

```ts
// localforage
const instances = new Map<string, Promise<Localforage>>();

async function __createSidebarState(): Promise<Localforage> {
  return localforage.createInstance({ name: "sidebar" });
}

export function useSidebarState(): Promise<Localforage> {
  const staticKey = '$';
  if (instances.has(staticKey)) return instances.get(staticKey)!;
  const promise = __createSidebarState();
  instances.set(staticKey, promise);
  return promise;
}
```

---

## 定义事件

事件类型定义在 `$events` 目录下，是 `ipcRefs` 的类型来源。构建工具会根据此文件自动校验 `context.emit` 的参数类型。

### 文件规范

```
app/modules/tab/
├── $events/
│   └── tab.event.ts
├── $states/
└── ...
```

每个事件文件导出一个名为 `_` 的 interface：

```ts
// /app/modules/tab/$events/tab.event.ts
export interface _ {
  'app:tabs': {
    activeTab?: Tab;
    systemTabs: SystemTabs;
    fixedTabs: Tabs;
    tempTabs: Tabs;
  };
  'app:closed:tab': {
    timestamp: number;
    data: Array<{ component: string; meta: string }>;
  };
}
```

注意，你必须使用**`app:` 前缀**。推送到前端的事件必须使用此前缀，只有以此前缀开头的才会被同步发送给前端。

## 前端使用

在前端，通过 `ipcRefs` 可以获取到以 `app:` 开头的事件的内容，会被转化成一个只读的 `ref`。它是与前端 Vue 组件的响应式状态桥梁。

```vue
<template>
  <!-- 在模板中直接使用其中的值 -->
  <div v-if="ipcRefs['app:user-device'].value?.user">
    {{ ipcRefs['app:user-device'].value.user.name }}
  </div>
</template>
```

```vue
<script lang="ts" setup>
const ipcRefs = await useIpcRefs();

// watch 监听事件变化
watch(() => ipcRefs['app:tabs'].value?.activeTab, async (data) => {
  if (!data) return;
  // 处理业务逻辑...
}, { immediate: true, deep: true });
</script>
```

### 工作原理

```
调用 context.emit('app:xxx', data) 发送事件
        ↓
事件通过 Worker/SSE 推送到前端
        ↓
框架会自动更新 ipcRefs['app:xxx'].value 的值
        ↓
Vue 组件通过 useIpcRefs() 获取响应式 Ref，直接读取或 watch
```

前端组件通过 `useIpcRefs()` 获取一个 Proxy 对象，键为事件名，值为 `DeepReadonly<Ref<T | undefined>>`。每个键都是一个 Vue 响应式 Ref，可以在模板中直接使用或通过 `watch` 监听变化。

## 推送事件到前端

任何 action 执行"写"操作后，都应 `emit` 更新 `ipcRefs`，让前端自动响应变化：

```ts
// /app/modules/tab/navigate-to.action.ts
export async function handler(context: MilkioContext, params: { component: string; meta?: string }) {
  const tabState = await useTabState(context.user?.userDevice.id);

  // 执行写操作...

  // emit 完整的最新状态到 ipcRefs
  await context.emit('app:tabs', { ... });
}
```

## 为 ipcRefs 赋予初始值

我们可能需要在启动时推送初始数据，让前端组件能立即拿到正确的状态。你可以通过 `$handlers` 监听 `life-cycle:mounted` 生命周期事件来实现。只有所有的 `life-cycle:mounted` 执行完成 (会被 await)，应用程序才会正常执行。

```ts
// /app/modules/tab/$handlers/tab.handler.ts
export default (world: MilkioWorld<typeof generated>) => {
  world.on('life-cycle:mounted', async (context) => {
    // 初始化标签页数据
    await context.emit('app:tabs', {
        // ...
    });
  });
};
```

## 事件推送的过滤逻辑

`watch.stream.ts` 是前端订阅的流端点，它监听所有事件，但只将 `app:` 前缀的事件推送到前端：

```ts
// /app/modules/event/watch.stream.ts
export async function* handler(context: MilkioContext, params: {}) {
  const flow = createFlow<{ key: string; data: any }>();

  context._.on('*', ({ key, value }) => {
    if (!key.startsWith('app:')) return;  // 仅推送 app: 前缀的事件
    flow.emit({ key, data: value });
  });

  for await (const chunk of flow) yield chunk;
}
```

## 完整示例

### 1. 事件定义

```ts
// /app/modules/tab/$events/tab.event.ts
import type { SystemTabs, Tab, Tabs } from '../$states/tab.state';

export interface _ {
  'app:tabs': {
    activeTab?: Tab;
    systemTabs: SystemTabs;
    fixedTabs: Tabs;
    tempTabs: Tabs;
  };
  'app:closed:tab': {
    timestamp: number;
    data: Array<{ component: string; meta: string }>;
  };
}
```

### 2. 赋予 ipcRefs 初始值

```ts
// /app/modules/tab/$handlers/tab.handler.ts
export default (world: MilkioWorld<typeof generated>) => {
  world.on('life-cycle:mounted', async (context) => {
    const tabState = await useTabState(context.user?.userDevice.id);
    await context.emit('app:tabs', { ... });
  });
};
```

### 3. Action 执行写操作并更新 ipcRefs

```ts
// /app/modules/tab/navigate-to.action.ts
export async function handler(context: MilkioContext, params: { component: string; meta?: string }) {
  context.logger.info('端点请求参数 (navigate-to.action.ts)', JSON.stringify(params));

  const tabState = await useTabState(context.user?.userDevice.id);
  
  // 写入数据..
  
  // 写入完成，发送给前端更新后的状态数据
  await context.emit('app:tabs', { ... });
}
```

### 4. 前端通过 ipcRefs 读取和监听

```vue
<script lang="ts" setup>
const ipcRefs = await useIpcRefs();

watch(() => ipcRefs['app:tabs'].value?.activeTab, async (activeTab) => {
  if (!activeTab) return;
  // 加载对应视图组件...
}, { immediate: true, deep: true });
</script>
```

## 对于复杂的用例

你要时刻记住，`ipcRefs` 是用来共享"状态"的，而不是共享"数据"的。它的数据量必须是极小极简单的。

当有时我们预料到数据较多较复杂时，使用 `ipcRefs` 会导致前端的状态树过于庞大，内存占用过多，性能下降。毕竟数据在内存中真实地存在了至少两份，且内容在通信时会不可避免地有序列化的开销。

此时，我们就需要像编写传统的后端应用程序一样，在 embed 中编写一些 `browse.action.ts` 和 `read.action.ts`，前端通过 `aurora.ipc.execute` 调用它们获取所需的、小范围的数据。**注意：这些 browse 和 read 端点必须在 embed 中实现，而非在前端直连 server 调用。** embed 中的 browse/read 端点负责向 server 发起请求，并可选择性地进行缓存处理。

当数据有任何更新时，我们推送一个更改的事件（`app:*:changed`），里面仅包括更改的内容 id 和时间戳。前端组件通过监听这些事件来了解数据的变更范围，然后按需重新调用查询端点，获取最新的数据。

假设，我们正在开发一个 `space` 模块，一个用户可能会有无数个空间，很显然，这不是数据量极小极简单的场景。我们不希望将所有内容数据都推送到 `ipcRefs`，而是只在内容发生变更时通知前端。

```ts
// /app/modules/space/$events/content.event.ts
export interface _ {
  'app:space:changed': { // 内容变更通知（只推送 id + 时间戳）
    spaceId: string;
    timestamp: number;
  };
}
```

### embed 中的 browse/read 端点示例

当数据复杂时，应在 embed 中创建 browse 和 read 端点，前端通过 `aurora.ipc.execute` 调用。`Result` 类型应通过 `stargate.$types.results` 从 server 自动推导，而非手动定义，以确保与后端返回类型始终同步：

```ts
// /app/modules/space/browse.action.ts
import type { MilkioContext, MilkioMeta } from '../../../.milkio/declares.ts';
import { stargate } from '../../utils/stargate.ts';

export const meta: MilkioMeta = {};

type Params = {
  type?: string;
  cursor?: string;
  limit?: number;
};

type Result = (typeof stargate.$types.results)['/space/browse'];

export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  context.logger.info('端点请求参数 (browse.action.ts)', JSON.stringify(params));

  const [error, result] = await stargate.execute('/space/browse', {
    params: {
      type: params.type,
      cursor: params.cursor,
      limit: params.limit,
    },
  });
  if (error) {
    context.logger.error('远程调用失败 (browse.action.ts)', JSON.stringify(error));
    throw context.reject(error);
  }

  const data = {
    data: result?.data ?? [],
    cursor: result?.cursor,
  };
  context.logger.info('端点请求结果 (browse.action.ts)', JSON.stringify(data));

  return data;
}
```

```ts
// /app/modules/space/read.action.ts
import type { MilkioContext, MilkioMeta } from '../../../.milkio/declares.ts';
import { stargate } from '../../utils/stargate.ts';

export const meta: MilkioMeta = {};

type Params = {
  id: string;
};

type Result = (typeof stargate.$types.results)['/space/read'];

export async function handler(
  context: MilkioContext,
  params: Params,
): Promise<Result> {
  context.logger.info('端点请求参数 (read.action.ts)', JSON.stringify(params));

  const [error, result] = await stargate.execute('/space/read', {
    params: {
      id: params.id,
    },
  });
  if (error) {
    context.logger.error('远程调用失败 (read.action.ts)', JSON.stringify(error));
    throw context.reject(error);
  }

  const data = {
    data: result?.data,
  };
  context.logger.info('端点请求结果 (read.action.ts)', JSON.stringify(data));

  return data;
}
```

前端调用方式：

```vue
<script setup lang="ts">
const aurora = await useAurora();

// 通过 embed 获取空间列表（而非直接调用 server）
const [error, result] = await aurora.ipc.execute('/space/browse', {
  params: { type: 'plan' },
});
</script>
```

## 测试

你应该在对应模块的目录下创建一个 `__TEST__.test.ts`，在里面存放该模块所有相关的测试代码，并且在每次编写完成代码之后，运行一遍相关的测试。使用 **Vitest** 作为测试运行器。

### generateParams 是必填字段

每次调用 `world.execute` 都必须显式指定 `generateParams`，不能省略：

- **`generateParams: true`**：自动生成符合接口类型定义的随机参数。适用于 `adjust` 调试测试，或参数全部可随机生成的场景。如果同时提供了 `params`，则 `params` 中指定的字段使用你的值，其余字段自动生成。
- **`generateParams: false`**：不自动生成参数，仅使用你提供的 `params`。**当你手动指定了 `params` 时必须设为 `false`**，否则 TypeScript 会报类型错误——因为 `generateParams: true` 的分支要求参数类型为可选，与手动传入的完整参数类型不兼容。

```ts
// 正确：调试时用 true 自动生成
await world.execute('/note/add-directory', { generateParams: true });

// 正确：手动参数 + generateParams: false
const [error, result] = await world.execute('/note/browse-directory', {
  generateParams: false,
  params: { spaceId, directoryId: '' },
});

// 正确：无参数时也必须显式设为 false
const [error, result] = await world.execute('/audio/init', { generateParams: false });

// 错误：有 params 但缺少 generateParams，会报类型错误
await world.execute('/note/browse-directory', { params: { spaceId, directoryId: '' } });

// 错误：无 params 也没有 generateParams，会报类型错误
await world.execute('/audio/init', {});
```

注意，`generateParams: true` 自动生成数据的规则是"浅层"的，只针对 `params` 中的浅层参数有效，不会尝试递归生成深层的随机参数。

### result 属性的非空断言

`world.execute` 返回的 `result` 中，某些属性类型可能为 `null` 或 `undefined`（如 `result.data`、`result.voice` 等）。TypeScript 不会从 `expect(...).not.toBeNull()` 推断类型窄化，因此在断言后访问这些属性仍需使用非空断言 `!`：

```ts
// 错误：result.data 可能为 undefined，TS 报错
const id = resultAddDir.data.id;

// 正确：使用 ! 非空断言
const id = resultAddDir.data!.id;

// 断言后再访问属性，仍需 !
expect(resultInit.voice).not.toBeNull();
expect(resultInit.voice!.volume).toBe(50);
```

### 错误处理

在测试代码中，使用以下方式检查错误类型：

```typescript
// 正确：检查错误对象中是否存在特定的错误码属性
if ("VERIFICATION_CODE_INVALID" in error) {
    // 处理验证码无效的错误
}

if (!("VERIFICATION_CODE_INVALID" in error)) {
    // 处理其他类型的错误
}
```

**禁止**使用以下方式判断错误类型，尽管它们可能在某些情况下运行正常，但会导致 TypeScript 类型推断不准确：

```typescript
// 错误！禁止使用
expect(error?.code).toBe("VERIFICATION_CODE_INVALID");
expect(error?.VERIFICATION_CODE_INVALID).toBeDefined();
```

### 测试用例注释

编写的测试需要包含详尽的中文注释，确保可读性。包括在测试开头添加多行注释，描述测试的意图，以及在测试的实际代码中，描述每一个步骤的作用。

```ts
/**
 * 嵌套目录测试
 * 验证目录嵌套和子目录内笔记的 CRUD：
 * 1. 在根目录创建文件夹 A
 * 2. 在文件夹 A 内创建子文件夹 B
 * 3. 在子文件夹 B 内创建笔记
 * 4. 浏览子文件夹 B（应含笔记）
 * 5. 浏览文件夹 A（应含子文件夹 B，无笔记）
 */
test('nestedDirectory', async () => {
  const [_context, reject, world] = await astra.createMirrorWorld(import.meta.url);

  // 创建文件夹 A
  const [errorAddA, resultAddA] = await world.execute('/note/add-directory', {
    generateParams: false,
    params: { spaceId, parentId: '', name: '文件夹A' },
  });
  if (errorAddA) throw reject('创建文件夹A失败', errorAddA);
  const dirAId = resultAddA.data!.id;

  // 在文件夹 A 内创建子文件夹 B
  const [errorAddB, resultAddB] = await world.execute('/note/add-directory', {
    generateParams: false,
    params: { spaceId, parentId: dirAId, name: '子文件夹B' },
  });
  if (errorAddB) throw reject('创建子文件夹B失败', errorAddB);
  const dirBId = resultAddB.data!.id;

  // 在子文件夹 B 内创建笔记
  const [errorAddNote, resultAddNote] = await world.execute('/note/add-note', {
    generateParams: false,
    params: { spaceId, parentId: dirBId, title: '子笔记' },
  });
  if (errorAddNote) throw reject('创建子笔记失败', errorAddNote);

  // 浏览子文件夹 B（应含笔记）
  const [errorBrowseB, resultBrowseB] = await world.execute('/note/browse-directory', {
    generateParams: false,
    params: { spaceId, directoryId: dirBId },
  });
  if (errorBrowseB) throw reject('浏览子文件夹B失败', errorBrowseB);
  expect(resultBrowseB.notes.length).toBe(1);
  expect(resultBrowseB.notes[0].title).toBe('子笔记');

  // 浏览文件夹 A（应含子文件夹 B，无笔记）
  const [errorBrowseA, resultBrowseA] = await world.execute('/note/browse-directory', {
    generateParams: false,
    params: { spaceId, directoryId: dirAId },
  });
  if (errorBrowseA) throw reject('浏览文件夹A失败', errorBrowseA);
  expect(resultBrowseA.directories.length).toBe(1);
  expect(resultBrowseA.directories[0].id).toBe(dirBId);
  expect(resultBrowseA.notes.length).toBe(0);
});
```

### 测试策略建议

* **成功路径测试**：验证动作在正常情况下的行为是否符合预期。
* **失败路径测试**：**至关重要**。应编写测试来验证代码在边界条件、异常输入或非法操作下的处理逻辑是否正确（例如，传递非法 ID、重复创建、权限不足等）。

### 测试用例示例

以下示例展示了 embed 工程中针对不同场景的标准测试写法：

**调试测试 (`adjust`)**：

调试测试用于在开发过程中快速验证接口是否可正常调用，不做断言，仅用于调试和观察返回值。

```ts
import { expect, test } from 'vitest';
import { astra } from '../../utils/test.ts';

test('adjust', async () => {
  const [_context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  // 调试：执行动作，generateParams 会自动生成符合接口定义的随机参数
  await world.execute('/note/add-directory', { generateParams: true });
});
```

**基础 CRUD 测试 (`basic`)**：

```ts
import { expect, test } from 'vitest';
import { astra } from '../../utils/test.ts';

/**
 * 基础创建与查询测试
 * 验证数据的创建和查询流程：
 * 1. 调用 add-directory 接口创建文件夹
 * 2. 浏览根目录，断言文件夹存在
 * 3. 在文件夹中创建笔记
 * 4. 浏览文件夹，断言笔记存在
 * 5. 删除笔记
 * 6. 删除文件夹
 * 7. 浏览根目录，断言为空
 */
test('basic', async () => {
  const spaceId = 'spc-test';
  const [_context, reject, world] = await astra.createMirrorWorld(import.meta.url);

  // 1. 创建文件夹 A
  const [errorAddDir, resultAddDir] = await world.execute('/note/add-directory', {
    generateParams: false,
    params: { spaceId, parentId: '', name: '文件夹A' },
  });
  if (errorAddDir) throw reject('创建文件夹失败', errorAddDir);
  expect(resultAddDir.data).not.toBeUndefined();
  const dirAId = resultAddDir.data!.id;

  // 2. 浏览根目录（应含文件夹 A）
  const [errorBrowse1, resultBrowse1] = await world.execute('/note/browse-directory', {
    generateParams: false,
    params: { spaceId, directoryId: '' },
  });
  if (errorBrowse1) throw reject('浏览根目录失败', errorBrowse1);
  expect(resultBrowse1.directories.length).toBe(1);
  expect(resultBrowse1.directories[0].id).toBe(dirAId);

  // 3. 在文件夹 A 中创建笔记
  const [errorAddNote, resultAddNote] = await world.execute('/note/add-note', {
    generateParams: false,
    params: { spaceId, parentId: dirAId, title: '笔记1' },
  });
  if (errorAddNote) throw reject('创建笔记失败', errorAddNote);
  expect(resultAddNote.data).not.toBeUndefined();
  const noteId = resultAddNote.data!.id;

  // 4. 浏览文件夹 A（应含笔记）
  const [errorBrowseA, resultBrowseA] = await world.execute('/note/browse-directory', {
    generateParams: false,
    params: { spaceId, directoryId: dirAId },
  });
  if (errorBrowseA) throw reject('浏览文件夹A失败', errorBrowseA);
  expect(resultBrowseA.notes.length).toBe(1);
  expect(resultBrowseA.notes[0].id).toBe(noteId);

  // 5. 删除笔记
  const [errorDeleteNote, resultDeleteNote] = await world.execute('/note/delete-note', {
    generateParams: false,
    params: { spaceId, id: noteId },
  });
  if (errorDeleteNote) throw reject('删除笔记失败', errorDeleteNote);

  // 6. 删除文件夹
  const [errorDeleteDir, resultDeleteDir] = await world.execute('/note/delete-directory', {
    generateParams: false,
    params: { spaceId, id: dirAId },
  });
  if (errorDeleteDir) throw reject('删除文件夹失败', errorDeleteDir);

  // 7. 浏览根目录（应为空）
  const [errorBrowseEnd, resultBrowseEnd] = await world.execute('/note/browse-directory', {
    generateParams: false,
    params: { spaceId, directoryId: '' },
  });
  if (errorBrowseEnd) throw reject('浏览根目录失败', errorBrowseEnd);
  expect(resultBrowseEnd.directories.length).toBe(0);
  expect(resultBrowseEnd.notes.length).toBe(0);
});
```

**状态初始化测试**：

验证 `init` 类动作返回的默认状态是否正确：

```ts
/**
 * 音频初始化测试
 * 验证 init 后各通道的默认值
 */
test('initDefaults', async () => {
  const [_context, reject, world] = await astra.createMirrorWorld(import.meta.url);

  const [errorInit, resultInit] = await world.execute('/audio/init', { generateParams: false });
  if (errorInit) throw reject('音频初始化失败', errorInit);

  // voice 通道：默认音量 50，playMode 'stop'，current 为 null
  expect(resultInit.voice).not.toBeNull();
  expect(resultInit.voice!.volume).toBe(50);
  expect(resultInit.voice!.playMode).toBe('stop');
  expect(resultInit.voice!.current).toBeNull();

  // music 通道：默认音量 50，playMode 'loop'，current 为 null
  expect(resultInit.music).not.toBeNull();
  expect(resultInit.music!.volume).toBe(50);
  expect(resultInit.music!.playMode).toBe('loop');
  expect(resultInit.music!.current).toBeNull();
});
```

**移动/排序测试**：

验证数据在目录间移动或排序的正确性：

```ts
/**
 * 移动笔记测试
 * 验证笔记在目录间移动：
 * 1. 创建文件夹 A 和文件夹 B
 * 2. 在文件夹 A 中创建笔记
 * 3. 将笔记移到文件夹 B 内
 * 4. 浏览文件夹 A（应无笔记）
 * 5. 浏览文件夹 B（应含该笔记）
 */
test('moveNote', async () => {
  const spaceId = 'spc-test';
  const [_context, reject, world] = await astra.createMirrorWorld(import.meta.url);

  // 创建文件夹 A
  const [errorAddA, resultAddA] = await world.execute('/note/add-directory', {
    generateParams: false,
    params: { spaceId, parentId: '', name: '文件夹A' },
  });
  if (errorAddA) throw reject('创建文件夹A失败', errorAddA);
  const dirAId = resultAddA.data!.id;

  // 创建文件夹 B
  const [errorAddB, resultAddB] = await world.execute('/note/add-directory', {
    generateParams: false,
    params: { spaceId, parentId: '', name: '文件夹B' },
  });
  if (errorAddB) throw reject('创建文件夹B失败', errorAddB);
  const dirBId = resultAddB.data!.id;

  // 在文件夹 A 中创建笔记
  const [errorAddNote, resultAddNote] = await world.execute('/note/add-note', {
    generateParams: false,
    params: { spaceId, parentId: dirAId, title: '待移动笔记' },
  });
  if (errorAddNote) throw reject('创建笔记失败', errorAddNote);
  const noteId = resultAddNote.data!.id;

  // 将笔记从文件夹 A 移到文件夹 B 内
  const [errorMove, resultMove] = await world.execute('/note/move', {
    generateParams: false,
    params: {
      spaceId,
      sourcePathIds: [dirAId],
      movingId: noteId,
      targetPathIds: [],
      targetId: dirBId,
      position: 'inside',
    },
  });
  if (errorMove) throw reject('移动笔记失败', errorMove);

  // 浏览文件夹 A（应无笔记）
  const [errorBrowseA, resultBrowseA] = await world.execute('/note/browse-directory', {
    generateParams: false,
    params: { spaceId, directoryId: dirAId },
  });
  if (errorBrowseA) throw reject('浏览文件夹A失败', errorBrowseA);
  expect(resultBrowseA.notes.length).toBe(0);

  // 浏览文件夹 B（应含该笔记）
  const [errorBrowseB, resultBrowseB] = await world.execute('/note/browse-directory', {
    generateParams: false,
    params: { spaceId, directoryId: dirBId },
  });
  if (errorBrowseB) throw reject('浏览文件夹B失败', errorBrowseB);
  expect(resultBrowseB.notes.length).toBe(1);
  expect(resultBrowseB.notes[0]!.id).toBe(noteId);
});
```