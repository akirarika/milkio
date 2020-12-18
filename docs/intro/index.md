# 快速入门

首先，在你的项目中安装 `kurimudb`

```shell {1}
npm i kurimudb
```

Krimudb 的核心就是模型，模型可以理解为存储数据的地方，类似 `Vuex/Redux` 等状态管理库的 `store` 目录。

模型使用起来就像是个普通的类，但它有很多不同之处：

1. 增加或修改模型属性的值，这些值会被持久化到 `indexeddb` 中，网页刷新数据也依旧存在。

2. 在模型的属性名后添加 `$`，则可订阅此属性的更新。

3. 模型既可以当保存键值对的对象使用，也可以当数组使用 (添加新数据，主键会自增)。

```shell {1}
mkdir ./models
```

## 创建模型

假设我们需要存储用户的配置的 `config` 模型，

需在 `models` 文件夹内创建一个 `configModel.js` 的文件：

```js {9}
// /models/configModel.js
import { model } from "kurimudb";

// 模型需继承 `model` 类，且类名不可重复，需要是唯一的，这里把类名取为 Config
export default new (class Config extends model {
  constructor() {
    // 构造函数第一个参数代表是否持久化数据 (即使刷新网页数据还在)，这里我们先写 false
    // 第二个参数是一个数组，代表主键的名称与类型
    super(false, ["key", "string"]);
  }
})();
```

如此，模型便创建完成了。使用时更加简单，仅需：

```js {5,7,9}
// /main.js
import configModel from "@/models/configModel";

// 创建或更新
configModel.data.username = "hello world";
// 读取
console.log(await configModel.data.username); // echo "hello world"
// 删除
delete configModel.data.username;
```

## 持久化

当前，`Config` 模型的数据在页面刷新后依然会丢失。

如果想将模型中的数据持久化在用户本地，我们需要一个数据库连接。

新建一个 `/models/defaultConnection.js` 文件：

```js {8}
// /models/defaultConnection.js
import { connection } from "kurimudb";

// new connection() 的第一个参数代表数据库名称
export default new connection("default", (conn) => {
  conn.version(1).stores({
    // 代表 Config 模型中，主键索引为 "key" 字段
    Config: "key",
  });
});
```

接着在 `configModel.js` 中使用它即可：

```js {3,8}
// /models/configModel.js
import { model } from "kurimudb";
import defaultConnection from "@/models/defaultConnection";

export default new (class Config extends model {
  constructor() {
    // 将第一个参数从 false 改为你刚刚新建的数据库连接，本模型的数据就会持久化到此数据库中
    super(defaultConnection, ["key", "string"]);
  }
})();
```

传入数据库连接后，即使页面刷新，你的数据也不会丢失了。

## 主键递增的集合

刚才，我们的 `Config` 模型是按键值对存储的：`configModel.data.username;`

我们也可能需要存放一批主键递增的集合 (类似数组的使用方式)：`configModel.data[1];`

举个使用场景的例子，假设我们要做一个便签应用，在本地存储用户的便签，我们不知道用户到底会添加多少个便签，那么我们就可以将标签放置在一个主键会递增的集合中。

新增一个存储便签内容的 `Note` 模型，先修改数据库连接：

```js {7}
// /models/defaultConnection.js
import { connection } from "kurimudb";

export default new connection("default", (conn) => {
  conn.version(1).stores({
    Config: "key",
    Note: "++id", // "++id" 代表主键是自增的
  });
});
```

接着新建一个 `Note` 模型，文件名为 `/models/noteModel.js`

```js {8}
// /models/noteModel.js
import { model } from "kurimudb";
import defaultConnection from "@/models/defaultConnection";

export default new (class Config extends model {
  constructor() {
    // 自增的主键是 id，也当然是 number 类型的啦
    super(defaultConnection, ["id", "number"]);
  }
})();
```

修改完成后，先清空浏览器的 indexeddb，使我们新增的 `Note` 生效 (后续会介绍无需这样操作的版本更新方式)。

1. 按 `F12` 打开 `DevTools`
2. 找到 `Application` 选项卡，点击 `Clear storage`
3. 点击饼状图下的 `Clear site data` 后刷新页面

接着，程序应该不会报错了，尝试使用主键递增的 `Note` 模型吧。

```js
import noteModel from "@/models/noteModel";

await new noteModel.data("This is the content of note 1");
await new noteModel.data("This is the content of note 2");
console.log(await noteModel.data[1]); // echo "This is the content of note 1"
console.log(await noteModel.data[2]); // echo "This is the content of note 2"
```

## 数据库填充

你可能想为数据库填充一些默认字段，那么可以在模型中新增一个 `seeding` 函数：

```js {10,11,12,13}
// /models/configModel.js
import { model } from "kurimudb";
import defaultConnection from "@/models/defaultConnection";

export default new (class Config extends model {
  constructor() {
    super(defaultConnection, ["key", "string"]);
  }

  async seeding(data) {
    data.username = "hello";
    data.password = "world";
  }
})();
```

如果模型没有持久化，那么 seeding 函数会在每次模型初始化后立刻执行。

但是，如果模型设置了持久化，那么 seeding 函数只会执行一次，用户下次访问时不会再重复执行。

这么设计是为了保证，数据库中，由 seeding 函数生成的数据只会存在一份。
