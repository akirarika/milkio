# Cookie

:::tip 注意事项

[Cookie](https://developer.mozilla.org/docs/Web/HTTP/Cookies) 中的数据，一般会自动随请求发送给服务端。由于每次请求都会携带所有 Cookie，其中存储的数据应当尽量的少。一般来说，Cookie 最多可以存储 4KB 的数据。

Cookie 驱动是没有命名空间的，不同模型之间的同名值，会互相覆盖。

Cookie 只能存储字符串。Cookie 驱动会对存入的数据进行 `JSON.stringify`，所以，请勿存入无法被正确 `JSON.stringify` 的对象 (如 `Set`、`Map` 等)。

:::

## 安装

```bash
npm i kurimudb-driver-cookie@3
```

## 示例

```js {2,9}
import { Models } from "kurimudb";
import { CookieDriver } from "kurimudb-driver-cookie";

class CookieState extends Models.keyValue {
  constructor() {
    super({
      name: "cookieState",
      type: "string",
      driver: CookieDriver,
    });
  }
}

export default new CookieState();
```

## 获取全部 Cookie

```js
cookieState.storage;
```
