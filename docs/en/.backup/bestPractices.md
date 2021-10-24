# The Best Practices

We have summarized a list of Kurimudb's best practices. If we are willing to abide by these simple conventions, it will often help us avoid bugs, write better quality code, or prevent to get caught up in the entanglement of "where should this code be written".

## Model Methods

### Use Methods Only to Edit Data

The code for adding, deleting, modifying and checking the model is strongly recommended to be written in its model method. It is not recommended to write in the view component, and then use `yourModel.data` to modify the data of the model.

In addition to making it easier for us to reuse code in the future, it can also decouple the view layer and make our code intentions clearer. On this point, the `Action` of `Vuex/Redux` also has a similar convention.

```js
// Bad ✖ Reason: Modify the value of the model directly in the view component.
configState.data.themeSize = 16;
configState.data.themeColor = "#ffffff";

// Good ✔ Reason: Write the operation as a method or a view component to call.
configState.setTheme(16, "#ffffff");
```

### Only modify your own model

The model method should only operate on the data of its own model, and should not operate on the data of other models. If you want to do something, it involves the operation of multiple models, you can call their respective methods on the models, or use [Dependency Injection](https://stackoverflow.com/questions/130794/what-is -dependency-injection).

```js
// Bad ✖ Reason: Operate other models in the model method
class ConfigState extends Models.keyValue {
  setTheme(themeId) {
    const theme = themeList.data[themeId];
    this.data.activeTheme = theme;
  }
}

// Good ✔ Reason: Decoupling through dependency injection.
class ConfigState extends Models.keyValue {
  setTheme(theme) {
    this.data.activeTheme = theme;
  }
}
```

## Model Data

### Avoid Deep Assignment

When you save an object or array, if you want to modify its property value, you may intuitively write the following code:

```js
local.data.theme = { color: "blue", mode: "white" };
local.data.theme.color = "red";
```

But writing in this way **cannot persist data**. The reason is that you took out the value of the `theme` object, but did not save the changed result. The above code is essentially equivalent to:

```js {4}
local.data.theme = { color: "blue", mode: "white" };
const theme = local.data.theme;
theme.color = "red";
// you also need: local.data.theme = theme;
```

Due to the different design of Kurimudb, we do not recommend storing a set of states in a multi-level nested object like Vuex. We recommend building a model and storing the relevant state in this model. The hierarchy of the model can be achieved by creating different folders.

```js
// bad ✖ Reason: It stores relevant data in an object.
configState.data.theme = { color: "blue", mode: "white" };

// good ✔ Reason: Use variable names to distinguish categories.
configState.data.themeColor = "blue";
configState.data.themeMode = "white";

// good ✔ Reason: Build a model to store this type of data.
themeState.data.color = "blue";
themeState.data.mode = "white";
```

If you want to store a set of data, we also recommend using the **collection model** instead of the array:

```js
// bad ✖ Reason: Save the data as an array and store it in key-value pairs.
configState.data.drafts = [];
const drafts = configState.data.drafts;
drafts.push({ title: "foo", content: "bar" });
configState.data.drafts = drafts;

// good ✔ Reason: Build a collection model to store this type of data.
draftModel.insert({ title: "foo", content: "bar" });
```

## Model Naming

We recommend using `noun + State` as the name of the key-value pair model and `noun + List` as the name of the collection model. In this way, through the name, we can easily distinguish what type of model it is.

```js
// bad ✖ Reason: Directly use `noun` or `noun + Model` as the model name.
class Tab ...
class TabModel ...

// good ✔ Reason: Use `name + (State/List)` as the model name.
class TabState extends Models.keyValue ...
class TabList extends Models.collection ...
```

Take an actual scenario as an example, suppose we want to make a tab page function for the middle and back-end system, we need to build the following two models: 

- **`tabList` Model:** is a collection model, which stores the opened tabs. Each item in it includes fields such as name, icon, URL, order, etc...

- **`tabState` Model:** is a key-value pair model, which stores the tab display form, the currently activated tab id...

If `tabState` directly uses `tab` as the model name, it is difficult to name it accurately if `tabList` is needed. Moreover, naming with single nouns is also prone to conflicts: for example, in the view code related to the tab page, it is easy to use `tab` as the variable name, but since it is the same as the model name you have to change the name.

## Combine with the view frame

### Vue3

To be continued... 🐸

### React

To be continued... 🐸
