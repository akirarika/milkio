# LocalStorage

:::tip 注意事项

[LocalStorage](https://developer.mozilla.org/docs/Web/API/Window/localStorage) 一般可以存储约 5MB 左右的数据。

LocalStorage 只能存储字符串。LocalStorage 驱动会对存入的数据进行 `JSON.stringify`，所以，请勿存入无法被正确 `JSON.stringify` 的对象 (如 `Set`、`Map` 等)。

:::

## 安装

```bash
npm i kurimudb-driver-localstorage@4
```

## 示例

```js {2,7}
import { Models } from "kurimudb";
import { LocalStorageDriver } from "kurimudb-driver-localstorage";

export default new class LocalStorageState extends Models.keyValue {
  constructor() {
    super({
      driver: LocalStorageDriver,
    });
  }
}
```
