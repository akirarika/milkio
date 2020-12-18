# Kurimudb 介绍

Kurimudb 是 Web 应用的数据层仓库，可以**持久化数据**、实现**状态管理**，用法就像操作一个普通对象一样简单。

对于现在流行的数据绑定框架来说，一般来说，都缺少了 `MVVM` 中的 `Model` 部分，尽管状态管理库 (如 `Vuex/Redux`) 的出现进行了一些补全。

在我的想象中，一个 Web 应用完整的 `Model` 部分应该拥有以下功能：

1. 应用的数据源不应只是来自在内存中的对象，还应该可以来自持久化在用户本地的数据，和 Api 接口响应的内容。

2. 数据源的变更，不应该直接导致视图更新，而是应该通知组件，由组件决定如何处理视图的更新。

3. 操作数据源的 Api 应该足够简便易用，最好就像操作一个普通对象一样，而不是根据约定写字符串，和函数的层层调用。

## 简单语法

Kurimudb 的语法非常简单，就像操作一个普通的 Javascript 对象一样。

但背后，你的数据已经被持久化到了本地，还可以订阅它未来的更新。

``` js
import myModel from "models/myModel"
// create or update
myModel.data.say = "hello world"
// read
await myModel.data.say
// subscribe to updates for this data (Powered by ReactiveX)
myModel.data.say$.subscribe(...)
// delete
delete myModel.data.say
```

## 持久化数据

你的数据可以持久化到用户本地的 Indexeddb 中，与 Localstorage 的 5M 大小限制不同，它拥有[大得多的限制](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Browser_storage_limits_and_eviction_criteria)，同时性能也更好。

使用 Kurimudb 的持久化存储功能时，除了按键值对的方式存储数据，也可以存储主键递增的集合 (类似数组一样)。

```js
import bookModel from "models/bookModel"

const book1 = await new bookModel.data({
    name: "Alice in Wonderland",
    author: "Lewis Carroll",
})
const book2 = await new bookModel.data({
    name: "Vingt mille lieues sous les mers",
    author: "Jules Gabriel Verne",
})

book1.id // echo 1
book2.id // echo 2

await bookModel.data[1].name // echo "Alice in Wonderland"
await bookModel.data[2].name // echo "Vingt mille lieues sous les mers"
```

## 管理应用状态

在使用传统的状态管理包 (如 Vuex、Redux) 时，我们可能会遇到这些问题：

1. 状态无法持久化，在刷新后就会丢失。
2. 操作 Store 必须通过 Action，对某些应用来说实在太过繁琐。
3. Action 中不能执行异步操作。
4. 当状态变更时，组件也会直接变更，有时我们更希望通过一个函数处理变更。
5. 不容易实现监听一个 Store 下任意值的变更。

这些在问题 Kurimudb 进行了解决。可参阅[状态管理](/state/)部分。
