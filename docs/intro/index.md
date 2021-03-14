---
sidebarDepth: 2
---

# 入门

在前文中，我们介绍了 Kurimudb 的基础用法，并使用了 `kurimudb-zero-config` 这个零配置包。

通常，对于一些轻量级应用，使用 Kurimudb 的零配置包就已经完全符合需求啦。可是，如果我们正在开发一个复杂的大型应用的话，数据都乱糟糟地塞在一个对象里，可不是什么好办法。而且，我们也需要更高的灵活性。

## 安装

继续之前，我们先安装 Kurimudb 本体吧：

```sh
npm i kurimudb@2
# or yarn add kurimudb@2
```

在下面的教程中，我们将利用 `Rxjs` 来实现订阅更新（即使用 `Rxjs` 驱动作为缓存层），所以，安装 `Rxjs` 也是必须的：

```sh
npm i rxjs@6
# or yarn add rxjs@6
```

_注：Kurimudb 的 `Rxjs` 驱动目前支持 6.x 和 7.x 版本的 `Rxjs`_。

## 模型

Krimudb 的核心是**模型 (Model)**，就是 [MVVM](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel) 中的那个模型。模型可以简单地理解为**存储数据的地方**，之前我们使用零配置包中的 `memory`、`local`、`cookie` 和 `db` 对象，其实都是模型。

### 创建模型

创建一个模型其实很简单，只需要实例化 Kurimudb 的模型类即可 (如果你是 TypeScript 用户，[请看这里](/typescript/))：

```js
// 创建一个 /models/configState.js 文件

import { BehaviorSubject } from "rxjs";
import { Model, RxjsDriver } from "kurimudb";

export default new Model({
  // 此模型的配置
  config: {
    // 模型的名称，必须是唯一的
    name: "configState",
    // 主键类型，即 configState.data['xxx'] 中 'xxx' 的类型，可选 'string' 或 'number'
    type: "string",
    drivers: {
      // 所使用的数据缓存层驱动，我们这里使用内置的 Rxjs 驱动
      cache: RxjsDriver,
      // 向驱动注入的依赖，这里我们传入 Rxjs 的 BehaviorSubject 对象即可。关于这方面的详细信息，后面章节会详细讲解。
      cacheInject: BehaviorSubject,
    },
  },
});
```

如此，你就拥有了一个 `Config` 模型。使用时则更加简单：

```js
import configState from "./models/configState.js";
// 创建或更新..
configState.data.say = "hello world";
// 读取..
console.log(configState.data.say);
// 删除..
delete configState.data.say;
// 判断是否存在..
"say" in configState;
```

## 模型方法

我们可以在模型类上面添加任何方法，这有助于我们实现**逻辑复用**。

这么做还会带来额外的好处：我们知道和这个模型有关的所有逻辑，全部都写在这个模型类里，其它地方都只是在调用这里。这能够增强我们应用的可预测性（就像 `Vuex/Redux` 的 `Action` 那样）。

```js
// /models/configState.js

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
import configState from "./models/configState.js";

configState.setFoo();
await configState.calcBar();
```

## 集合模型

在之前，我们的模型都是以键值对的方式存储的，就像对象那样：

```js
configState.data.foo;
```

我们也有时可能需要一个以集合的方式、添加数据时主键会自动递增的模型，有些类似数组：

```js
configState.data[700];
```

集合模型常见的应用场景是各种列表，比如缓存的视频列表、用户的草稿箱列表……接下来，假设我们正在开发一个便签应用，需要在本地存储用户写的便签。

为了新增存储便签内容的 `Note` 模型：

接着新建一个 `Note` 模型：

```js
// 创建一个 /models/noteList.js 文件

import { BehaviorSubject } from "rxjs";
import { Model, RxjsDriver } from "kurimudb";

export default new Model({
  config: {
    name: "noteList",
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
import noteList from "@/models/noteList";

const note1 = new noteList.data("This is the content of note 1");
const note2 = new noteList.data("This is the content of note 2");
console.log(noteList.data[1]); // echo "This is the content of note 1"
console.log(noteList.data[2]); // echo "This is the content of note 2"

// 获取模型的所有数据..
noteList.all();
```

大功告成啦。

::: tip 小贴士

1. 集合模型的主键是从 `1` 开始递增的，这和数组不同。这么设计是为了更好的兼容 IndexedDB，因为 IndexedDB 是从 `1` 开始的。
2. 集合模型中，删除任意值，不会导致其他值的主键变动，这和数组的索引不同。也就是说，主键可以视为唯一且不变的。
3. 集合模型的主键，类型必须为 `number` 才行哦！

:::

## 模型填充

有些场景下，我们可能想为一些模型填充初始值。例如，我们在做一个电子书应用，希望在用户首次使用时，为他指定一个默认的字体大小、主题、翻页模式……

那么可以在模型中新增一个 `seeding` 函数，用来填充初始值：

```js {8,9,10,11,12}
// /models/configState.js

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
configState.data.test = { foo: "bar" };
configState.data.test$.subscribe(...);
configState.data.test.foo = "baz";
```

当你向模型中存入一个对象或数组时，你很可能会凭直觉写出如上的代码来修改其属性值，但这样并不会触发模型订阅。由于 [JavaScript](https://stackoverflow.com/a/6605700) 的限制，只有对 `configState.data.test` 本身的更改，才会触发订阅。如果你想更改存入对象的某些属性，你可以使用 `set` 方法：

```js
// set 方法接受两个参数，第一个是要修改的属性名，第二个是修改值的闭包函数
configState.set("test", (val) => (val["foo"] = "baz"));
// 在此闭包函数中，你可以任意修改此对象的值
configState.set("test", (val) => {
  val["foo"] = "baz";
  val["qux"] = "quux";
});
// 闭包函数也可以是异步的
configState.set("test", async (val) => {
  val["foo"] = "baz";
  await sleep(1000);
  val["qux"] = "quux";
});
```

数组同理~

## 最佳实践

### set 方法

**我应该避免使用 set 方法吗？** 这一点见仁见智。我们推荐的最佳实践是，应当修改存储的内容本身，而不是存入对象再修改它的子属性。同时，如果你在使用 IndexedDB，这样也能最大限度地利用 IndexedDB 的性能优势，和避免在读取大量数据时一次全部读到 Memory 里。如果你想存储多个相关的值，可以：

```js
/**
 * bad ✖ 将相关数据存入一个对象
 */
configState.data.theme = {
  color: "blue",
  mode: "white",
  background: "foo.jpg",
};
// set..
configState.set("theme", (val) => {
  val.color = "red";
});

/**
 * good ✔ 利用变量名来区分归类
 */
configState.data.themeColor = "blue";
configState.data.themeMode = "white";
configState.data.themeBackground = "foo.jpg";
// set..
configState.data.themeColor = "red";

/**
 * good ✔ 建立一个模型，存储此类数据
 */
themeState.data.color = "blue";
themeState.data.mode = "white";
themeState.data.background = "foo.jpg";
// set..
themeState.data.color = "red";
```

如果你想要存储一组数据的集合，比起向对象模型中存入一个数组，我们更推荐直接使用[集合模型](#集合模型)：

```js
/**
 * bad ✖ 将数组存入对象模型的一个属性中
 */
configState.data.drafts = [];
const drafts = configState.data.drafts;
// push..
configState.set("drafts", (val) => {
  val.push({
    name: "foo",
    content: "bar",
  });
});
// read..
console.log(drafts[0]);

/**
 * good ✔ 建立一个集合模型，存储此类数据
 */
// push..
new draftModel.data({
  name: "foo",
  content: "bar",
});
// read..
console.log(draftList.data[1]);
```

### 模型命名

你可能注意到了，尽管并没有限制的模型名称，但在前文中，我们使用了 `xxxState` 和 `xxxList` 的格式作为模型名。因为这种命名方式，是我们推荐的最佳实践。

当一个模型是 **对象模型** 时 (主键通常为 `string`)，我们通常用来存储状态：比如用户的信息、用户的配置、使用的主题、所激活的标签页…… 我们推荐使用 `名词 + State` 的形式命名。

当一个模型是 **集合模型** 时 (主键通常为 `number`)，我们通常用来存储列表：比如草稿箱、主题列表、当前打开的标签页…… 我们推荐使用 `名词 + List` 的形式命名。

之所以不直接使用 `名词` 作为模型名，是因为我们通常描述一个 `名词`，需要为其创建对象模型和集合模型两种模型。

例如，实现一个类似 Chrome 的标签页功能，可能会建立下面两个模型：

- **`tabList` 模型：** 存放所打开的标签页列表…… 每个标签页项目包括名称、图标、URL 等字段……

- **`tabState` 模型：** 存放当前激活的标签页 id、对标签页的排序、用户所固定的标签页 id……

如果 `tabState` 直接使用 `tab` 作为模型名，那么 `tabList` 就很难为其起准确的名字。

### 模型方法

关于在模型上编写各种方法，若遵循以下几项，将有助于你写出更清晰健壮的代码：

- **对模型的操作，只能通过模型上的方法来进行。** 即不要在别处直接 `tabState.data.active = 3`，而是应该在模型上编写一个 `active` 方法，然后 `tabState.active(3)`。在用户操作后，你通常不止需要修改模型上的一个值，将有助于你复用代码。除此以外，遵守此约定还会让你知道，你有关此模型数据的所有变更，都只会在其模型内部进行，而不是散落在工程各地。并且，你将有机会追踪模型状态的更改，和在重构或扩展功能时，只需更改模型上的方法，而不是去各种地方寻找其逻辑。以及，在 Vuex 等状态管理库中，往往也有[类似的约定](https://vuex.vuejs.org/zh/guide/mutations.html)。

- **模型方法内，不操作别的模型。** 这个约定将避免你模型间耦合。如果在一个模型中依赖另一个模型，后续依赖关系将错综复杂，很难理顺逻辑，也很难重构代码。你可以通过调用不同模型上的方法，或者是依赖注入的方式，来避免违反此约定。
