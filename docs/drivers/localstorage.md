# LocalStorage

:::tip 注意事项

[LocalStorage](https://developer.mozilla.org/docs/Web/API/Window/localStorage) 一般可以存储约 5MB 左右的数据。

LocalStorage 只能存储字符串。LocalStorage 驱动会对存入的数据进行 `JSON.stringify`，所以，请勿存入无法被正确 `JSON.stringify` 的对象 (如 `Set`、`Map` 等)。

:::

## 安装

```bash
npm i kurimudb-driver-localstorage@5
```

## 示例

```js {2,8}
import { SyncModels } from 'kurimudb';
import { localStorageDriverFactory } from 'kurimudb-driver-localstorage';

export default new (class LocalStorageState extends SyncModels.keyValue {
  constructor() {
    super({
      name: 'LocalStorageState',
      driver: localStorageDriverFactory,
    });
  }
})();
```

## all (集合模型可用)

获取此模型已存入的全部数据，按插入顺序排序，返回值为 [KMap 对象](/others/#KMap)。

```js
yourModel.storage.all();
```

## getLength (集合模型可用)

获取已存入数据的条数，返回值为 `number`。

```js
yourModel.storage.getLength();
```

## getKeys (集合模型可用)

获取已存入数据的主键，按插入顺序排序，返回值为 `Array<string>`。

```js
yourModel.storage.getKeys();
```
