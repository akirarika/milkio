---
sidebarDepth: 2
---

# Model

In the preamble, we introduced the basic usage and used the zero config library, `kurimudb-zero-config`. Normally, this would have already satisfied our needs.

However, if we are currently developing a complex single-page application, do we really want to save various kinds of data messily in a single object? This is not a good idea. 

This is the time for **Model feature** to make its grand debut！ 🎉

## Getting Started

Models are the core of saving and managing your data. The `memory`、`local`、`cookie` and `db` object we previously used in our zero config library are actually all models!

Before we continue, let's install Kurimudb: 

```bash
npm i kurimudb@4
```

## Creating the Model

Creating a model is actually very simple. You only need to inherit the Kurimudb's Model class.

```js
// Create a /models/configState.js file
// We can use it to store data related to user configuration.
import { Models } from "kurimudb";

export default new (class ConfigState extends Models.keyValue {})();
```

Just like this, you will have a `ConfigState` model. `ConfigState` is a **Key-Value Pair** model and using it is even simpler: 

```js
import configState from "./models/configState.js";

configState.data.say = "hello world"; // Writing..
console.log(configState.data.say); // Reading..
delete configState.data.say; // Deleting..
"say" in configState; // Determining whether it exists..
```

Through the constructor, you can self-define the options for the model:

```js
// /models/configState.js

import { Models } from "kurimudb";

export default new (class ConfigState extends Models.keyValue {
  constructor() {
    super({
      // The name of the model must be unique globally
      // If undefined, the class name of such classes will be used
      name: "OurModel",
      // The primary type of the model 
      // If undefined, the key-value pair model will use "string", while the set model will use "number"
      type: "number",
    });
  }
})();
```

## Model Methods

We can add **any methods** in the model class! Just like: 

```js
// /models/configState.js
import { Models } from "kurimudb";

class ConfigState extends Models.keyValue {
  // ..

  // Add a method
  setFoo(bar, foo) {
    // Various logic
    this.data.foo = foo;
    this.data.bar = bar;
  }

  // The method can also be asychronous
  async calcBar() {
    // ..
  }
}

export default new ConfigState();
```

We can directly call the methods when using it.

```js
import configState from "./models/configState.js";

configState.setFoo();
await configState.calcBar();
```

## Set Model

Previously, the models were all key-value values model, which acts like an object when used.

```js
configState.data.foo;
```

Sometimes, we may need a set. When adding new data, the primary key will auto increment, somewhat similar to an array:

```js
configState.data[700];
```

The primary use cases for set models are various lists, such as caching the list of videos, list of user drafts etc……Next, suppose we are currently developing a notes application, and we need to save the user's notes locally.

Let's create a  `NoteList` model:

```js {5}
// Create a /models/noteList.js file
import { Models } from "kurimudb";

// Inherit Models.collection to make it become a set model
export default new (class NoteList extends Models.collection {
  // ...
})();
```

When using, the primary key of data created through `insert` method will be auto incremented

```js
import noteList from "@/models/noteList";

const note1 = noteList.insert("This is the content of note 1");
const note2 = noteList.insert("This is the content of note 2");
console.log(noteList.data[1]); // echo "This is the content of note 1"
console.log(noteList.data[2]); // echo "This is the content of note 2"
```

You can also use the `all` function to retrieve all the data in this set model:

```js
noteList.all();
```

::: warning Tips:

1. The index of set model starts from 1 , which is different from arrays. It is designed in this manner to make it more compatible with IndexedDB, which also starts from 1.
2. When deleting any value in the set model, it will not cause any changes to the primary key of other values, which is different from how array works. That is, the primary key can be regarded as a constant.
3. For set models, the primary key data type must be a `number`.

:::

## Populating the Model

We may want to populate the model with some initial values. Example, we are currently developing an e-book application. When the user first utilize the application, we hope to set a default font size, theme, page flipping mode......

In this case, we can use the `seed` method in the constructor method to populate the model with initial values：

```js {8,9,10,11}
// /models/configState.js
import { Models } from "kurimudb";

class ConfigState extends Models.keyValue {
  constructor() {
    // ..

    this.seed(() => {
      this.data.foo = "foo";
      this.data.bar = "bar";
    });
  }
}
```

For **Key-Value Pair Model**，you can pass in an object to simplify the population of the model：

```js
this.seed({
  foo: "bar",
  baz: "qux",
});
// Equivalent to：
this.seed(() => {
  this.data.foo = "bar";
  this.data.baz = "qux";
});
```

For **Set Model**，you can pass in an array to simplify the population process：

```js
this.seed(["foo", "bar"]);
// Equivalent to：
this.seed(() => {
  this.insert("foo");
  this.insert("bar");
});
```

By default, everytime you run your web page, the data will be populated once.

If the model has the [persistence](/persistence) configuration set，then, the model will only be populated during the initial run of the web page by the user.

## Deep Clone

Before we explore further, let's discuss how copying in Javascript works: When you assign a object or array to another variable, you are actually **passing the reference of the original variable**. Please see the example below: ：

```js
let number1 = 965;
let number2 = number1;
number1 = 996;
console.log(number2);
// echo 965

let object1 = { foo: 965 };
let object2 = object1;
object1.foo = 996;
console.log(object2.foo);
// echo 996
```

This characteristic of Javascript will cause **side effects**, becoming the root causes of bugs. Therefore，to ensure that the data is immutable,we will perform a **deep clone** of the data when you store data through Kurimudb. When reading data, it is completely independent of the original value.

For **plain object** ，there is nothing to worry about deep cloning. However, for other objects, such as `new Set(...)` 或 `new Blob(...)`，as we can only deep clone **enumerable properties**，deep clone will result in data loss.

Therefore, we provided a whitelist. If your data or internals contains such objects, then Kurimudb would not deep clone them.

```yaml
- Boolean
- String
- Date
- RegExp
- Blob
- File
- FileList
- ArrayBuffer
- DataView
- Uint8ClampedArray
- ImageData
- Map
- Set
- Symbol
- HTMLDivElement
# Determined through `yourObj.constructor.name`
```

If you wish to overwrite this whitelist, you can:

```js {8}
import { Models } from "kurimudb";

class ConfigState extends Models.keyValue {
  constructor() {
    super({
      intrinsicTypes: ["File", "FileList"],
    });
  }
}
```
If you want to deep clone all objects, you can directly pass in an empty array:

```js
intrinsicTypes: [];
```
If you do not want to deep clone any of the objects, you can pass in `false`: 

```js
intrinsicTypes: false;
```
If you wish to manually perform deep clone, you can use the `deepClone` function of the model object.

```js
yourModel.deepClone(yourOldObject);
```

## Storage Class API

You can also use similar [Storage](https://developer.mozilla.org/docs/Web/API/Storage) API to insert, delete, modify data items.

```js
local.setItem("say", "hello"); // create it
let say = local.getItem("say"); // retrieve it
local.removeItem("say"); // delete it
local.subscribeItem("say", (val) => { ... }); // subscribe it
```

> 📜 This feature requries Version (^4.0.0).
