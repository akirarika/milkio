# Taro

:::tip 注意事项

[Taro](https://developer.mozilla.org/docs/Web/API/Window/localStorage) 一般可以存储约 5MB 左右的数据。

Taro 只能存储字符串。Taro 驱动会对存入的数据进行 `JSON.stringify`，所以，请勿存入无法被正确 `JSON.stringify` 的对象 (如 `Set`、`Map` 等)。

:::

## 安装

```bash
npm i kurimudb-driver-taro@5
```

## 示例

```js {2,8}
import { SyncModels } from 'kurimudb';
import { TaroDriver } from 'kurimudb-driver-taro';

export default new (class TaroState extends SyncModels.keyValue {
  constructor() {
    super({
      name: 'TaroState',
      driver: TaroDriver,
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

> 📜 本驱动贡献者：[diy4869](https://github.com/diy4869)、[polichan](https://github.com/polichan)
