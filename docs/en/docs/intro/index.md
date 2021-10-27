# Getting Started

## Introduction to Kurimudb

Kurimudb is a progressive **Web front-end local persistence library**. It can save your data to LocalStorage, IndexedDB, Cookie, and elsewhere. Also, support subscribing to the mutating of data.

In addition to persistent data, Kurimudb can be [Model layer](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel#Components_of_MVVM_pattern) of your application if your want, then take the responsibility of state management in your application (i.e., Vuex, Redux and Mobx) to make your app “single source of truth” really.

Kurimudb's persistence feature is driver-oriented. It means you can replace the implementation without changing the code. We build several common drivers. If these are not for you, you can build your own driver.

## Getting Started

`kurimudb-zero-config` is Kurimudb's zero configuration package, execute the following command to install it:

```bash
npm i kurimudb-zero-config@5
```

### Local

By operating the `local` object, the data can be stored in LocalStorage. Even if the page is refreshed, the data will still be there! It can store about 5M data in LocalStorage.

```js
import { local } from "kurimudb-zero-config";

local.data.say = "hello world"; // writing..
let say = local.data.say; // reading..
delete local.data.say; // deleting..
if ("say" in local.data) { ... } // checking existence..
```

### Cookie

By operating the `cookie` object, the data can be stored in Cookie. The data stored in Cookie should be less as possible because all data in Cookie will send to the server-side automatically by the browser when making the request.

```js
import { cookie } from "kurimudb-zero-config";

cookie.data.say = "hello world"; // writing..
let say = cookie.data.say; // reading..
delete cookie.data.say; // deleting..
if ("say" in cookie.data) { ... } // checking existence..
```

### Memory

By operating the `memory` object, data can be stored in Memory. When the page is refreshed, the data will be cleared.

```js
import { memory } from "kurimudb-zero-config";

memory.data.say = "hello world"; // writing..
let say = memory.data.say; // reading..
delete memory.data.say; // deleting..
if ("say" in memory.data) { ... } // checking existence..
```

### Db

By operating the `db` object, the data can be stored in IndexedDB. IndexedDB can store JavaScript Objects such as File and Blob. Its maximum data capacity depends on the available hard disk size of the user's disk.

::: Warning Tips:

It is worth noting that IndexedDB's API is asynchronous so that the return values of APIs related to `db` and reading are all [Promise Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise).

:::

```js
import { db } from "kurimudb-zero-config";

db.setItem("say", "hello world"); // writing..
let say = await db.getItem("say"); // reading, return value will be a Promise Object..
await db.removeItem("say"); // deleting..
if (await db.hasItem("say")) { ... } // checking existence..
```

### Subscribing Data Mutation

Kurimudb also provides the feature of Subscribing Data Mutation. All things you need to do is adding `$` to the end of the value, then you can make something after it mutates.

```js
local.data.say$((val) => {
  console.log('what you want to say: ' + val);
});
```

Or use the **automatic subscription function**, when any of the values used in the closure is changed, the subscription will be triggered, and the closure will be executed again:

```js
import { auto$ } from 'kurimudb-zero-config';

auto$(() => {
  console.log(configState.data.foo);
  console.log(configState.data.bar);
});
```

Regarding subscriptions, there are more advanced usages! Please read the [Subscription Changes](/en/docs/subscribe/) chapter.

## Are You Ready?

We just get to the start point of using Kurimudb. Let's carry on to get know it better in next chapters!
