# Taro

:::tip 注意事项

Taro 框架中的 LocalStorage 出于抹平多端差异性的原因，针对原生 LocalStorage 进行了进一步的封装，但本质还是 LocalStorage。

[LocalStorage](https://developer.mozilla.org/docs/Web/API/Window/localStorage) 一般可以存储约 5MB 左右的数据。

LocalStorage 只能存储字符串。LocalStorage 驱动会对存入的数据进行 `JSON.stringify`，所以，请勿存入无法被正确 `JSON.stringify` 的对象 (如 `Set`、`Map` 等)。

:::

## 安装

```bash
npm i kurimudb-driver-taro@3
```

## 示例

```js {2,9}
import { Models } from "kurimudb";
import { TaroDriver } from "kurimudb-driver-taro";

class TaroState extends Models.keyValue {
  constructor() {
    super({
      name: "TaroState",
      type: "string",
      driver: TaroDriver,
    });
  }
}

export default new TaroState();
```
