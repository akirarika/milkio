# 数据库

## 数据库迁移

[IndexedDB](https://developer.mozilla.org/docs/Web/API/IndexedDB_API) 是 Web 端的数据库，它有 **版本 (version)** 的概念。Kurimudb 使用了 [Dexie.js](https://dexie.org/docs/API-Reference) 作为与 IndexedDB 间的 DAL 层，我们可以利用 [Dexie.js](https://dexie.org/docs/API-Reference) 来方便地控制版本。

::: tip 为什么 IndexedDB 需要版本？

用户可能在以前就使用了我们的应用，在他的浏览器中，已经按照当时的代码创建好了数据库。后续如果需要改动数据库，为了保证旧用户可以正常使用，我们就不能直接改动原先的数据库，而是应该为数据库增加一个版本，用户使用旧版本的数据库时，会自动通过迁移，升级到最新版本上。

:::

在前文中，我们创建了一个数据库连接，并且指定了一个版本：

```js
// /models/connection.js

import { connection } from "kurimudb";

export default new connection("default", (conn) => {
  // conn 是一个 Dexie 实例
  conn.version(1).stores({
    Config: "key",
  });
});
```

后续迭代中，我们可能会新增一些别的模型：

```js
// /models/connection.js

import { connection } from "kurimudb";

export default new connection("default", (conn) => {
  conn.version(2).stores({
    Note: "++id",
    Friend: "++id",
  });

  conn.version(1).stores({
    Config: "key",
  });
});
```

版本的顺序是不重要的，Dexie 会在迁移不同版本时，自动对版本进行排序。所以，你可以把新的版本写在上面，避免未来版本过多时，降低代码可读性。

## 查询构造器

在前文中，我们通过模型的主键来取出单个数据。有些场景下，我们需要根据一系列条件来筛选出一组数据，我们可以通过 [Dexie](https://dexie.org/docs/Table/Table) 以链式调用的语法，来编写查询条件：

```js
// 查询 id 小于 5 的便签
const data = await noteModel.getResults(
  noteModel
    .query()
    .where("id")
    .below(5)
);

console.log(data);
```

如果我们存储的数据是对象，且 `where` 函数查询的不是主键：

```js
userModel.data[42] = {
  name: "槙島聖護",
  height: 180,
  weight: 65,
};

const data = await userModel.getResults(
  userModel
    .query()
    .where("height") // 查询的 height 并不是主键，而是某个属性
    .below(160)
);
console.log(data);
```

我们则需要在数据库连接中，为此属性添加[索引](https://en.wikipedia.org/wiki/Database_index)。也就是说，`where` 函数可能使用的属性名，都需要添加索引。

```js
// /models/connection.js

import { connection } from "kurimudb";

export default new connection("default", (conn) => {
  conn.version(3).stores({
    User: "++id, height, weight", // 为 height 和 weight 添加索引
  });
});
```

我们更推荐将查询写在模型内部，以便实现代码的复用。

```js
// /models/noteModel.js
export default new (class Config extends model {
  // ...

  async getIdBelow5Results() {
    return await this.getResults(
      this.query()
        .where("id")
        .below(5)
    );
  }
})();

// 使用时
await noteModel.getIdBelow5Results();
```

我们建议您阅读 [Dexie.js](https://dexie.org/docs/WhereClause/WhereClause) 的文档，了解如何编写更复杂的查询。

```js
const data = await this.getResults(
  this.query()
    .where("age")
    .between(20, 25)
    .offset(150)
    .limit(25)
);
```

## 处理查询结果

我们刚刚使用了 `getResults` 函数，Dexie.js 返回的查询结果通常是 Promise 数组，`getResults` 可以将结果包装成通过主键取出的对象，并使诸如 [模型关联](/database/#查询构造器) 等 Kurimudb 的功能可用。

如果 Dexie.js 的查询结果只会有一个 (如 `first` 函数)，那么请用 `getResult` 函数：

```js
const data = await this.getResult(
  this.query()
    .where("age")
    .equals(1)
    .first()
);
```

如果想 `getResults` 包装出的结果是数组而不是对象，你可以向第二个参数传入 `Array`：

```js {7}
const data = await this.getResults(
  this.query()
    .where("age")
    .between(20, 25)
    .offset(150)
    .limit(25),
  Array
);
```

## 结果分页

待续 🐸

## 模型关联

待续 🐸

## 全文搜索

待续 🐸
