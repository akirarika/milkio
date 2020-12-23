# 介绍

Kurimudb 是一款用于 [渐进式 Web 应用 (PWA)](https://developer.mozilla.org/docs/Web/Progressive_web_apps) 的**数据仓库**。

在渐进式 Web 应用中，我们希望缓存用户生成的数据，而不仅仅是 Web 页面本身。Kurimudb 可以把数据持久化，当用户离线或下次访问时，这些数据依然可用。

Kurimudb 也可以充当 [状态管理器](/state/)。渐进式 Web 应用中由于存在大量下次访问时仍需复原的状态，同时状态间互相依赖耦合，Kurimudb 可能比 Vuex 更适合当作状态管理器使用。

## 用法

Kurimudb 的语法非常简单，就像操作一个普通的 Javascript 对象一样。但背后，你的数据已经被持久化到了本地，还可以订阅它未来的更新。

``` js
import configModel from "models/configModel"
// create or update
configModel.data.token = "!dr0wssaP"
// read
console.log(await configModel.data.token)
// delete
delete configModel.data.token
```

除了像对象一样存储键值对，Kurimudb 还可以存储像数组一样的集合，不过下标是从 `1` 开始。

```js
import bookModel from "models/bookModel"

// 通过 `new` 操作符来创建数据，就像数组的 `[].push(...)`
const book1 = await new bookModel.data({
    name: "Alice in Wonderland",
    author: "Lewis Carroll",
})
const book2 = await new bookModel.data({
    name: "Vingt mille lieues sous les mers",
    author: "Jules Gabriel Verne",
})

// read
console.log(book1.id) // echo 1
console.log(book2.id) // echo 2

await bookModel.data[1].name // echo "Alice in Wonderland"
await bookModel.data[2].name // echo "Vingt mille lieues sous les mers"
```

## 状态管理

Kurimudb 也可以用来管理状态，且允许你将状态持久化，即使用户刷新网页状态也依然保留。

同时，Kurimudb 中的每条数据都可以转换为 RxJS 的 [BehaviorSubject 对象](https://rxjs.dev/guide/subject#behaviorsubject)，只要在要读取的值后加上 `$` 符号即可。可以调用 `subscribe` 函数来获取此值及后续的变更，也可以利用 RxJS 强大的操作符来组合你的状态。

```js
import stateModel from "models/stateModel"

stateModel.data.token = "!dr0wssaP"
// subscribe to updates for this data (Powered by ReactiveX)
stateModel.data.token$.subscribe((token) => {
    console.log(token)
})

setTimeout(() => stateModel.data.token = "Passw0rd!", 1000);
```