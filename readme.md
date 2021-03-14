# 介绍

[![](https://img.shields.io/badge/文档-点击阅读文档-white.svg)](//kurimudb.nito.ink/) ![](https://img.shields.io/github/forks/akirarika/kurimudb) ![](https://img.shields.io/github/stars/akirarika/kurimudb) ![](https://img.shields.io/badge/language-javascript-orange.svg) ![](https://img.shields.io/github/license/akirarika/kurimudb)

## Kurimudb 是什么

![](./illu.jpg)

Kurimudb 是一款渐进式的 **Web 数据仓库**，可将数据保存到 LocalStorage、IndexedDB、Cookie 等地方，以及订阅其值的变更。

除了持久化数据之外，若你愿意，Kurimudb 还能成为你应用的 [Model 层](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel#Components_of_MVVM_pattern) 抽象，然后接任你应用中状态管理库的职责 (如 Vuex、Redux、Mobx)，并使你应用真正拥有单一数据来源。

Kurimudb 是驱动化的，这意味着你可以不更改代码的情况下更换具体实现。其中订阅更新功能，内置了 `Rxjs` 一种驱动；持久化功能，内置了 `Cookie` `LocalStorage` 和 `Dexie (IndexedDB)` 三种驱动。如果不满足你的需求，你也可以编写自己的驱动实现。

## 快速体验

`kurimudb-zero-config` 是 Kurimudb 的零配置包。安装它，即可使用 Kurimudb 除模块化以外的大部分功能。

```sh
npm i kurimudb-zero-config
# or yarn add kurimudb-zero-config
```

下面是使用它进行增删改查的例子：

```js
import { memory, local, db } from "kurimudb-zero-config";

/**
 * local 对象
 * 它会把你的数据存储在 LocalStorage 中，即使页面刷新，数据还会在哒！
 * LocalStorage 一般可以存储约 5MB 左右的数据
 */
local.data.say = "hello world"; // 创建或更新..
const say = local.data.say; // 读取..
delete local.data.say; // 删除..
"say" in local.data; // 判断是否存在..

/**
 * db 对象
 * 它会把你的数据存储在 IndexedDB 中，注意，IndexedDB 是异步的哦！
 * IndexedDB 可以保存诸如 File、Blob 等 JavaScript 对象
 * IndexedDB 的最大数据量基于设备的可用硬盘大小
 */
db.data.say = "hello world"; // 创建或更新..
const say = await db.data.say; // 读取，记得加 await..
delete db.data.say; // 删除..
db.has("say"); // 判断是否存在..

/**
 * cookie 对象
 * 它会把你的数据存储在 Cookie 中，Cookie 一般会自动随请求发送给服务端
 * 由于每次请求都会携带所有 Cookie，Cookie 中存储的数据应当尽量少
 */
cookie.data.say = "hello world"; // 创建或更新..
const say = cookie.data.say; // 读取..
delete cookie.data.say; // 删除..
"say" in cookie.data; // 判断是否存在..

/**
 * memory 对象
 * 它会把你的数据存储在 Memory 中，当页面刷新，数据就会被清空咯~
 */
memory.data.say = "hello world"; // 创建或更新..
const say = memory.data.say; // 读取..
delete memory.data.say; // 删除..
"say" in memory.data; // 判断是否存在..
```

前文中，我们好像就只在操作一个普通的 Javascript 对象。但是，在背后，数据已经被存储到各种地方啦。

在 `kurimudb-zero-config` 中，默认使用了 [RxJS](/cache/#rxjs) 作为订阅更新的驱动，只要你在变量名后加上 `$`，你就可以获得一个此值的 [BehaviorSubject 对象](https://rxjs.dev/guide/subject#behaviorsubject)。我们可以通过这种方式来订阅此变量，在它被改变时做点什么：

```js
import { local } from "kurimudb";

local.data.say = "hello world!";

// 订阅这个变量..
local.data.say$.subscribe((val) => {
  console.log("what you want to say: " + val);
});

local.data.say = "hello kurimudb!";

// echo "what you want to say: hello world!"
// echo "what you want to say: hello kurimudb!"
```

## 准备好了吗？

我们刚刚介绍了 Kurimudb 的核心用法——但这些对于大中型应用来说可能还不够，所以，请务必读完整个教程！

[文档地址](//kurimudb.nito.ink/intro/)
