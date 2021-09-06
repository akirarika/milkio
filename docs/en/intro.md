# Getting Started

## What is Kurimudb

Kurimudb is a progressive **Web Front-end local persistence library**. It can save your data to LocalStorage, IndexedDB, Cookie, and so on. Also, support subscribing to the mutating of data.

In addition to persistent data, Kurimudb can be [Model layer](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel#Components_of_MVVM_pattern) of your application if your want, then take the responsibility of state management in your application to make your app “Single source of truth” really.

Kurimudb's persistence feature is driver-oriented. It means you can replace the implementation without changing the code. We build several common drivers. If these are not for you, you can build your own driver.

## Quick Start

`kurimudb-zero-config` is the library that allows using Kurimudb with no config. Run the following config to install it:

```bash
npm i kurimudb-zero-config@4
```

### Local

By operating the `local` object, the data can be stored in LocalStorage. Even if the page is refreshed, the data will still be there!

```js
import { local } from "kurimudb-zero-config";

local.data.say = "hello world"; // writing..
let say = local.data.say; // reading..
delete local.data.say; // deleting..
"say" in local.data; // checking exist..
```

### Cookie

By operating the `cookie` object, the data can be stored in Cookie. The data stored in Cookie should be less as possible because all data in Cookie will send to the server-side automatically by the browser when making the request.

```js
import { cookie } from "kurimudb-zero-config";

cookie.data.say = "hello world"; // writing..
let say = cookie.data.say; // reading..
delete cookie.data.say; // deleting..
"say" in cookie.data; // checking exist..
```

### Memory

By operating the `memory` object, data can be stored in Memory. When the page is refreshed, the data will be cleared.

```js
import { memory } from "kurimudb-zero-config";

memory.data.say = "hello world"; // writing..
let say = memory.data.say; // reading..
delete memory.data.say; // deleting..
"say" in memory.data; // checking exist..
```

### Db

By operating the `db` object, the data can be stored in IndexedDB. IndexedDB can store JavaScript Objects such as File and Blob. Its maximum data capacity depends on the available hard disk size of the user's disk.  

It is worth noting that IndexedDB's API is asynchronous so that the return values of APIs related to `db` and reading are all [Promise object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise).

```js
import { db } from "kurimudb-zero-config";

db.data.say = "hello world"; // writing..
let say = await db.data.say; // reading, return value will be a Promise..
delete db.data.say; // deleting..
await db.has("say"); // checking exist, return value will be a Promise..
```

### Subscribing Data Mutation

Kurimudb also provides the feature of Subscribing Data Mutation. All things you need to do is adding `$` to the end of the value, then you can make something after it mutating.

```js
local.data.say$((val) => {
  console.log("what you want to say: " + val);
});
```

By default, the Closure will be executed immediately so that you can assign initial values to the reactive variables in your view conveniently. If you just want to execute it when the data changes, adding the `immediate` option.

```js {5}
local.data.say$(
  (val) => {
    console.log("what you want to say: " + val);
  },
  { immediate: false }
);
```

## Are You Ready?

We just get to the start point of using Kurimudb. Let's carry on to get know it better in next chapters! Be ready for it!
