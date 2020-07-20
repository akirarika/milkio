# Modexie

简体中文 | [English](./readme_en.md)

一个简单实用的 IndexedDB Model 库，Database 的数据可以和 DOM 同步 (如果你有 MVVM 框架的话 😃)，和用你最爱的 [Dexie.js](https://dexie.org/) 来写增删改查 🎉

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
   */
  migrations: {
    1: "++id, title, author_id",
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
   * 第一个参数是 [Dexie Table](https://dexie.org/docs/Table/Table) 对象，可以根据 Dexie 文档增删改查
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
   * "方法(methods)"和"查询方法(queries)"的区别是，查询方法可以使用加载关联、数据绑定等功能，而方法则只是一个简单的函数
   * "查询方法"必须返回一个对象(代表某条结果)或数组(代表数条结果)，也可以异步或是 Promise
   * 一般来说，增、删、改、或 count 等使用"方法(methods)"，而查，则使用"查询方法(queries)"
   * 第一个参数是 [Dexie Table](https://dexie.org/docs/Table/Table) 对象，可以根据 Dexie 文档增删改查
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

监听默认情况只对修改和删除生效，之所以不对创建有效，是因为前端展示很多时候都需要分页，而且创建的内容插入的位置也不固定

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

IndexedDB 是非关系型数据库，所以最好不要用 Mysql 的表关联思维来设计 IndexedDB 的数据结构

一个比较好的思路是 [如 MongoDB 所说](https://docs.mongodb.com/manual/applications/data-models-relationships/)，另外由于 IndexedDB 是前端数据库，数据量要远比后端数据库要少，所以在设计结构时，可读性和可扩展性远要比性能重要

由于 IndexedDB 没有类似 MongoDB DBRefs 的功能，所以 Modexie 实现了一个模型关联功能

以 Book 关联 Author 为例，原本 Book 结构为：

```javascript
{
  title: '2666',
  author_id: 1,
}
```

加载关联后查询出的结构为：

```javascript
{
  title: '2666',
  author: {
    id: 1,
    name: 'roberto',
    avatar: 'xxxxxxx',
  },
}
```

使用前需要先在模型文件中定义关联

```javascript
// models/Book.js

export default {
  name: "book",

  // ...

  /**
   * 模型关联
   */
  relationships: {
    author({ models, whereIn, resultsArr }) {
      const authors = whereIn(models.author, "id", "author_id").toArray();

      return {
        mount: (result, relationship) => result.id === relationship.id,
        array: authors,
        defaults: {},
      };
    },
  },
};
```

此部分待续

## API

```javascript
const mydb = new Modexie(new Dexie("mydb"), [Book, Author]);

// 当前数据库所使用的原始 Dexie 对象
mydb.con;

// 当前数据库所有的模型
mydb.models;

// 调用模型的方法
mydb.models.book.method("methods name", ...args);

// 调用模型的查询方法
mydb.models.book.query("queries name", ...args);

// 加载模型关联
mydb.models.book.with("relationships name").query(...);

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
