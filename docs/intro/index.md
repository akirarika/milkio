# 快速入门

首先，在你的项目中安装 `kurimudb`：

```shell
npm i kurimudb # or yarn add kurimudb
```

Krimudb 的核心就是模型，模型可以理解为存储数据的地方，类似 `Vuex/Redux` 等状态管理库的 `store` 目录。

```shell
mkdir ./models
```

## 创建对象模型

对象模型就是以键值对的方式存储数据的模型。例如，用户的配置通常是以键值对存储的。

```js
// 创建一个 /models/configModel.js 文件

import { model } from "kurimudb";

// 模型需继承 `model` 类，模型的类名不可重复，必须唯一，这里把类名取为 Config
// 为了保证数据源是唯一的，我们需要通过 `new` 操作符返回一个实例化好的对象
export default new class Config extends model {
  constructor() {
    // 构造函数第一个参数代表是否持久化数据，这里先写 false，下面的章节我们会讨论如何持久化数据
    // 第二个参数是一个数组，代表主键的名称与类型，主键是唯一不可重复的，类型支持 "string" 和 "number"
    super(false, ["key", "string"]);
  }
};
```

如此，模型便创建完成了。使用时则更加简单：

```js
// /main.js

import configModel from "models/configModel.js"
// 创建或更新
configModel.data.token = "!dr0wssaP"
// 读取
console.log(await configModel.data.token)
// 删除
delete configModel.data.token
// 判断是否存在
configModel.has('token')
```

## 持久化

Kurimudb 拥有持久化数据的能力，在页面刷新后数据也不会丢失。当把一个模型配置为可持久化时，数据将会被存储到 [Indexeddb](https://developer.mozilla.org/docs/Web/API/IndexedDB_API) 当中。同时，内存也会保留一份。当内存的值被更改时，会异步更新 Indexeddb 中的值。内存中只会保留当前读取的值，这意味着即使 Indexeddb 中缓存了过多的数据，也不会全部读出来导致内存溢出。

如果想将模型中的数据持久化在用户本地，我们需要一个数据库连接：

```js
// 创建一个 /models/connections/defaultConnection.js 文件

import { connection } from "kurimudb";

// new connection() 的第一个参数代表数据库名称
export default new connection("default", (conn) => {
  // 此代表 indexeddb 的数据库版本，当应用更新时，会升级到最新的版本，
  // 所以只要还有用户在使用旧版本数据库，就不要删除之前定义的版本代码
  conn.version(1).stores({
    // 代表 Config 模型中，主键为 "key" 字段
    Config: "key",
  });
  
  // conn.version(2).stores({
  //   // 除了第一个 "key" 字段是主键以外，后面的均为索引，索引是用来加快查询速度的，
  //   // 也只有被添加了索引的字段才可以被查询，查询可参考后面的章节
  //   Config: "key, name, xxx"
  // });
  // Kurimudb 使用 Dexie 来操作 Indexeddb，所以版本部分的高级用法可以参考 [Dexie 文档](https://dexie.org/docs/Dexie/Dexie.version())
});
```

接着修改我们的 `configModel.js`：

```js
// /models/configModel.js
import { model } from "kurimudb";
import defaultConnection from "@/models/connections/defaultConnection";

export default new class Config extends model {
  constructor() {
    // 将第一个参数从 false 改为你刚刚新建的数据库连接，本模型的数据就会持久化到此数据库中
    super(defaultConnection, ["key", "string"]);
  }
}
```

传入数据库连接后，即使页面刷新，你的数据也不会丢失了。

## 主键递增的集合

刚才，我们的 `Config` 模型是按键值对存储的：`configModel.data.username`

我们也可能需要存放一批主键递增的集合 (类似数组的使用方式)：`configModel.data[1];`

假设我们要做一个便签应用，在本地存储用户的便签。那么我们就可以将标签放置在一个主键会递增的集合中，每次存储便签，主键都会自增。

为了新增存储便签内容的 `Note` 模型，先修改数据库连接：

```js {9,10,11,12}
// /models/connections/defaultConnection.js
import { connection } from "kurimudb";

export default new connection("default", (conn) => {
  conn.version(1).stores({
    Config: "key",
  });
  
  conn.version(2).stores({
    Config: "key",
    Note: "++id", // "++id" 代表主键是自增的
  });
});
```

接着新建一个 `Note` 模型，文件名为 `/models/noteModel.js`

```js
// /models/noteModel.js
import { model } from "kurimudb";
import defaultConnection from "@/models/connections/defaultConnection";

export default new class Config extends model {
  constructor() {
    // 自增的主键叫做 id 比较好。既然是自增，也当然是 number 类型的啦
    super(defaultConnection, ["id", "number"]);
  }
};
```

使用时，可以通过 `new` 操作符来创建一条主键自增的数据：

```js
import noteModel from "@/models/noteModel";

const note1 = await new noteModel.data("This is the content of note 1");
const note2 = await new noteModel.data("This is the content of note 2");
console.log(await noteModel.data[1]); // echo "This is the content of note 1"
console.log(await noteModel.data[2]); // echo "This is the content of note 2"
```

## 数据库填充

我们可能会想设置一些默认值，比如用户首次使用的默认配置。那么可以在模型中新增一个 `seeding` 函数，用来填充默认值：

```js {10,11,12,13}
// /models/configModel.js
import { model } from "kurimudb";
import defaultConnection from "@/models/connections/defaultConnection";

export default new class Config extends model {
  constructor() {
    super(defaultConnection, ["key", "string"]);
  }

  async seeding(data) {
    data.username = "hello";
    data.password = "world";
  }
};
```

如果模型没有持久化，那么 `seeding` 函数会在每次模型初始化后立刻执行。

如果模型设置了持久化，那么 `seeding` 函数只会执行一次，用户下次访问时不会再重复执行。

这么设计是为了保证，数据库中，由 `seeding` 函数生成的数据只会存在一份。


## 注意事项

Kurimudb 本质存储的数据都是对象，而我们直接存储字符串或是其他类型其实只是"语法糖"。

```js
// 直接存储字符串，其实只是"语法糖"：
configModel.data.token = "!dr0wssaP"
// 本质上，它被转换成了下面的对象：
{
  key: "token",
  $__value: "!dr0wssaP"
}
// 在读取时，只会取出 "$__value" 的值：
console.log(await configModel.data) // "!dr0wssaP"

// 如果直接存储一个对象：
configModel.data.user = {
  name: "akirarika"
}
// 存储时，会直接存储它，并为它追加主键：
{
  key: "user",
  name: "akirarika"
}
// 取出时，主键不会被剔除，这意味着你可以直接从对象上拿出主键的值：
const user = await configModel.data.user
console.log(user.key) // "user"
```