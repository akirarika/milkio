# Taro

:::tip 注意事项

[Taro](https://taro.jd.com/) 是一个开放式跨端跨框架解决方案，它在 Web 端会使用 [LocalStorage](https://developer.mozilla.org/docs/Web/API/Window/localStorage)（约 5M），微信小程序端使用 [StorageSync Api](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.setStorageSync.html)（约 10M）。

Taro 驱动会对存入的数据进行 `JSON.stringify`，所以，请勿存入无法被正确 `JSON.stringify` 的对象 (如 `Set`、`Map` 等)。

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

> 📜 感谢 [polichan](https://github.com/polichan) 贡献的本驱动 [PR](https://github.com/akirarika/kurimudb/pull/12)。
