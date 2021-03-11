# 持久化驱动

在[入门章节](/intro/)中，我们并没有指定持久化层的驱动，所以页面一旦刷新，数据就全部丢掉了。如果我们想此模型的数据在页面刷新后依旧存在，可以指定持久化层的驱动。

## LocalStorage

[LocalStorage](https://developer.mozilla.org/docs/Web/API/Window/localStorage) 一般可以存储约 5MB 左右的数据。

```js {13,14}
// /models/configModel.js

import { BehaviorSubject } from "rxjs";
import { Model, RxjsDriver, LocalStorageDriver } from "kurimudb";

export default new Model({
  config: {
    name: "config",
    type: "string",
    drivers: {
      cache: RxjsDriver,
      cacheInject: BehaviorSubject,
      // 指定持久化驱动使用 LocalStorageDriver 即可，本驱动无需依赖注入
      persistence: LocalStorageDriver,
    },
  },
});
```

使用的话，跟前文一致，不需要改动代码：

```js
configModel.data.say = "hello world"; // 创建或更新..
const say = configModel.data.say; // 读取..
delete configModel.data.say; // 删除..
"say" in configModel.data; // 判断是否存在..
```

:::warning 注意事项

LocalStorage 所存储的内容，本质都是存为字符串。Kurimudb 会对存入的数据进行 `JSON.stringify`，所以，请勿存入无法被正确 `JSON.stringify` 的对象 (如 `Set`、`Map` 等)。

:::

## Dexie.js (IndexedDB)

IndexedDB 的容量和[用户硬盘大小有关](https://web.dev/storage-for-the-web/#how-much)，可以直接存储 JavaScript 对象。注意，和 LocalStorage 不同的是， **IndexedDB 是异步的。** [Dexie.js](https://dexie.org/) 则是功能非常强大的 IndexedDB 的包装器，Github 上搜索 IndexedDB，它在结果中排名第一。

### 版本

在使用 Dexie 前，需要先声明数据库的版本，推荐阅读 [Dexie 官方文档](https://dexie.org/docs/Tutorial/Design#database-versioning)，下方是一个例子：

```js
// 创建一个 /models/migrations/index.js 文件

import Dexie from "dexie";

const db = new Dexie("kurimudb");

db.version(2).stores({
  // 一个表对应一个模型，需和模型名一致。模型的主键名称默认为 id，所以表也需要将主键设置为 id
  config: "id",
  // ++id 代表主键是自增的
  note: "++id",
});

db.version(1).stores({
  _seed: "id", // 为了使 kurimudb 的填充功能正常工作，必须创建此表
});

export default db;
```

_版本的顺序是不重要的，Dexie.js 会在迁移不同版本时，自动对版本进行排序。所以，你可以把新的版本写在上面，避免未来版本过多时，降低代码可读性。_

然后把它放在模型中依赖注入即可：

```js {13,14}
// /models/noteModel.js

import { BehaviorSubject } from "rxjs";
import { Model, RxjsDriver, DexieDriver } from "kurimudb";
import migrations from "./migrations/index";

export default new Model({
  config: {
    name: "note",
    type: "number",
    drivers: {
      cache: RxjsDriver,
      cacheInject: BehaviorSubject,
      // 指定持久化驱动使用 DexieDriver
      persistence: DexieDriver,
      // 向持久化层依赖注入你上面创建的 /models/migrations/index.js 文件，
      // 即传入一个已创建好版本的 Dexie 实例即可
      persistenceInject: migrations,
    },
  },
});
```

然后就可以使用模型啦，模型的数据会被持久化到 IndexedDB 中。

```js
configModel.data.say = "hello world"; // 创建或更新..
const say = await configModel.data.say; // 读取，由于 IndexedDB 是异步的，所以需要加 await..
delete configModel.data.say; // 删除..
configModel.has("say"); // 判断是否存在..
```

### 查询构造器

有些场景下，我们需要根据一系列条件来筛选出一组数据，我们可以通过 [Dexie](https://dexie.org/docs/Table/Table) 以链式调用的语法，来编写查询条件：

```js
// 查询 id 小于 5 的便签
const data = await noteModel.getResults(
  noteModel
    .query()
    // query 函数会返回一个此模型的 [Dexie Table 对象](https://dexie.org/docs/Table/Table)
    .where("id")
    .below(5)
    .toArray()
);

console.log(data);
```

`noteModel.getResults()` 函数会对 Dexie 查询出的结果 (`Promise<Array<any>>`) 进行包装，**同时数据也会被缓存到缓存层**。默认包装成对象，对象的键为值的主键。如果你需要数组，则可以向第二个参数传入一个空数组 `[]`：

```js {7}
const data = await noteModel.getResults(
  noteModel
    .query()
    .where("id")
    .below(5)
    .toArray(),
  []
);
```

你也可以传入非空的数组或对象，查询出的结果会在原来的数据末尾追加：

```js {7,16,17,18}
await noteModel.getResults(
  noteModel
    .query()
    .where("id")
    .below(5)
    .toArray(),
  ["hello", "world"]
);

await noteModel.getResults(
  noteModel
    .query()
    .where("id")
    .below(5)
    .toArray(),
  {
    hello: "world",
  }
);
```

或者调用 `getArrayResults()` 和 `getObjectResults()` 也行：

```js
await noteModel.getObjectResults(noteModel.toArray());
await noteModel.getArrayResults(noteModel.toArray());
```

如果 Dexie.js 的查询结果只会有一个 (如 `first` 函数)，那么请用 `getResult` 函数：

```js
await userModel.getResult(
  userModel
    .query()
    .where("name")
    .equals("akirarika")
    .first()
);
```

我们更推荐将查询写在模型内部，以便实现代码的复用。

```js {8,9,10,11,12,13,14}
// /models/noteModel.js

export default new Model({
  config: {
    // ...
  },

  async getIdBelow5Results() {
    return await this.getResults(
      this.query()
        .where("id")
        .below(5)
    );
  },
});

// 使用时..
await noteModel.getIdBelow5Results();
```

:::tip 深入了解 Dexie

Dexie 拥有强大又简洁明确的查询 Api，强烈推荐阅读 [Dexie 文档](https://dexie.org/docs/API-Reference) 和 [Dexie 最佳实践](https://dexie.org/docs/Tutorial/Best-Practices#1-understand-promises)！

:::

## Cookie

待续 🐸
