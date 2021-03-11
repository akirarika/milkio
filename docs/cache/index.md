# 缓存驱动

Kurimudb 会将应用正在使用的数据，保留在**缓存层**。

这样的好处是，当你的应用在多处使用同一条数据时，Kurimudb 就不会傻乎乎地去持久化层 (如 LocalStorage、IndexedDB) 再读取一遍，而是直接返回此数据在缓存层中的引用：这意味着，**一条数据永远只会存在一份**。

::: details 关于 IndexedDB..
此外，缓存层也把使用 IndexedDB 时的部分异步操作，变成了同步操作：

当你对 Kurimudb 中的数据增删改时，**操作都是同步的：** 都是以同步的形式操作缓存层，在处理完成缓存层的变更后，Kurimudb 会先返回给你处理结果，再异步地保存到 IndexedDB 中。

当然啦，**查询操作还需要是异步的，** 因为在你调用函数之前，Kurimudb 无法确认你的数据是否已经被缓存到了缓存层。当缓存层不存在此数据时，Kurimudb 会去持久化层查询，在拿到结果后告诉你，顺便缓存到缓存层里一份。
:::

## Rxjs

Kurimudb 内置了 [Rxjs](https://rxjs.dev/) 的缓存层驱动，它会将存入的数据转为 [BehaviorSubject](https://rxjs.dev/guide/subject#behaviorsubject) 对象并存入缓存层，这样你就可以利用 Rxjs 强大的操作符来简化你应用的开发体验了。

Rxjs 驱动支持 `6.x` 和 `7.x` 版本的 Rxjs，你可以先安装：

```sh
npm i rxjs@6
# or yarn add rxjs@6
```

想使用 Rxjs 作为缓存层驱动，只需在模型的 `config` 中指定使用 `RxjsDriver`：

```js {12,14}
// /models/configModel.js

import { BehaviorSubject } from "rxjs";
import { Model, RxjsDriver } from "kurimudb";

export default new Model({
  config: {
    name: "config",
    type: "string",
    drivers: {
      // 这里告诉模型，使用 RxjsDriver 作为缓存层驱动
      cache: RxjsDriver,
      // 向驱动注入的依赖，传入 Rxjs 的 BehaviorSubject 对象
      cacheInject: BehaviorSubject,
      // 驱动需要依赖注入的目的是，让你可以自由控制驱动中所使用的依赖版本，
      // 驱动它不关心你到底在用什么，以及什么版本，只要传入的对象拥有驱动所需的方法即可。
      // 例如，无论是 rxj6 还是 rxjs7，是 jquery 还是 zepto，是 momentjs 还是 dayjs..
    },
  },
});
```

使用时，只需在变量名的后面加上 `$` 符号，就可以获得此变量的 [BehaviorSubject](https://rxjs.dev/guide/subject#behaviorsubject) 对象，你可以订阅此变量的更新、或使用 Rxjs 的各种操作符……

```js
import { local } from "kurimudb";

// 订阅这个变量..
local.data.say$.subscribe((val) => {
  console.log("what you want to say: " + val);
});

local.data.say = "hello world";

// 也可以用 rxjs 强大的操作符..
local.data.say$.pipe(...).subscribe((val) => { ... });
```

## 自制缓存驱动

目前，缓存层 Kurimudb 只拥有 Rxjs 一个驱动，但实现一个新驱动其实很简单，只要实现此接口即可：

```ts
import { CacheDriverInterface } from "kurimudb";
```

如果需要参考例子，可以[查看此处](https://github.com/akirarika/kurimudb/blob/master/kurimudb/drivers/RxjsDriver.ts)。

如果你实现了新的驱动，欢迎给在 Github 上给 Kurimudb 发 [PR](https://github.com/akirarika/kurimudb/)，让大家一起使用哦！
