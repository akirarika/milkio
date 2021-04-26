# 最佳实践

我们总结了一份 Kurimudb 的最佳实践。如果愿意遵守这些简单的约定，往往有助于我们规避 Bug、写出质量更高的代码、或陷入"这个代码要写在哪里"这样的纠结。

## 模型方法

### 只用方法修改数据

对模型增删改查的代码，强烈推荐写在其模型方法里。不推荐写在视图组件中，然后通过 `yourModel.data` 来修改模型的数据。

这么做除了方便我们日后复用代码，还能解耦视图层，和使我们的代码意图更加清晰。关于这一点，`Vuex/Redux` 的 `Action` 也都有类似的约定。

```js
// Bad ✖ 在视图组件中直接修改模型的值
configState.data.themeSize = 16;
configState.data.themeColor = "#ffffff";

// Good ✔ 将操作写成一个方法，视图组件去调用
configState.setTheme(16, "#ffffff");
```

### 只修改自己的模型

模型方法应当只操作自己模型的数据，不应操作其它模型的数据。如果你要做一件事，它涉及了多个模型的操作，你可以分别调用它们模型上的各自方法，或者采用[依赖注入](https://stackoverflow.com/questions/130794/what-is-dependency-injection)的方式。

```js
// Bad ✖ 在模型方法中操作别的模型
class ConfigState extends Models.keyValue {
  setTheme(themeId) {
    const theme = themeList.data[themeId];
    this.data.activeTheme = theme;
  }
}

// Good ✔ 通过依赖注入来解耦
class ConfigState extends Models.keyValue {
  setTheme(theme) {
    this.data.activeTheme = theme;
  }
}
```

## 模型数据

### 避免深层赋值

当你存入一个对象或数组时，如果要修改其属性值，你可能会凭直觉，写出如下的代码：

```js
local.data.theme = { color: "blue", mode: "white" };
local.data.theme.color = "red";
```

但这样写**无法持久化数据**。原因是，你取出了 `theme` 对象的值，却没有将改动后的结果保存。上面的代码，本质上相当于：

```js {4}
local.data.theme = { color: "blue", mode: "white" };
const theme = local.data.theme;
theme.color = "red";
// you also need: local.data.theme = theme;
```

在 Kurimudb 中，我们不推荐像 Vuex 那样，将一组状态存入到一个多层嵌套的对象中，而是推荐建立一个模型，将相关状态存入到此模型中。模型的层级可以通过建立不同文件夹来实现。

```js
// bad ✖ 将相关数据存入一个对象
configState.data.theme = { color: "blue", mode: "white" };

// good ✔ 利用变量名来区分归类
configState.data.themeColor = "blue";
configState.data.themeMode = "white";

// good ✔ 建立一个模型，存储此类数据
themeState.data.color = "blue";
themeState.data.mode = "white";
```

如果要存入一组数据，我们同样推荐使用**集合模型**来代替数组：

```js
// bad ✖ 将数据存为数组，并存入键值对中
configState.data.drafts = [];
const drafts = configState.data.drafts;
drafts.push({ title: "foo", content: "bar" });
configState.data.drafts = drafts;

// good ✔ 建立一个集合模型，存储此类数据
draftModel.insert({ title: "foo", content: "bar" });
```

## 模型命名

我们推荐使用 `名词 + State` 作为键值对模型的名称，使用 `名词 + List` 作为集合模型的名称。这样通过名称，我们就可以方便地分辨它是什么类型的模型。

```js
// bad ✖ 直接使用 `名词` 或 `名词 + Model` 作为模型名
class Tab ...
class TabModel ...

// good ✔ 使用 `名称 + (State/List)` 作为模型名
class TabState extends Models.keyValue ...
class TabList extends Models.collection ...
```

拿一个实际场景来举例，假设我们要为中后台系统制作一个标签页功能，我们需要建立下面两个模型：

- **`tabList` 模型：** 是集合模型，存放所打开的标签页。里面每个项目都包括名称、图标、URL、顺序 等字段……

- **`tabState` 模型：** 是键值对模型，存放标签页展现形式、当前所激活的标签页 id……

如果 `tabState` 直接使用 `tab` 作为模型名，那如果需要 `tabList` 时，就很难为其起准确的名字。而且，以单名词命名也容易产生冲突：例如你在标签页相关的视图代码中，很容易使用 `tab` 作为变量名，但由于它和模型名称重复了，所以导致你不得不改名。

## 和视图框架结合

### Vue3

待续 🐸

### React

待续 🐸
