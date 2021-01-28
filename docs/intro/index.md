# 入门

在前文中，我们介绍了 Kurimudb 的基础用法，并使用了 `local` 和 `session` 两个对象。

- **`local` 对象**，会将数据存储到 IndexedDB 里，用户刷新后数据还在。
- **`session` 对象**，会将数据存储到 Memory 里，页面关掉，数据就清空。

通常，对于简单的应用，使用它们已经完全足够啦。可是，如果开发一个复杂的大型应用的话，我们还需要模块化的能力，和更多的功能。

## 模型

Krimudb 的核心是**模型 (Model)**，就是 [MVVM](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel) 中的那个模型。模型可以简单地理解为**存储数据的地方**，之前我们使用的 `local` 和 `session` 对象，其实都是模型。

### 创建模型

模型其实就是一个 Javascript 对象，只不过继承了 Kurimudb 的 `model` 类。

```js
// 创建一个 /models/configModel.js 文件

import { model } from "kurimudb";

// 模型需继承 `model` 类，类名就是模型名，整个应用内，模型名必须是唯一的。
class Config extends model {
  constructor() {
    super(
      // 第一个参数是存储数据的位置，false 代表存储到 Memory 里。
      // 下面的章节，我们会讨论如何持久化数据。
      false,
      // 第二个参数是一个数组，代表主键的名称与类型。
      // 主键可以理解成一个普通对象的"属性"，只不过所有"属性"的类型必须一致。
      // 主键是需要唯一不可重复的，类型支持 "string" 和 "number"。
      ["key", "string"]
    );
  }
}

// 为了保证数据源是唯一的，我们需要通过 `new` 操作符返回一个实例化好的对象
export default new Config();
```

如此，你就拥有了一个 `Config` 模型。使用时则更加简单：

```js
// /main.js

import configModel from "./models/configModel.js";
// 创建或更新..
configModel.data.say = "hello world";
// 读取..
console.log(await configModel.data.say);
// 删除..
delete configModel.data.say;
// 判断是否存在..
configModel.has("say");
// 获取模型的所有数据..
await configModel.all();
```

## 模型方法

我们可以在模型类上面添加任何方法，这有助于我们实现**逻辑复用**。

这么做还会带来额外的好处：我们知道和这个模型有关的所有逻辑，全部都写在这个模型类里，其它地方都只是在调用这里。这能够增强我们应用的可预测性（就像 `Vuex/Redux` 的 `Action` 那样）。

```js
class Config extends model {
  constructor() {
    super(false, ["key", "string"]);
  }

  setFoo(bar, foo)) {
    // 各种逻辑..
    this.data.foo = foo;
    this.data.bar = bar;
  }

  async calcBar() {
    // ..
  }
}
```

在使用时，直接调用此类上的方法即可：

```js
import configModel from "./models/configModel.js";

configModel.setFoo();
await configModel.calcBar();
```

## 持久化

在上文中，我们创建了 `Config` 模型。但只把模型内部的数据存储到了 Memory 中，而很多场景下，我们是希望可以把数据存储在用户的设备上，刷新也不丢失的。

如果想将模型中的数据持久化在用户本地，我们需要一个 IndexedDB 数据库连接：

```js
// 创建一个 /models/connection.js 文件

import { connection } from "kurimudb";

export default new connection(
  // 代表数据库名称
  "default",
  (conn) => {
    // 创建一个 IndexedDB 数据库版本，版本号为 1
    conn.version(1).stores({
      Config: "key", // 代表数据库中创建一个 `Config` 表，主键为 `key`
    });
  }
);
```

接着修改我们的 `configModel.js`：

```js
// /models/configModel.js
import { model } from "kurimudb";
import myConnection from "@/models/connection";

class Config extends model {
  constructor() {
    // 将第一个参数从 false 改为你刚刚新建的数据库连接，本模型的数据就会持久化到此数据库中
    // 此数据库中，必须拥有与此模型同名的表哦！
    super(myConnection, ["key", "string"]);
  }
}

export default new Config();
```

传入数据库连接后，即使页面刷新，你的数据也不会丢失啦。

## 集合模型

在之前，我们的模型都是以键值对的方式存储的，就像对象那样：

```js
await configModel.data.foo;
```

我们也可能需要一个以集合的方式、添加数据时主键会自动递增的模型，就像数组那样：

```js
await noteModel.data[700];
```

集合模型常见的应用场景是各种列表，比如缓存的视频列表、用户的草稿箱列表……接下来，假设我们正在开发一个便签应用，需要在本地存储用户写的便签。

为了新增存储便签内容的 `Note` 模型，需要先修改数据库连接：

```js {11}
// /models/connection.js
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

接着新建一个 `Note` 模型：

```js
// /models/noteModel.js
import { model } from "kurimudb";
import myConnection from "@/models/connection";

export default new (class Config extends model {
  constructor() {
    // 自增的主键叫做 id 比较好。既然是自增，也当然是 number 类型的啦
    super(myConnection, ["id", "number"]);
  }
})();
```

使用时，可以通过 `new` 操作符来创建一条主键自增的数据：

```js
import noteModel from "@/models/noteModel";

const note1 = await new noteModel.data("This is the content of note 1");
const note2 = await new noteModel.data("This is the content of note 2");
console.log(await noteModel.data[1]); // echo "This is the content of note 1"
console.log(await noteModel.data[2]); // echo "This is the content of note 2"

// 获取模型的所有数据..
await configModel.all();
// 以返回普通数组的形式，获取模型所有的数据..
await configModel.all(Array);
```

大功告成啦。

::: tip 小贴士

1. IndexedDB 主键是从 `1` 开始自增的，因此，集合模型是主键也是从 `1` 开始递增的。这和数组是不同的。
2. 集合模型中，删除任意值，不会导致其他值的主键变动，这和数组的索引不同。也就是说，主键可以视为唯一且不变的。
3. 目前，集合模型必须配置数据库连接，无法只存储在 Memory 中。但后续更新计划中，有取消此限制的计划~
4. 集合模型的主键，类型必须为 `number` 才行哦！

:::

## 模型填充

有些场景下，我们可能想为一些模型设置默认值。例如，我们在做一个电子书应用，希望在用户首次使用时，为他指定一个默认的字体大小、主题、翻页模式……

那么可以在模型中新增一个 `seeding` 函数，用来填充默认值：

```js {10,11,12,13}
// /models/configModel.js
import { model } from "kurimudb";
import myConnection from "@/models/connections/connection";

export default new (class Config extends model {
  constructor() {
    super(myConnection, ["key", "string"]);
  }

  async seeding(data) {
    data.fontSize = "12px";
    data.theme = "defaultTheme";
    data.turnPageMode = "transverse";
  }
})();
```

如果模型中存在 `seeding` 函数，用户首次访问应用时，该函数会自动执行一次。

如果此模型没有把数据存储到 IndexedDB 中，即没有配置数据库连接，`seeding` 函数会在每次访问应用时都执行一次。

## 对象深层赋值

```js
configModel.data.test = { foo: "bar" };
configModel.data.test.foo = "baz";
```

当你向模型中存入一个对象或数组时，你很可能会凭直觉写出如上的代码来修改其属性值，但这样会导致错误出现。由于 [JavaScript](https://stackoverflow.com/a/6605700) 的限制，只有对 `configModel.data.test` 本身的更改，才会存储生效并触发订阅。如果你想更改存入对象的某些属性，你可以使用 `set` 方法：

```js
// set 方法接受两个参数，第一个是要修改的属性名，第二个是修改值的闭包函数
await configModel.set("test", (val) => (val["foo"] = "baz"));
// 在此闭包函数中，你可以任意修改此对象的值
await configModel.set("test", (val) => {
  val["foo"] = "baz";
  val["qux"] = "quux";
});
// 闭包函数也可以是异步的
await configModel.set("test", async (val) => {
  val["foo"] = "baz";
  await sleep(1000);
  val["qux"] = "quux";
});
```

数组同理~

### 我应该使用 set 方法吗？

这一点见仁见智。我们推荐的最佳实践是，应当修改存储的内容本身，而不是存入对象再修改它的子属性。同时，这样也能最大限度地利用 IndexedDB 的性能优势，和避免在读取大量数据时一次全部读到 Memory 里。如果你想存储多个相关的值，可以：

```js
// bad ✖
configModel.data.theme = {
  color: "blue",
  mode: "white",
  background: "foo.jpg",
};
// set..
configModel.set("theme", (val) => {
  val.color = "red";
});

// good ✔
configModel.data.themeColor = "blue";
configModel.data.themeMode = "white";
configModel.data.themeBackground = "foo.jpg";
// set..
configModel.data.themeColor = "red";

// good ✔
themeModel.data.color = "blue";
themeModel.data.mode = "white";
themeModel.data.background = "foo.jpg";
// set..
themeModel.data.color = "red";
```

如果你想要存储一组数据的集合，比起向对象模型中存入一个数组，我们更推荐直接使用[集合模型](#集合模型)：

```js
// bad ✖
configModel.data.drafts = [];
console.log((await draftModel.data.drafts)[0]);
// push..
configModel.set("drafts", (val) => {
  val.push({
    name: "foo",
    content: "bar",
  });
});

// good ✔
console.log(await draftModel.data[1]);
// push..
await new draftModel.data({
  name: "foo",
  content: "bar",
});
```

## 异步更新队列

待续 🐸

## “语法糖”

::: tip 小贴士
在 Kurimudb 中，存储的数据本质都是对象哦，如果我们直接存储字符串或是其他类型的话，虽然读取时还是原来的样子，但其实这只是"语法糖"！
:::

```js
import { local } from "kurimudb";

// 直接存储字符串，其实只是"语法糖"，
local.data.password = "123456";
// 本质上，它被转换成了下面的对象：
{
  key: "password",
  $__value: "123456"
}
// 在读取时，会直接取出 "$__value" 的值：
console.log(await local.data.password); // 会输出："123456"

// 如果直接存储一个对象：
local.data.user = {
  username: "akirarika",
  password: "123456"
}
// 存储时，会直接存储它，并为它追加主键：
{
  key: "user",
  username: "akirarika",
  password: "123456"
}
// 取出时，主键不会被剔除，这意味着你可以直接从对象上拿出主键的值：
const user = await local.data.user;
console.log(user.key); // "user"
console.log(user.username); // "akirarika"
```
