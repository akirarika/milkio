# 入门

## Kurimudb 是什么

Kurimudb 是一款渐进式的 **Web 端本地存储包**，可将数据保存到 LocalStorage、IndexedDB、Cookie 等地方，和订阅值的变更。

除了持久化数据之外，若你愿意，Kurimudb 还能成为你应用的 [Model 层](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel#Components_of_MVVM_pattern) 抽象，接任你应用中状态管理库的职责 (如 Vuex、Redux、Mobx)，使你应用真正拥有单一数据来源。

Kurimudb 的数据存储功能是驱动化的，这意味着你可以在不更改代码的情况下更换具体实现，我们制作了几个常用的驱动，如果不满足需求的话，你也可以编写属于自己的驱动。

## 体验

`kurimudb-zero-config` 是 Kurimudb 的零配置包，执行下面命令来安装它：

```bash
npm i kurimudb-zero-config@3
```

它提供了 `local`、`db`、`cookie`、`memory` 四个对象。使用起来很简单：

```js
import { local, db, cookie, memory } from "kurimudb-zero-config";

/**
 * local 对象
 * 它会把你的数据存储在 LocalStorage 中，即使页面刷新，数据还会在哒！
 * LocalStorage 一般可以存储约 5MB 左右的数据
 */
local.data.say = "hello world"; // 写入..
let say = local.data.say; // 读取..
delete local.data.say; // 删除..
"say" in local.data; // 判断是否存在..

/**
 * cookie 对象
 * 它会把你的数据存储在 Cookie 中，Cookie 一般会自动随请求发送给服务端
 * 由于每次请求都会携带所有 Cookie，其中存储的数据应当尽量的少
 */
cookie.data.say = "hello world"; // 写入..
let say = cookie.data.say; // 读取..
delete cookie.data.say; // 删除..
"say" in cookie.data; // 判断是否存在..

/**
 * memory 对象
 * 它会把你的数据存储在 Memory 中，当页面刷新时，数据就被清空啦
 */
memory.data.say = "hello world"; // 写入..
let say = memory.data.say; // 读取..
delete memory.data.say; // 删除..
"say" in memory.data; // 判断是否存在..

/**
 * db 对象
 * 它会把你的数据存储在 IndexedDB 中，注意，IndexedDB 是异步的哦！
 * IndexedDB 可以保存诸如 File、Blob 等 JavaScript 原生对象
 * 其最大数据容量，基于用户设备的可用硬盘大小
 */
db.data.say = "hello world"; // 写入..
let say = await db.data.say; // 读取，记得加 await..
delete db.data.say; // 删除..
db.has("say"); // 判断是否存在..
```

前文中看起来，我们好像是在操作普通的 Javascript 对象。但是，在背后，数据已经被存储到各种地方啦。

Kurimudb 还提供了订阅值变化的功能，只需在值后加上 `$` 符号，就能在它被改变时做点什么：

```js
import { local } from "kurimudb";

local.data.say = "hello world!";
// 订阅这个变量..
local.data.say$((val) => {
  console.log("what you want to say: " + val);
});

local.data.say = "hello kurimudb!";

// echo "what you want to say: hello world!"
// echo "what you want to say: hello kurimudb!"
```

默认情况下，闭包函数会立即执行一次，方便你为你视图中的响应式变量赋初始值。如果你不希望这么做，而是只在后续值变更时执行，那么如下即可：

```js {9}
import { local } from "kurimudb";

local.data.say = "hello world!";
// 订阅这个变量..
local.data.say$(
  (val) => {
    console.log("what you want to say: " + val);
  },
  { immediate: false }
);

local.data.say = "hello kurimudb!";

// echo "what you want to say: hello kurimudb!"
```

## 准备好了吗？

我们刚刚介绍了 Kurimudb 的核心用法——但这只是 Kurimudb 功能的很小一部分，所以，请务必读完整个教程！
