# 订阅变更

## 订阅

Kurimudb 中，`$` 符号代表 `subscribe` 的简写。你可以在一个值后加上 `$` 符号来订阅它的变更：

```js
configState.data.foo$((value, key) => {
  console.log(value, key);
});
```

默认情况下，闭包函数会立即执行一次，方便你为你视图中的响应式变量赋初始值。如果你不希望这么做，而是只在后续值变更时执行，那么如下即可：

```js {5}
configState.data.foo$(
  (value, key) => {
    console.log(value, key);
  },
  { immediate: false },
);
```

你也可以使用[类 Storage Api](/docs/model/#%E7%B1%BB-storage-api) 的形式进行订阅：

```js
configState.subscribeItem(key, closFunc, config);
```

## 批量订阅

如果你想一次订阅多个值的变更，可以使用 `batch$` 函数：

```js
import { batch$ } from 'kurimudb';

batch$([configState.data.foo$, configState.data.bar$], (value, key) => {
  console.log(value, key);
});
```

## 自动订阅

手动声明要订阅的值可能会有些繁琐，我们还提供了一种便捷的方式。当你在闭包中所使用的值有任一被更改时，都会触发一次订阅：

```js
configState.auto$(() => {
  console.log(configState.data.foo);
  console.log(configState.data.bar);
});
```

在闭包函数的首次执行过程时，Kurimudb 会收集其中哪些值被读取，随后订阅它们，因此，闭包函数**必须是同步的**。

## 全局自动订阅

前文自动订阅功能的**范围是你的模型**，如果你在其中读取了外部模型的数据，是不会被订阅的。如果你想自动订阅任一模型的数据，你可以使用全局自动订阅：

```js
import { auto$ } from 'kurimudb';

auto$(() => {
  console.log(fooState.data.foo);
  console.log(barState.data.bar);
});
```

::: warning 注意事项

和自动订阅功能不同，由于 JavaScript 的限制，全局自动订阅功能不适用于**异步模型**。我们想到了一种变通的方式，来实现支持异步模型的全局自动订阅功能，但是此功能还在开发中。

:::

## 订阅模型

你还可以订阅整个模型的变更，当模型中有任一值变更时，闭包函数都会触发。

这通常用于你不知道要订阅的是哪个值的场景，如**集合模型**上。一个常见的例子：存储草稿的集合模型，视图需要在用户保存/新增/删除草稿时即时变化，这时就派上用场啦。

想要订阅模型的变更，只需要调用 `yourModel.$` 函数即可：

```js {3,4,5}
ref: currentDraftData = [];

draftList.$((key) => {
  currentDraftData = draftList.all();
});

// in view..

draftList.insert({
  // ..
});
```

## 退订

当你执行了订阅函数后，返回值将是一个退订函数，执行它，会将此订阅退订：

```js
const unsubscribe = configState.data.foo$((value, key) => {
  // ..
});

// 退订
unsubscribe();
```

## 自动退订

如果你正在使用 Vue/React 等框架，你可能会希望，在组件被销毁时，自动退订此组件中产生的所有订阅。

你可以向 `globalConfig.autoUnsubscribe` 上挂载一个函数，此函数会在每次执行订阅函数时执行，你可以利用它结合所使用框架的生命周期 Api，来实现自动退订。

### Vue3

```js
// 你可以把这些代码，写在你项目的 index.js 里
// 在你任何 vue 组件被实例化之前执行

import { onBeforeUnmount } from 'vue';
import { globalConfig } from 'kurimudb';

globalConfig.setAutoUnsubscribe((unsubscribe) => {
  onBeforeUnmount(() => unsubscribe());
});
```

### React

```js
// 你可以把这些代码，写在你项目的 index.js 里
// 在你任何 react 组件被实例化之前执行

import { onBeforeUnmount } from 'vue';
import { globalConfig } from 'kurimudb';

globalConfig.setAutoUnsubscribe((unsubscribe) => {
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, []);
});
```

### 忽略自动退订

如果你使用了自动退订功能，却又不希望部分场景下自动退订，如下即可：

```js {5}
configState.data.foo$(
  (value, key) => {
    console.log(value, key);
  },
  { autoUnsubscribe: false },
);
```
