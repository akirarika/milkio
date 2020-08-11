# Modexie

简体中文 | [English](./readme_en.md)

一个简单实用的 IndexedDB Model 库，Database 的数据可以和 DOM 同步 (如果你有 MVVM 框架的话 😃)，和用你最爱的 [Dexie.js](https://github.com/dfahlander/Dexie.js) 来写增删改查 🎉

## 许可证

[GLWTL](./license.txt)

## 入门

```bash
# 使用 modexie 需要 dexie，所以两个都需要安装哦
npm i modexie dexie
```

接着我们在项目中新建一个 `models` 文件夹，用于存放我们的模型

假设我们要写一个图书馆应用，所以需要 `Book` 和 `Author` 两个 Model

这是一个 `Book` 模型的示例文件：

```javascript
// models/Book.js

export default {
  /**
   * 名称 (*必需属性*)
   * 会以此为依据在 indexedDB 中创建同名的表，每个模型都对应一张表且只对应一张表
   */
  name: "book",

  /**
   * 迁移 (*必需属性*)
   * 声明版本和表索引的结构
   * 底层实现是调用 [Dexie Version](https://dexie.org/docs/Tutorial/Design#database-versioning)，将其拆分到每个模型下的用意是为了解耦
   * 注：indexedDB 不是关系型数据库，它只需要声明索引即可，而**不是**声明每个你可能用到的键
   * 至于哪些键应该被索引，一般来说，只需要索引你需要 where 的键即可。
   *
   * 版本 >= 1.6.0 后，迁移中的每个版本都必须是函数，此更改是为了方便在调用 [Dexie Upgrade](https://dexie.org/docs/Version/Version.upgrade()) 等函数
   */
  migrations: {
    1: (store) => store("++id, name, book_id"),
    // 等价于 Dexie 的 mydb.version(1).stores({book: "++id, name, book_id"})
    // 2: (store) => store("++id, name, book_id").upgrade(...),
    // 等价于 Dexie 的 mydb.version(2).stores({book: "++id, name, book_id"}).upgrade(...),
  },

  /**
   * 填充
   * 只在用户首次运行程序时才会执行
   * 第一个参数返回了一个 [Dexie Table](https://dexie.org/docs/Table/Table) 对象
   * 你可以用来对模型填充一些初始化数据，或者做一些别的事情
   * 例如下方向表中添加了一本书
   */
  seeding(table) {
    table.add({
      title: "1984",
      author_id: 1,
    });
  },

  /**
   * 默认属性
   * 当插入一条新数据时，若这些属性未指定，则赋予他们这些默认值
   * 如果一个默认属性是函数，则每次插入或修改模型时，此属性都会被执行函数的返回值覆盖
   * 用来实现如自动维护更新时时间戳的功能会很方便
   */
  attributes: {
    cover: "/images/book/default_cover.jpg",
    created_at: new Date().getTime(),
    updated_at() {
      return new Date().getTime();
    },
  },

  /**
   * 方法
   * 一般来讲，为了避免耦合，对模型的增删改查，最好都通过一个封装了所有查询语句的方法来完成。外部只需要调用此方法，就能得到它想要得到的
   * 第一个参数是 [Dexie Table](https://dexie.org/docs/Table/Table) 对象
   * 方法可以是异步的，也可以返回 Promise
   */
  methods: {
    addBook(table) {
      return table.add({
        title: "2666",
        author_id: null,
      });
    },
  },

  /**
   * 查询方法
   * "方法(methods)"和"查询方法(queries)"的区别是，"查询方法(queries)"可以使用模型关联、数据视图绑定等功能，而"方法(methods)"则只是一个简单的函数
   * "查询方法(queries)"必须返回一个对象(代表某条结果)或数组(代表数条结果)，也可以异步或是 Promise
   * 一般来说，增、删、改、或 count 等使用"方法(methods)"，而查，则使用"查询方法(queries)"
   * 第一个参数是 [Dexie Table](https://dexie.org/docs/Table/Table) 对象
   */
  queries: {
    async all(table) {
      return await table.toArray();
    },
    async first(table) {
      return await table.where({ id: 1 }).first();
    },
  },
};
```

创建好模型后，在你应用的入口文件中初始化 Modexie

```javascript
// main.js

import Dexie from "dexie";
import Modexie from "modexie";
// 引入你写的模型
import Book from "./models/Book";
import Author from "./models/Author";

const connection = new Modexie(
  // 第一个参数需传入一个 [Dexie 实例对象](https://dexie.org/docs/Dexie/Dexie)，Modexie 的所有操作都将通过调用此对象来完成
  new Dexie("mydb"), // 小贴士：Dexie 的第一个参数是数据库名称
  // 第二个参数是一个数组，里面传入所有你需要应用到此数据库的模型
  [Book, Author]
);

window.mydb = connection; // 你可以把它挂载到 window 方便使用
// Vue.prototype.$mydb = connection; // 如果你用 vue，也可以把它挂到你组件的 this 里
```

你可以这样访问到你定义的模型

```javascript
window.mydb.models["你的模型名称"];
```

使用起来就非常简单了，例如我们想读取所有的书，我们可以调用我们先前定义的查询方法

```javascript
const book = await this.$mydb.models.book.query("first");
const books = await this.$mydb.models.book.query("all");

console.log(book, books);
```

## 数据视图绑定

使用此功能前，你需要有在使用一款 MVVM 框架，此功能会监听模型的更改，当有更改时，立刻将更改同步到你查询方法查询出的对象中 (因为 Javascript 的 Array 和 Object 都是地址引用而不是值引用)，接着由于数组或对象被更改，你 MVVM 框架就会将数据和你的视图同步

下面以 Vue 为例：

```html
<template>
  <div>
    <button @click="put">Put Book</button>
    <div v-for="book in books" :key="book.id">
      {{ book.title }}
    </div>
  </div>
</template>

<script>
  export default {
    data() {
      return {
        books: [],
      };
    },
    async mounted() {
      this.books = await this.$mydb.models.book.query("all");
      // 调用 watch 函数来监听书籍变更，点下 `Put Book` 按钮吧！
      this.$mydb.models.book.watch(this.books);
    },
    components: {},
    methods: {
      put() {
        this.$mydb.models.book.method("put", {
          id: 1,
          title: Math.random().toString(36).slice(-8),
        });
      },
    },
  };
</script>
```

监听时，需要一个唯一的键来确定数据，类似 vue for 时需要 key，默认为 `id`，如需更改可以这样

```javascript
  async mounted() {
    // ...

    this.$mydb.models.book.watch(this.books, {
      primary: 'unionid' // 以 'unionid' 为唯一的键
    });
  },
```

监听默认情况只对修改和删除生效，之所以不对创建有效，是因为前端展示许多情况都使用分页，将新增的对象添加到现有数据的末尾不是正确的，此时，你更希望什么都不做。而如果你对数据倒序时，你又会希望创建的新数据可以插入到到数组顶部

所以如果需要监听创建操作，可以定义一个函数，来决定如何操作数据

```javascript
  async mounted() {
    // ...

    this.$mydb.models.book.watch(this.books, {
      // 第一个参数代表要新增的对象
      creating: (object) => {
        this.books.unshift(object); // 将此对象添加到 this.books 的开头
      },
    });
  },
```

## 模型关联

IndexedDB 是非关系型数据库，目前比较推崇的数据库表设计范式是 [如 MongoDB 所说](https://docs.mongodb.com/manual/applications/data-models-relationships/)，在使用模型关联功能之前，推荐先阅读下再决定是否真的有必要进行多表关联

另外，由于 IndexedDB 是前端数据库，数据量通常远比后端数据库要少，所以在设计结构时，可读性和可扩展性远要比性能重要

### 一对一关联

假设一个 `User` 模型关联一个 `Phone` 模型

```javascript
// models/User.js

{
  id: 42,
  name: 'david',
}
```

```javascript
// models/Phone.js

{
  id: 36,
  user_id: 42,
  code: '086',
  number: '12345678901',
}
```

加载关联后查询出的结构为

```javascript
{
  id: 42,
  name: 'david',
  phone: {
    id: 36,
    user_id: 42,
    code: '086',
    number: '12345678901',
  }
}
```

使用前需要先在模型文件中定义关联

```javascript
// models/User.js

export default {
  name: "user",

  // ...

  /**
   * 模型关联
   */
  relationships: {
    async phone({ hasOne, belongsTo, hasMany, belongsToMany }) {
      return await hasOne({
        model: "phone", // 关联模型的名称，需与当前模型处于同一数据库
        // foreignKey: "user_id", // 外键，不填则默认为 `${父模型名}_id`
        // localKey: "id", // 主键，不填则默认为 `id`
        // defaultValue: {}, // 当关联结果为空的默认值，不填则默认为空对象，原因：https://en.wikipedia.org/wiki/Null_object_pattern
      });
    },
  },
};
```

然后在 `query` 前调用 `with` 即可使用，`with` 函数接受一个数组，你可以同时加载多个关联的子模型

```javascript
this.list = await this.$mydb.models.user.with(["phone"]).query("yourQueryName");
```

### 一对一关联（反向）

我们已经可以从 `User` 拿到 `Phone` 了，那么我们想从 `Phone` 拿到 `User` 就在模型文件中定义反向关联

```javascript
// models/Phone.js

export default {
  name: "user",

  // ...

  /**
   * 模型关联
   */
  relationships: {
    async user({ hasOne, belongsTo, hasMany, belongsToMany }) {
      return await belongsTo({
        model: "user", // 关联模型的名称，需与当前模型处于同一数据库
        // foreignKey: "user_id", // 外键，不填则默认为 `${子模型名}_id`
        // localKey: "id", // 主键，不填则默认为 `id`
        // defaultValue: {}, // 当关联结果为空的默认值，不填则默认为空对象，原因：https://en.wikipedia.org/wiki/Null_object_pattern
      });
    },
  },
};
```

然后在 `query` 前调用 `with` 即可使用

```javascript
this.list = await this.$mydb.models.phone.with(["user"]).query("yourQueryName");
```

结果如下

```javascript
{
  id: 36,
  user_id: 42,
  code: '086',
  number: '12345678901',
  user: {
    id: 42,
    name: 'david',
  }
}
```

### 一对多关联

假设一个 `Author` 模型关联多个 `Book` 模型

```javascript
// models/Author.js

{
  id: 42,
  name: 'david',
}
```

```javascript
// models/Book.js

{
  id: 36,
  author_id: 42,
  title: '2666',
}
```

使用前需要先在模型文件中定义关联

```javascript
// models/Author.js

export default {
  name: "user",

  // ...

  /**
   * 模型关联
   */
  relationships: {
    async books({ hasOne, belongsTo, hasMany, belongsToMany }) {
      return await hasMany({
        model: "book", // 关联模型的名称，需与当前模型处于同一数据库
        // foreignKey: "user_id", // 外键，不填则默认为 `${父模型名}_id`
        // localKey: "id", // 主键，不填则默认为 `id`
        // defaultValue: [], // 当关联结果为空的默认值，不填则默认为空数组，原因：https://en.wikipedia.org/wiki/Null_object_pattern
      });
    },
  },
};
```

然后在 `query` 前调用 `with` 即可使用

```javascript
this.list = await this.$mydb.models.author
  .with(["books"])
  .query("yourQueryName");
```

### 一对多关联（反向）

同一对一关联（反向）

### 多对多关联

因为 IndexedDB 是非关系数据库，所以没必要用一张中间表来存储关联关系，使用数组即可

假设 `Book` 模型和 `Tag` 模型互相多对多关联

```javascript
// models/Book.js

{
  id: 1,
  title: '2666',
  tag_id: [1, 2]
}
```

```javascript
// models/Tag.js

{
  id: 2,
  name: 'literature',
  book_id: [2, 4, 6]
}
```

模型中定义关联

```javascript
// models/Book.js

export default {
  name: "book",

  // ...

  /**
   * 模型关联
   */
  relationships: {
    async tags({ hasOne, belongsTo, hasMany, belongsToMany }) {
      return await belongsToMany({
        model: "tag", // 关联模型的名称，需与当前模型处于同一数据库
        // foreignKey: "user_id", // 外键，不填则默认为 `${父模型名}_id`
        // localKey: "id", // 主键，不填则默认为 `id`
        // defaultValue: [], // 当关联结果为空的默认值，不填则默认为空数组，原因：https://en.wikipedia.org/wiki/Null_object_pattern
      });
    },
  },
};
```

### 嵌套关联

To Be Continued

## API

```javascript
const mydb = new Modexie(new Dexie("mydb"), [Book, Author]);

// 当前数据库所使用的原始 Dexie 对象
mydb.con;

// 当前数据库所有的模型
mydb.models;

// 当前模型的 [Dexie Table](https://dexie.org/docs/Table/Table) 对象
mydb.models.book.table();

// 调用模型的方法
mydb.models.book.method("methods name", ...args);

// 调用模型的查询方法
mydb.models.book.query("queries name", ...args);

// 加载模型关联
mydb.models.book.with(["relationships name"]).query(...);

// 模型视图绑定监听
mydb.models.book.watch(..., {
  primary: ...,
  creating: ...
});

// 模型自带可直接使用的 method 方法
mydb.models.book.method("add", objectOrArray);
mydb.models.book.method("put", objectOrArray);
mydb.models.book.method("delete", objectOrArray);
```
