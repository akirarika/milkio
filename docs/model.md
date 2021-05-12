---
sidebarDepth: 2
---

# 模型

在前文中，我们介绍了基础用法，并使用了 `kurimudb-zero-config` 这个零配置包。通常来说，这已经能满足我们的需求啦。

可如果我们正在开发一个复杂的单页应用的话，想象一下：我们真的要，把各种数据都乱糟糟地塞在一个对象里吗？这可不是什么好办法。

这个时候，就该 **模型 (Model) 功能** 闪亮登场啦！ 🎉

## 起步

模型是存储和管理你应用数据的中心，之前我们使用的零配置包中，`memory`、`local`、`cookie` 和 `db` 对象，其实都是模型哦！

继续之前，我们先安装 Kurimudb 本体吧：

```bash
npm i kurimudb@4
```

## 创建模型

创建一个模型其实很简单，只需要继承 Kurimudb 的模型类即可：

```js
// 创建一个 /models/configState.js 文件
// 我们可以拿它来存和用户配置有关的数据
import { Models } from "kurimudb";

export default new class ConfigState extends Models.keyValue { }
```

如此，你就拥有了一个 `ConfigState` 模型，它是一个 **键值对模型**，使用时则更加简单：

```js
import configState from "./models/configState.js";

configState.data.say = "hello world"; // 写入..
console.log(configState.data.say); // 读取..
delete configState.data.say; // 删除..
"say" in configState; // 判断是否存在..
```

通过构造函数，你还可以自定义模型的选项：

```js
// /models/configState.js

import { Models } from "kurimudb";

export default new class ConfigState extends Models.keyValue {
  constructor() {
    super({
      // 模型名称，必须全局唯一
      // 默认情况下，将使用你此类的类名
      name: "OurModel",
      // 模型的主键类型
      // 默认情况下，键值对模型会用 "string"，集合模型会用 "number"
      type: "number",
    });
  }
}
```

## 模型方法

在模型类上，我们还可以添加**任何方法**哦！就像：

```js
// /models/configState.js
import { Models } from "kurimudb";

class ConfigState extends Models.keyValue {
  // ..

  // 添加一个模型方法
  setFoo(bar, foo) {
    // 各种逻辑..
    this.data.foo = foo;
    this.data.bar = bar;
  }

  // 模型的方法也可以是异步的
  async calcBar() {
    // ..
  }
}

export default new ConfigState();
```

使用时，直接在模型上调用即可：

```js
import configState from "./models/configState.js";

configState.setFoo();
await configState.calcBar();
```

## 集合模型

在前文中，我们的模型都是键值对模型，它们用起来，就像对象那样：

```js
configState.data.foo;
```

我们也有时，可能也需要一个以集合的方式、添加数据时主键会自动递增的模型，有些类似数组：

```js
configState.data[700];
```

集合模型常见的应用场景是各种列表，比如缓存的视频列表、用户的草稿箱列表…… 接下来，假设我们正在开发一个便签应用，需要在本地存储用户写的便签。

让我们来新建一个 `NoteList` 模型：

```js {5}
// 创建一个 /models/noteList.js 文件
import { Models } from "kurimudb";

// 继承 Models.collection 来让它变成一个集合模型
export default new class NoteList extends Models.collection {
  // ...
}
```

使用时，通过 `insert` 方法来创建的数据，主键会自增：

```js
import noteList from "@/models/noteList";

const note1 = noteList.insert("This is the content of note 1");
const note2 = noteList.insert("This is the content of note 2");
console.log(noteList.data[1]); // echo "This is the content of note 1"
console.log(noteList.data[2]); // echo "This is the content of note 2"
```

你还可以使用 `all` 函数来获取此集合模型中的全部数据：

```js
noteList.all();
```

::: warning 小贴士

1. 集合模型的主键是从 `1` 开始递增的，这和数组不同。这么设计是为了更好的兼容 IndexedDB，因为 IndexedDB 是从 `1` 开始的。
2. 集合模型中，删除任意值，不会导致其他值的主键变动，这和数组不同。也就是说，主键可以视为唯一且不变的。
3. 集合模型的主键，类型必须是 `number` 才行哦！

:::

## 模型填充

我们可能想为一些模型填充初始值。例如，我们在做一个电子书应用，希望在用户首次使用时，为他指定一个默认的字体大小、主题、翻页模式……

那么可以在模型中的构造方法中，调用 `seed` 方法，来填充初始值：

```js {8,9,10,11}
// /models/configState.js
import { Models } from "kurimudb";

class ConfigState extends Models.keyValue {
  constructor() {
    // ..

    this.seed(() => {
      this.data.foo = "foo";
      this.data.bar = "bar";
    });
  }
}
```

对于**键值对模型**，你可以传入一个对象来简化模型填充：

```js
this.seed({
  foo: 'bar',
  baz: 'qux',
});
// 相当于：
this.seed(() => {
  this.data.foo = 'bar';
  this.data.baz = 'qux';
});
```

对于**集合模型**，你可以传入一个数组来简化模型填充：

```js
this.seed(['foo', 'bar']);
// 相当于：
this.seed(() => {
  this.insert('foo');
  this.insert('bar');
});
```

默认情况下，每次运行你的网页，都会填充一次数据。

如果模型配置了[存储驱动](/persistence)，那么只有在用户首次运行你的网页时，才会进行数据填充。



## 深克隆

在继续探索之前，我们先聊聊 JavaScript 中一个的知识：你将对象或数组，赋值给另一个变量时，**传递的其实是原先变量的引用**，请看下面的例子：

```js
let number1 = 965;
let number2 = number1;
number1 = 996;
console.log(number2);
// echo 965

let object1 = { foo: 965 };
let object2 = object1;
object1.foo = 996;
console.log(object2.foo);
// echo 996
```

JavaScript 的这个特性，会导致**副作用**产生，成为 bug 的根源。因此，为了尽量保证数据的不可变性，你向 Kurimudb 存入数据时，我们会数据进行**深克隆 (deep clone)**。读取数据时，它与原值是完全脱钩的。

对于 **朴素对象 (plain object)** 来说，深克隆没什么好担心的，但对于别的对象，如 `new Set(...)` 或 `new Blob(...)` 等，由于我们只能克隆其**可枚举属性**，深克隆会导致其丢失内容。

因此，我们提供了一份白名单。如果你的数据或其内部有这些对象，则 Kurimudb 不会深克隆它们。

```yaml
- Boolean
- String
- Date
- RegExp
- Blob
- File
- FileList
- ArrayBuffer
- DataView
- Uint8ClampedArray
- ImageData
- Map
- Set
- Symbol
- HTMLDivElement
# 通过 `yourObj.constructor.name` 来判断
```

如果你想在某个模型中，覆盖这份白名单，你可以：

```js {8}
import { Models } from "kurimudb";

class ConfigState extends Models.keyValue {
  constructor() {
    super({
      intrinsicTypes: ["File", "FileList"],
    });
  }
}
```

如果你想对任何对象**都**进行深克隆，你可以直接传入一个空数组：

```js
intrinsicTypes: []
```

如果你想对任何对象**都不**进行深克隆，你可以传入 `false`：

```js
intrinsicTypes: false
```

如果你想手动进行深克隆，你可以调用模型上的 `deepClone` 函数：

```js
yourModel.deepClone(yourOldObject);
```

## 类 Storage Api

你还可以使用类似 [Storage](https://developer.mozilla.org/docs/Web/API/Storage) 的 Api 来增删改查数据：

```js
local.setItem("say", "hello"); // create it
let say = local.getItem("say"); // retrieve it
local.removeItem("say"); // delete it
local.subscribeItem("say", (val) => { ... }); // subscribe it
```

> 📜 使用此功能需要 (^4.0.0) 版本。
