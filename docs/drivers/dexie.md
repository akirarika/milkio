# Dexie

:::tip 注意事项

[Dexie.js](https://dexie.org/) 是一个优雅的、链式语法的 IndexedDB 的包装器，Github 上搜索 IndexedDB，它在结果中排名第一。

IndexedDB 是 Web 数据库，它的容量和[用户硬盘大小有关](https://web.dev/storage-for-the-web/#how-much)，可以直接存储部分 JavaScript 对象。注意，和 LocalStorage 不同的是， **IndexedDB 是异步的。**

:::

## 安装

```bash
# 安装 Dexie 本体
npm i dexie@3
# 安装 Kurimudb 的 Dexie 驱动
npm i kurimudb-driver-dexie@4
```

## 版本控制

Dexie 驱动在使用前，需要先声明数据库的版本，推荐阅读 [Dexie 官方文档](https://dexie.org/docs/Tutorial/Design#database-versioning)，下方是一个例子：

```js
// 创建一个 /models/migrations/index.js 文件

import Dexie from "dexie";

const db = new Dexie("kurimudb");
db.version(2).stores({
  // 一个表对应一个模型，需和模型名一致。模型的主键名称默认为 _id，所以表也需要将主键设置为 _id
  indexedDbState: "_id",
  // ++id 代表主键是自增的
  indexedDbList: "++_id",
});
db.version(1).stores({
  _seed: "_id", // 为了使 kurimudb 的填充功能正常工作，必须创建此表
});

export db;
```

_版本的顺序是不重要的，Dexie.js 会在迁移不同版本时，自动对版本进行排序。所以，你可以把新的版本写在上面，避免未来版本过多时，降低代码可读性。_

## 示例

```js {2,3,8,9}
import { Models } from "kurimudb";
import { DexieDriver } from "kurimudb-driver-dexie";
import migrations from "../models/migrations";

export default new class IndexedDbState extends Models.keyValue {
  constructor() {
    super({
      db: migrations;// 将你声明好版本的 Dexie 实例，传入到 db 选项中，模型将使用它
      driver: DexieDriver,
    });
  }
}
```

由于 IndexedDB 的 Api 是异步的，因此使用了 Dexie 驱动的模型，和读有关的 Api 将返回 `Promise` 对象。你可以在其前加上 `await` 关键字以等待其返回结果。

```js
indexedDbState.data.say = "hello world"; // 创建或更新..
const say = await indexedDbState.data.say; // 读取，由于 IndexedDB 是异步的，所以需要加 await..
delete indexedDbState.data.say; // 删除..
if (await indexedDbState.data.say) { ... } // 判断是否存在..
```

## 查询构造器

可以从一组数据中高效率地筛选，是 IndexedDB 的特色之一。我们可以通过 [Dexie](https://dexie.org/docs/Table/Table)，以链式调用的语法，来编写查询条件：

```js
await noteList.storage.query().where("id").below(5).toArray();
```

使用 `query` 函数，可以获得当前模型所在表的 [Dexie Table](https://dexie.org/docs/Table/Table) 对象。使用它，你可以通过链式调用的语法来查询一个或多个数据。

::: warning 注意事项

尽管通过 `query` 函数，我们能够以操作 Dexie 的方式完成很多事情，但请只在需要按条件查询的场景使用它。增、删、改请使用 Kurimudb 来完成。

:::

## 结果封装

为了更好的利用 Indexeddb 的性能，当你存入非对象的值时，我们会将其包装成一个对象：

```js
// 存入一个非对象的值：
configState.data.hello = "world";
// 实际存入到 Indexedb 的值是：
{
  _id: "hello",
  $__value: "world",
}
```

当你使用 Dexie.js 进行查询时，需注意按照实际存入的数据格式来进行查询。


## 深入了解 Dexie.js

Dexie.js 的功能非常丰富，强烈推荐阅读 [Dexie Api 文档](https://dexie.org/docs/API-Reference) 和 [Dexie 最佳实践](https://dexie.org/docs/Tutorial/Best-Practices#1-understand-promises)！
