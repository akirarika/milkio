# 筛选查询

## 批量查询

当需要从模型中按条件查询时，我们可以使用 [Dexie](https://dexie.org/docs/Table/Table) 来以链式调用的语法编写查询条件：

```js
// 查询 id 小于 5 的便签
console.log(await noteModel.getResults(
    // query() 函数返回一个 [Dexie Table 对象](https://dexie.org/docs/Table/Table)
    noteModel.query().where('id').below(5)
))
```

我们更推荐将查询写在模型内部，以便实现代码的复用。

```js
// /models/noteModel.js
export default new class Config extends model {
    ...
    
    getIdBelow5Results() {
        return this.getResults(this.query().where('id').below(5));
    }
};

// 使用时
await noteModel.getIdBelow5Results();
```

查询条件可以非常强大：

```js
this.getResults(this.query().where("age").between(20, 25).offset(150).limit(25));
```

## 单个查询

如果查询的结果只有一个，那么请用 `getResult` 而不是 `getResults` 函数：

```js
this.getResult(this.query().where("age").equals(1).first());
```

## 获取模型全部数据

```js
console.log(await noteModel.all())
```

## 全文搜索

待续