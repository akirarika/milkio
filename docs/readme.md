# 介绍

[![](https://img.shields.io/badge/github-kurimudb-white.svg)](https://github.com/akirarika/kurimudb) ![](https://img.shields.io/github/forks/akirarika/kurimudb) ![](https://img.shields.io/github/stars/akirarika/kurimudb) ![](https://img.shields.io/badge/language-javascript-orange.svg) ![](https://img.shields.io/github/license/akirarika/kurimudb)

## Kurimudb 是什么

<img src="./ill.jpg" style="margin-top:-32px;width:240px;float:right;"></img>

Kurimudb 是一款渐进式的 **Web 数据仓库**，可以帮你将你应用的数据，存储在 Memory 或 IndexedDB 里，和成为你应用真正的单一数据源。

我们在保持语法简单的同时，还提供了[模块化](/intro/#模型)、[订阅数据更新](/monitor/)和[状态管理 (如代替 Vuex)](/state/) 的能力。

### 特性

- **语法足够简单 ✔️**
  - Kurimudb 努力保持语法简单，进行增删改查就像操作普通的 Javascript 对象。
- **读取按需加载 ✔️**
  - Kurimudb 筛选时仅会按需读取数据，即使缓存了巨量的数据，也不用担心。
- **数据可持久化 ✔️**
  - Kurimudb 能将数据存储到 IndexedDB 中，即使用户刷新，数据也不会丢失。

## 安装

```sh
npm i kurimudb # or yarn add kurimudb
```

## 快速体验

想快速体验的话，可以直接使用 Kurimudb 内置的 `local` 和 `session` 对象。下面是一个增删改查的例子：

```js
import { local, session } from "kurimudb";
// local 和 session 的用法是一致的喔~
// 区别是，local 的数据会被存储到 IndexedDB 里，刷新后还在，
// 而 session 则不会，关掉页面，里面的数据就没有了 (๑´ㅂ`๑)

// 创建或更新..
local.data.say = "hello world";

// 读取..
await local.data.say;

// 删除..
delete local.data.say;

// 判断是否存在..
"say" in local.data; // or local.has("say");

// 获取所有数据..
await local.all();
```

如你所见，Kurimudb 的语法很简单，就像操作一个普通的 Javascript 对象一样。但是，在背后，你的数据已经被存储到了 IndexedDB 里啦。

Kurimudb 还整合了 [RxJS](https://rxjs.dev/)，只要你在变量名后加上 `$`，你就可以获得一个此值的 [BehaviorSubject 对象](https://rxjs.dev/guide/subject#behaviorsubject)。我们可以通过这种方式来订阅此变量，在它被改变时做点什么：

```js {4}
import { local } from "kurimudb";

// 订阅这个变量.. (based on RxJS)
local.data.say$.subscribe((val) => {
  console.log("what you want to say: " + val);
});
```

## 准备好了吗？

我们刚刚介绍了 Kurimudb 的核心用法——但这些对于复杂的应用来说可能还不够，所以，请务必读完整个教程！
