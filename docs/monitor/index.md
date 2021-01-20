# 模型订阅

## 订阅数据变动

Kurimudb 集成了 RxJS，每一条数据都可以转换为 [BehaviorSubject 对象](https://rxjs.dev/guide/subject#behaviorsubject)，只要在要读取的值后加上 `$` 符号即可。调用 `subscribe` 函数，可以立刻获取此值，及订阅此值后续的变更 (就像 Vue3 的 `watchEffect`)。

```js
configModel.data.name = "hello";
setTimeout(() => {
  configModel.data.name$.subscribe((name) => (this.name = name));
  setTimeout(() => {
    configModel.data.name = "world";
  }, 1000);
}, 1000);

// 执行会输出：
// hello
// world
```

## 订阅模型变动

你可能希望订阅模型执行的一些动作，它们都是 [Subject 对象](https://rxjs.dev/guide/subject)：

```js
// 当有数据插入时
configModel.inserted$.subscribe(...)
// 当有数据删除时
configModel.deleted$.subscribe(...)
// 当有数据更改时
configModel.updated$.subscribe(...)
// 当有数据被插入、删除、更改时
configModel.changed$.subscribe(...)
```

如果你想让 `changed$` 订阅立刻触发一次，并且在后续的变更时也触发，可以直接：

```js
configModel.$.subscribe(...) // 它和值一样，将返回 [BehaviorSubject 对象](https://rxjs.dev/guide/subject#behaviorsubject)
```

## 状态管理 (Vue)

Kurimudb 也可以用来管理应用的状态。**它和 Vuex 相比，有以下特点：**

- 语法相对简单，心智负担较轻。

- 状态可以持久化到 IndexedDB 中。

- Vuex 中状态的变化直接触发视图的变更，存在副作用。

- Vuex 的 `Mutation` 必须是同步函数，Kurimudb 的模型方法可以是异步函数。

---

想将 Kurimudb 用作状态管理，其实很简单：

```vue
<template>
  <div>Name: {{ name }} <button @click="setName">Set Name</button></div>
</template>

<script>
  import configModel from "@/models/configModel";

  configModel.data.name = "hello";

  export default {
    data() {
      return {
        name: null,
      };
    },
    async created() {
      // 我们订阅 name 的变化，如果 name 发生了改变，就将新结果赋值给组件内部
      configModel.data.name$.subscribe((name) => (this.name = name));
    },
    methods: {
      setName() {
        configModel.data.name = prompt("Your name?");
      },
    },
  };
</script>
```

---

```vue
<template>
  <div>
    <button @click="addNote">Add Note</button>
    <div v-for="(book, id) in books">{{ id }}: {{ book }}</div>
  </div>
</template>

<script>
  import bookModel from "@/models/bookModel"

  export default {
    data() {
      return {
          books: {}
      };
    },
    async mounted() {
      // 如果书籍模型的数据有任何变动，就都将变化后的数据列表赋值给组件内部
      bookModel.$.subscribe((name) => this.books = await bookModel.all())
    },
    methods: {
        async addNote() {
            // 添加一本书
            console.log(
              await new bookModel.data({
                  title: `name-${Math.random().toString(36).slice(-6)}`, // 标题使用随机字符串
                  timestamp: new Date().getTime(),
              })
          )
        }
    }
  };
</script>
```

## 状态管理 (React)

待续 🐸
