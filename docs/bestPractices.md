🚧 施工中，敬请期待

<!-- ## 模型命名

你可能注意到了，尽管并没有限制的模型名称，但在前文中，我们使用了 `xxxState` 和 `xxxList` 的格式作为模型名。之所以不直接使用 `名词` 作为模型名，是因为我们通常描述一个 `名词`，需要为其创建键值对模型和集合模型两种模型。

例如，实现一个类似 Chrome 的标签页功能，可能会建立下面两个模型：

- **`tabList` 模型：** 是集合模型，存储所有的标签页，里面每个项目都包括名称、图标、URL 等字段……

- **`tabState` 模型：** 是键值对模型，存放当前激活的标签页 id、对标签页的排序、用户所固定的标签页 id……

如果 `tabState` 直接使用 `tab` 作为模型名，那如果需要 `tabList` 时，就很难为其起准确的名字。而且，以单名词命名也容易产生冲突：例如你在标签页相关的视图代码中，使用了一个 `tab` 变量，但由于它和模型名称重复了，所以导致你不得不改名。

::: tip 💬 最佳实践

对模型进行操作的相关代码，**应当都写在模型自身的方法中**，而不是视图(View)中。这么做，除了方便代码复用以外，还能避免模型和视图代码中的耦合，和提高你应用的内聚性。

```js
// ✖ Bad
configState.data.themeMode = "dark";
configState.data.themeSize = "12px";
configState.data.themeColor = "black";

// ✔ Good
class ConfigState extends Models.keyValue {
  setDarkTheme() {
    this.data.themeMode = "dark";
    this.data.themeSize = "12px";
    this.data.themeColor = "black";
  }
}
// in use..
configState.setDarkTheme();
``` -->
