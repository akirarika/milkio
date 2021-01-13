# 介绍

Kurimudb 是一款用于 [渐进式 Web 应用 (PWA)](https://developer.mozilla.org/docs/Web/Progressive_web_apps) 的**数据仓库**。

在渐进式 Web 应用中，我们希望缓存用户生成的数据，而不仅仅是 Web 页面本身。Kurimudb 可以把数据持久化，当用户离线或下次访问时，这些数据依然可用。

Kurimudb 也可以充当 [状态管理器](/state/)。渐进式 Web 应用中由于存在大量下次访问时仍需复原的状态，同时状态间互相依赖耦合，Kurimudb 可能比 Vuex 更适合当作状态管理器使用。

[点此阅读文档](https://akirarika.github.io/kurimudb/)

```javascript
import configModel from "models/configModel"

// create or update
configModel.data.token = "!dr0wssaP"
// read
console.log(await configModel.data.token)
// delete
delete configModel.data.token
// watching
configModel.data.token$.subscribe((token) => console.log(token))
```

[点此阅读文档](https://akirarika.github.io/kurimudb/)
