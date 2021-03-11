# Typescript

在 Typescript 中使用 Kurimudb，可以获得代码提示，和约束传入数据的格式类型。

## 定义模型

在前文 Javascript 的定义模型方式中，我们使用了向构造函数传入对象的方式：

```ts
// /models/configModel.ts

export default new Model({
  config: {
    // ...
  },

  setFoo(bar, foo)) {
      // ...
  },

  // 模型的方法支持异步的
  async calcBar() {
    // ..
  },
});
```

前文这种定义方式虽然代码量少，且语法兼容更古老的浏览器，但缺点是，在 Typescript 中，会失去代码提示 (毕竟静态时 this 指向不一样)。

所以，在 Typescript 环境中，我们更推荐使用**类继承**的方式来定义模型：

```ts
// /models/configModel.ts

export default class Config extends Model<any> {
  constructor() {
    super({
      config: {
        name: 'config',
        type: 'string',
        // ...
      },
    });
  }

  setFoo(bar, foo)) {
    // ...
  }

  async calcBar() {
    // ..
  }
}
```

## 约束数据类型

如果想约束存入数据的格式 (这通常用于[集合模型](/intro/#%e9%9b%86%e5%90%88%e6%a8%a1%e5%9e%8b))，我们可以通过向父类的泛型传入一个接口来约束数据格式：

```ts {12}
// /models/noteModel.ts

export interface NoteInterface {
  id: number;
  title: string;
  child_note_id: number[];
  content: string;
  created_at: number;
  updated_at: number;
}

export default class Note extends Model<NoteInterface> {
  constructor() {
    super({
      config: {
        name: "note",
        type: "number",
        // ...
      },
    });
  }

  // ..
);
```
