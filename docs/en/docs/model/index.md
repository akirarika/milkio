# 模型

在前文中，我们介绍了基础用法，并使用了 `kurimudb-zero-config` 这个零配置包。通常来说，这已经能满足我们的需求啦。

可如果我们正在开发一个复杂的单页应用的话，想象一下：我们真的要，把各种数据都乱糟糟地塞在一个对象里吗？这可不是什么好办法。

这个时候，就该**模型 (Model) 功能**闪亮登场啦！ 🎉

## 起步

模型是存储和管理你应用数据的中心，之前我们使用的零配置包中，`memory`、`local`、`cookie` 和 `db` 对象，其实都是模型哦！

继续之前，我们先安装 Kurimudb 本体吧：

```bash
npm i kurimudb@5
```

## 创建模型

创建一个模型其实很简单，我们只需要继承 Kurimudb 的模型类即可：

```js
// 创建一个 /models/configState.js 文件
// 我们可以拿它来存和用户配置有关的数据
import { SyncModels } from "kurimudb";

export default new class ConfigState extends SyncModels.keyValue {
  super({
    // 模型名称，必填，须全局唯一
    name: "ConfigState",
  });
}
```

是的，只要新建一个这样的 `js` 文件，我们就拥有了一个模型。我们可以像操作普通对象一样，来读写它内部的数据：

```js
import configState from './models/configState.js';

configState.data.say = 'hello world'; // 写入..
console.log(configState.data.say); // 读取..
delete configState.data.say; // 删除..
'say' in configState; // 判断是否存在..
```

## 类 Storage Api

如果你使用过 `localStorage` 的话，一定会很熟悉这种方式：

```js
local.setItem('say', 'hello'); // 设置
let say = local.getItem('say'); // 获取
local.removeItem('say'); // 删除
local.subscribeItem('say', (val) => { ... }); // 订阅变更
local.bulkSetItem({
  say: 'hello',
  then: 'goodbye',
}); // 批量设置
local.bulkGetItem(['say', 'then']); // 批量获取
local.bulkRemoveItem(['say', 'then']); // 批量删除
```

其中的批量操作的函数都是具有原子性的，如果对其中某些值的操作失败了，会自动回滚之前已成功的值。

比起前文通过 `data` 对象来操作数据，我们其实**更推荐**你使用类 Storeage Api。显式的调用函数可读性更高，并且不容易和普通对象混淆，而造成 bug。

## 模型方法

在模型类上，我们还可以添加**任何方法**哦！就像：

```js
// /models/configState.js
import { Models } from 'kurimudb';

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
import configState from './models/configState.js';

configState.setFoo();
await configState.calcBar();
```

我们推荐你将对模型数据的更改，**都写在模型内部的方法中**。外部只通过调用这些方法，来变更模型的数据。遵守这个简单的约定，除了更方便复用代码，还能有效解耦我们的应用，也方便你追踪数据流的变化。并且，将对模型数据的更改都聚集到一处，阅读代码时，也能很轻易的理解数据是如何改变的。

## 集合模型

模型分为**键值对模型 (Key Value Model)** 和**集合模型 (Collection Model)**。在前文中，我们的模型都是**键值对模型**。它们用起来，就像对象那样：

```js
state.data.foo;
```

我们也有时，可能也需要一个以集合的方式、添加数据时主键会自动递增的模型，有些类似数组：

```js
list.data[700];
```

集合模型常见的应用场景是各种列表，比如缓存的视频列表、用户的草稿箱列表…… 接下来，假设我们正在开发一个便签应用，需要在本地存储用户写的便签。

让我们来新建一个 `NoteList` 模型：

```js
// 创建一个 /models/noteList.js 文件
import { SyncModels } from 'kurimudb';

// 继承 SyncModels.collection 来让它变成一个集合模型
export default new (class NoteList extends SyncModels.collection {
  super({
    name: "NoteList",
  });
})();
```

使用时，通过 `insertItem` 方法来创建的数据，主键会自增：

```js
import noteList from '@/models/noteList';

const note1 = noteList.insertItem('This is the content of note 1');
const note2 = noteList.insertItem('This is the content of note 2');
console.log(noteList.data[1]); // echo "This is the content of note 1"
console.log(noteList.data[2]); // echo "This is the content of note 2"

const keys = noteList.bulkInsertItem(['note3', 'note4']);
console.log(keys); // echo ["3", "4"]
```

::: warning 注意事项

- 集合模型的主键是从 `1` 开始递增的，这和数组不同。这么设计是为了更好的兼容 IndexedDB，因为 IndexedDB 是从 `1` 开始的。
- 集合模型中，删除任意值，不会导致其他值的主键变动。也就是说，集合模型的键可以视为唯一且不变的。

:::

## 模型填充

我们可能想为一些模型填充初始值。例如，我们在做一个电子书应用，希望在用户首次使用时，为他指定一个默认的字体大小、主题、翻页模式……

我们可以在模型中的构造方法中，调用 `seed` 方法，来填充初始值：

```js {8,9,10,11}
// /models/configState.js
import { SyncModels } from 'kurimudb';

class ConfigState extends SyncModels.keyValue {
  constructor() {
    // ..

    this.seed(() => {
      this.setItem('fontSize', '14px');
      this.setItem('theme', 'default');
      this.setItem('turningMode', 'roll');
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

默认情况下，每次运行你的网页，都会填充一次数据。如果模型配置了[存储驱动](/docs/persistence/)，那么只有在用户首次运行你的网页时，才会进行数据填充。
