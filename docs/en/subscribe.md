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
  { immediate: false }
);
```

你也可以使用[类 Storage Api](/model.html#%E7%B1%BB-storage-api) 的形式进行订阅：

```js
configState.subscribeItem(key, closFunc, config);
```

## 批量订阅

如果你想一次订阅多个值的变更，可以使用 `batch$` 函数：

```js
import { batch$ } from "kurimudb";

batch$([configState.data.foo$, configState.data.bar$], (value, key) => {
  console.log(value, key);
});
```

## 自动订阅

手动声明要订阅的值可能会有些繁琐，我们还提供了一种便捷的方式。当你在闭包中所使用的值有任一被更改时，都会触发一次订阅：

```js
import { auto$ } from "kurimudb";

auto$(() => {
  console.log(configState.data.foo);
  console.log(configState.data.bar);
});
```

在闭包函数的首次执行过程时，Kurimudb 会收集其中哪些值被读取，随后订阅它们，因此，闭包函数**必须是同步的**。

> 📜 使用此功能需要 (^3.1.1) 版本。

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

## Cancel Subscriptions

When you execute subscription function, the return value will be a cancelling subscription function. The subscription will be unsubscribed after you execute it.
当你执行了订阅函数后，返回值将是一个退订函数，执行它，会将此订阅退订：

```js
const unsubscribe = configState.data.foo$((value, key) => {
  // ..
});

// 退订
unsubscribe();
```

## Automatically Cancel Subscriptions

If you are using Vue/React or other frameworks, you probably hope to see all subscriptions generated in the components will be automatically unsubscribed when the components are destroyed.

You can mount a function to `kurimudbConfig.autoUnsubscribe`. This function will be executed every time the subscription function is executed. You can use it in conjunction with the lifecycle APIs of the framework to realize automatic unsubscriptions.

### Vue3

```js
import { onBeforeUnmount } from "vue";
import { kurimudbConfig } from "kurimudb";

kurimudbConfig.autoUnsubscribe = (unsubscribe) => {
  onBeforeUnmount(() => unsubscribe());
};
```

### React

To be continued... 🐸

### Ignore Automatic Unsubscriptions

如果你使用了自动退订功能，却又不希望部分场景下自动退订，如下即可：

```js {5}
configState.data.foo$(
  (value, key) => {
    console.log(value, key);
  },
  { autoUnsubscribe: false }
);
```
