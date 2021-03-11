# 入门

在前文中，我们介绍了 Kurimudb 的基础用法，并使用了 `kurimudb-zero-config` 这个零配置包。

通常，对于一些轻量级应用，使用 Kurimudb 的零配置包就已经完全符合需求啦。可是，如果我们正在开发一个复杂的大型应用的话，数据都乱糟糟地塞在一个对象里，可不是什么好办法。而且，我们也需要更高的灵活度。

## 安装

继续之前，我们先安装 Kurimudb 本体吧：

```sh
npm i kurimudb@2
# or yarn add kurimudb@2
```

在下文中，我们将使用 `Rxjs` 作为缓存层，并利用 `Rxjs` 来实现订阅更新，所以，安装 `Rxjs` 也是必须的：

```sh
npm i rxjs@6
# or yarn add rxjs@6
```

_注：Kurimudb 的 `Rxjs` 驱动目前支持 6.x 和 7.x 版本的 `Rxjs`_。

## 模型

Krimudb 的核心是**模型 (Model)**，就是 [MVVM](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel) 中的那个模型。模型可以简单地理解为**存储数据的地方**，之前我们使用的 `memory`、`local` 和 `db` 对象，其实都是模型。

### 创建模型

创建一个模型其实很简单，只需要实例化 Kurimudb 的模型类即可 (如果你是 TypeScript 用户，[请看这里](/typescript/))：

```js
// 创建一个 /models/configModel.js 文件

import { BehaviorSubject } from "rxjs";
import { Model, RxjsDriver } from "kurimudb";

export default new Model({
  // 此模型的配置
  config: {
    // 模型的名称，必须是唯一的
    name: "config",
    // 主键类型，即 configModel.data['xxx'] 中 'xxx' 的类型，可选 'string' 或 'number'
    type: "string",
    drivers: {
      // 所使用的数据缓存层驱动，我们这里使用内置的 Rxjs 驱动
      cache: RxjsDriver,
      // 向驱动注入的依赖，这里我们传入 Rxjs 的 BehaviorSubject 对象即可。关于这方面的详细信息，请阅读 "缓存" 章节
      cacheInject: BehaviorSubject,
    },
  },
});
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
```

## 模型方法

我们可以在模型类上面添加任何方法，这有助于我们实现**逻辑复用**。

这么做还会带来额外的好处：我们知道和这个模型有关的所有逻辑，全部都写在这个模型类里，其它地方都只是在调用这里。这能够增强我们应用的可预测性（就像 `Vuex/Redux` 的 `Action` 那样）。

```js
// /models/configModel.js

export default new Model({
  config: {
    // ...
  },

  setFoo(bar, foo)) {
    // 各种逻辑..
    this.data.foo = foo;
    this.data.bar = bar;
  },

  // 模型的方法支持异步的
  async calcBar() {
    // ..
  },
});
```

在使用时，直接调用此类上的方法即可：

```js
import configModel from "./models/configModel.js";

configModel.setFoo();
await configModel.calcBar();
```

## 集合模型

在之前，我们的模型都是以键值对的方式存储的，就像对象那样：

```js
await configModel.data.foo;
```

我们也有时可能需要一个以集合的方式、添加数据时主键会自动递增的模型，就像数组那样：

```js
await noteModel.data[700];
```

集合模型常见的应用场景是各种列表，比如缓存的视频列表、用户的草稿箱列表……接下来，假设我们正在开发一个便签应用，需要在本地存储用户写的便签。

为了新增存储便签内容的 `Note` 模型：

接着新建一个 `Note` 模型：

```js
// 创建一个 /models/noteModel.js 文件

import { BehaviorSubject } from "rxjs";
import { Model, RxjsDriver } from "kurimudb";

export default new Model({
  config: {
    name: "note",
    // 由于主键是会自增的数字，所以类型需要设置为 number
    type: "number",
    drivers: {
      // ..
    },
  },
});
```

使用时，通过 `new` 操作符来创建的数据，主键会自增：

```js
import noteModel from "@/models/noteModel";

const note1 = await new noteModel.data("This is the content of note 1");
const note2 = await new noteModel.data("This is the content of note 2");
console.log(await noteModel.data[1]); // echo "This is the content of note 1"
console.log(await noteModel.data[2]); // echo "This is the content of note 2"

// 获取模型的所有数据..
await configModel.all();
```

大功告成啦。

::: tip 小贴士

1. 集合模型的主键是从 `1` 开始递增的，这和数组不同，目的是为了更好的兼容 IndexedDB，因为 IndexedDB 是从 `1` 开始的。
2. 集合模型中，删除任意值，不会导致其他值的主键变动，这和数组的索引不同。也就是说，主键可以视为唯一且不变的。
3. 集合模型的主键，类型必须为 `number` 才行哦！

:::

## 模型填充

有些场景下，我们可能想为一些模型填充初始值。例如，我们在做一个电子书应用，希望在用户首次使用时，为他指定一个默认的字体大小、主题、翻页模式……

那么可以在模型中新增一个 `seeding` 函数，用来填充初始值：

```js {8,9,10,11,12}
// /models/configModel.js

export default new Model({
  config: {
    // ...
  },

  seeding(model) {
    model.data.fontSize = "12px";
    model.data.theme = "defaultTheme";
    model.data.turnPageMode = "transverse";
  },
});
```

如果模型中存在 `seeding` 函数，用户每次访问此页面，模型都会执行一次。

如果模型配置了[持久化驱动](/persistence/)，那么用户只有在首次访问此页面时，该函数才会自动执行一次。

## 对象深层赋值

```js
configModel.data.test = { foo: "bar" };
configModel.data.test$.subscribe(...);
configModel.data.test.foo = "baz";
```

当你向模型中存入一个对象或数组时，你很可能会凭直觉写出如上的代码来修改其属性值，但这样并不会触发模型订阅。由于 [JavaScript](https://stackoverflow.com/a/6605700) 的限制，只有对 `configModel.data.test` 本身的更改，才会触发订阅。如果你想更改存入对象的某些属性，你可以使用 `set` 方法：

```js
// set 方法接受两个参数，第一个是要修改的属性名，第二个是修改值的闭包函数
configModel.set("test", (val) => (val["foo"] = "baz"));
// 在此闭包函数中，你可以任意修改此对象的值
configModel.set("test", (val) => {
  val["foo"] = "baz";
  val["qux"] = "quux";
});
// 闭包函数也可以是异步的
configModel.set("test", async (val) => {
  val["foo"] = "baz";
  await sleep(1000);
  val["qux"] = "quux";
});
```

数组同理~

### 我应该避免使用 set 方法吗？

这一点见仁见智。我们推荐的最佳实践是，应当修改存储的内容本身，而不是存入对象再修改它的子属性。同时，如果你在使用 IndexedDB，这样也能最大限度地利用 IndexedDB 的性能优势，和避免在读取大量数据时一次全部读到 Memory 里。如果你想存储多个相关的值，可以：

```js
/**
 * bad ✖ 将相关数据存入一个对象
 */
configModel.data.theme = {
  color: "blue",
  mode: "white",
  background: "foo.jpg",
};
// set..
configModel.set("theme", (val) => {
  val.color = "red";
});

/**
 * good ✔ 利用变量名来区分归类
 */
configModel.data.themeColor = "blue";
configModel.data.themeMode = "white";
configModel.data.themeBackground = "foo.jpg";
// set..
configModel.data.themeColor = "red";

/**
 * good ✔ 建立一个模型，存储此类数据
 */
themeModel.data.color = "blue";
themeModel.data.mode = "white";
themeModel.data.background = "foo.jpg";
// set..
themeModel.data.color = "red";
```

如果你想要存储一组数据的集合，比起向对象模型中存入一个数组，我们更推荐直接使用[集合模型](#集合模型)：

```js
/**
 * bad ✖ 将数组存入对象模型的一个属性中
 */
configModel.data.drafts = [];
const drafts = await draftModel.data.drafts;
console.log(drafts[0]);
// push..
configModel.set("drafts", (val) => {
  val.push({
    name: "foo",
    content: "bar",
  });
});

/**
 * good ✔ 建立一个集合模型，存储此类数据
 */
console.log(await draftModel.data[1]);
// push..
await new draftModel.data({
  name: "foo",
  content: "bar",
});
```
