# 订阅更新

待续 🐸

## 订阅单个数据更新

Kurimudb 集成了 RxJS，每一条数据都可以转换为 [BehaviorSubject 对象](https://rxjs.dev/guide/subject#behaviorsubject)，只要在要读取的值后加上 `$` 符号即可。调用 `subscribe` 函数，可以立刻获取此值，及订阅此值后续的变更。

```js
config.data.name = "hello";

setTimeout(() => {
  config.data.name$.subscribe((name) => (this.name = name));
  setTimeout(() => (config.data.name = "world"), 1000);
}, 1000);

// 执行会输出：
// hello
// world
```

假设我们使用 `Vue` 开发视图页面，我们可以这样来订阅数据的更新：

```vue {17,18}
<template>
  <div>Name: {{ name }} <button @click="setName">Set Name</button></div>
</template>

<script>
  import configModel from "@/models/configModel";

  export default {
    data() {
      return {
        name: null,
      };
    },
    async mounted() {
      configModel.data.name = "hello";
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

## 订阅整个模型更新

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

这通常用于视图中展示了一组模型内容的列表，且需要在模型变换时实时更新的情况。以 Vue 为例：

```vue {18}
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
