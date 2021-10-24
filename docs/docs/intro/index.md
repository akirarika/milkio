# 入门

## Kurimudb 是什么

Kurimudb 是一款渐进式的 **Web 端本地存储库**，可将数据保存到 LocalStorage、IndexedDB、Cookie 等地方，和订阅值的变更。

除了持久化数据之外，若你愿意，Kurimudb 还能成为你应用的 [Model 层](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel#Components_of_MVVM_pattern)抽象，接任你应用中状态管理库的职责 (如 Vuex、Redux、Mobx)，使你应用真正拥有单一数据来源。

Kurimudb 的数据存储功能是驱动化的，这意味着你可以在不更改代码的情况下更换具体实现，我们制作了几个常用的驱动，如果不满足需求的话，你也可以编写属于自己的驱动。

## 体验

`kurimudb-zero-config` 是 Kurimudb 的零配置包，执行下面命令来安装它：

```bash
npm i kurimudb-zero-config@5
```

### Local

操作 `local` 对象，可以把数据存储在 LocalStorage 中。即使页面刷新，数据还会在哒！可以存储约 5M 数据。

```js
import { local } from "kurimudb-zero-config";

local.data.say = "hello world"; // 写入..
let say = local.data.say; // 读取..
delete local.data.say; // 删除..
if ("say" in local.data) { ... } // 判断是否存在..
```

### Cookie

操作 `cookie` 对象，可以把数据存储在 Cookie 中，其中存储的数据应当尽量的少，因为浏览器一般会在每次请求时，将你的 Cookie 都发送给服务端~

```js
import { cookie } from "kurimudb-zero-config";

cookie.data.say = "hello world"; // 写入..
let say = cookie.data.say; // 读取..
delete cookie.data.say; // 删除..
if ("say" in cookie.data) { ... } // 判断是否存在..
```

### Memory

操作 `memory` 对象，可以把数据存储在 Memory 中，当页面刷新时，数据就被清空啦。

```js
import { memory } from "kurimudb-zero-config";

memory.data.say = "hello world"; // 写入..
let say = memory.data.say; // 读取..
delete memory.data.say; // 删除..
if ("say" in memory.data) { ... } // 判断是否存在..
```

### Db

操作 `db` 对象，可以把数据存储在 IndexedDB 中，IndexedDB 可以保存诸如 File、Blob 等 JavaScript 对象，其最大数据容量，基于用户设备的可用硬盘大小。

::: warning 注意事项

由于 IndexedDB 的 Api 是异步的，因此 `db` 和读有关的 Api 返回值都是 [Promise 对象](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)。

:::

```js
import { db } from "kurimudb-zero-config";

db.setItem("say", "hello world"); // 写入..
let say = await db.getItem("say"); // 读取，返回值将是 Promise..
await db.removeItem("say"); // 删除..
if (await db.hasItem("say")) { ... } // 判断是否存在..
```

### 订阅变更

Kurimudb 还提供了订阅值变化的功能，只需在值后加上 `$` 符号，就能在它被改变时做点什么：

```js
local.data.say$((val) => {
  console.log('what you want to say: ' + val);
});
```

或者使用**自动订阅功能**，当闭包中用到的值，有任一被更改时，都会触发订阅，重新执行此闭包：

```js
import { auto$ } from 'kurimudb-zero-config';

auto$(() => {
  console.log(configState.data.foo);
  console.log(configState.data.bar);
});
```

关于订阅，还有更多的高级用法噢！请阅读[订阅变更](/subscribe)章节。

## 准备好了吗？

我们刚刚介绍了 Kurimudb 的核心用法——但这只是 Kurimudb 功能的很小一部分，所以，请务必读完整个教程！
