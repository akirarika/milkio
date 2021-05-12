# 持久化

你可能已经发现，前文中，我们向模型中存入的数据，在**页面刷新后就会丢失**。

别担心，这是因为我们没有配置存储驱动的原因。存储驱动决定了我们将数据存储在哪里，不同的驱动在增删改查的用法上，都是一致的，只是有些驱动可能会为你提供一些额外的专有 Api。

## 使用驱动

下面让我们将为模型添加 `LocalStorage` 驱动，只需要引入驱动，并在模型中配置 `driver` 即可。

```js {4,9}
// /models/configState.js

import { Models } from "kurimudb";
import { LocalStorageDriver } from "kurimudb-driver-localstorage";

export default new class ConfigState extends Models.keyValue {
  constructor() {
    super({
      driver: LocalStorageDriver,
    });
  }
}
```

现在再试试看，数据会不会丢失？后面的驱动章节，我们将会为你详细介绍 Kurimudb 提供的各种驱动，和教你如何编写自己的驱动，来完全掌控数据存储的逻辑。
