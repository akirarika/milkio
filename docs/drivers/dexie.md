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
npm i kurimudb-driver-dexie@3
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

```js {2,3,6,12}
import { Models } from "kurimudb";
import { DexieDriver } from "kurimudb-driver-dexie";
import migrations from "../models/migrations";

class IndexedDbState extends Models.keyValue {
  db: Dexie = migrations; // 将你声明好版本的 Dexie 实例引入在模型的 db 属性中

  constructor() {
    super({
      name: "indexedDbState",
      type: "string",
      driver: DexieDriver,
    });
  }
}

export default new IndexedDbState();
```

由于 IndexedDB 的 Api 是异步的，因此使用了 Dexie 驱动的模型，和读有关的 Api 将返回 `Promise` 对象。你可以在其前加上 `await` 关键字以等待其返回结果。

```js
indexedDbState.data.say = "hello world"; // 创建或更新..
const say = await indexedDbState.data.say; // 读取，由于 IndexedDB 是异步的，所以需要加 await..
delete indexedDbState.data.say; // 删除..
await indexedDbState.has("say"); // 判断是否存在..
```

## 查询构造器

允许从一组数据中高效率地查询，是 IndexedDB 的特色之一。我们可以通过 [Dexie](https://dexie.org/docs/Table/Table) 以链式调用的语法，来编写查询条件：

```js
// 查询 id 小于 5 的便签
const data = await noteList.storage.getResults(
  noteList.storage
    .query() // query 函数会返回一个此模型的 [Dexie Table 对象](https://dexie.org/docs/Table/Table)
    .where("id")
    .below(5)
    .toArray()
);

console.log(data);
```

## 包装查询结果

`noteList.storage.getResults()` 函数会对 Dexie 查询出的结果 (`Promise<Array<any>>`) 进行包装，**同时数据也会被缓存到缓存层**。默认包装成对象，对象的键为值的主键。如果你需要数组，则可以向第二个参数传入一个空数组 `[]`：

```js {7}
const data = await noteList.storage.getResults(
  noteList.storage.query().where("id").below(5).toArray(),
  []
);
```

你也可以传入非空的数组或对象，查询出的结果会在原来的数据末尾追加：

```js {7,16,17,18}
await noteList.storage.getResults(
  noteList.storage.query().where("id").below(5).toArray(),
  ["hello", "world"]
);

await noteList.storage.getResults(
  noteList.storage.query().where("id").below(5).toArray(),
  { hello: "world" }
);
```

或者调用 `getArrayResults()` 和 `getObjectResults()` 也行：

```js
await noteList.storage.getObjectResults(noteList.storage.toArray());
await noteList.storage.getArrayResults(noteList.storage.toArray());
```

## 包装单个结果

如果 Dexie.js 的查询结果只会有一个 (如 `first` 函数)，那么请用 `getResult` 函数：

```js
await userList.storage.getResult(
  userList.storage.query().where("name").equals("akirarika").first()
);
```

## 深入了解 Dexie.js

Dexie.js 的功能非常丰富，强烈推荐阅读 [Dexie 文档](https://dexie.org/docs/API-Reference) 和 [Dexie 最佳实践](https://dexie.org/docs/Tutorial/Best-Practices#1-understand-promises)！
