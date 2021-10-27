# Cookie

:::tip 注意事项

[Cookie](https://developer.mozilla.org/docs/Web/HTTP/Cookies) 中的数据，一般会自动随请求发送给服务端。由于每次请求都会携带所有 Cookie，其中存储的数据应当尽量的少。一般来说，Cookie 最多可以存储 4KB 的数据。

为了兼容服务端读取，Cookie 驱动是没有命名空间的，不同模型之间的同名值，会互相覆盖。

Cookie 只能存储字符串。**如果存入数组或对象**，Cookie 驱动会将其序列化为 `JSON`。

当你调用 Kurimudb 的方法来操作 Cookie 时，Cookie 的路径为 `/`，有效期为 3 年以上。如果需要使用非默认值，请使用本驱动提供的 `set`、`remove` 方法。

:::

## 安装

```bash
npm i kurimudb-driver-cookie@5
```

## 示例

```js {2,8}
import { SyncModels } from 'kurimudb';
import { CookieDriver } from 'kurimudb-driver-cookie';

export default new (class CookieState extends SyncModels.keyValue {
  constructor() {
    super({
      name: 'CookieState',
      driver: CookieDriver,
    });
  }
})();
```

## set

设置 Cookie，若 `value` 为对象或数组，将序列化为 `JSON`。`options` 见 [CookieAttributes](https://github.com/akirarika/kurimudb/blob/master/packages/kurimudb-driver-cookie/src/cookie-attributes.interface.ts)。

```js
yourModel.storage.set(key: string, value: unknown, options?: CookieAttributes);
```

## get

获取 Cookie，若 `value` 可能为 JSON 对象或数组，会先尝试将其反序列化为 JavaScript 对象或数组，如果失败，则返回原字符串。

```js
yourModel.storage.get(key: string);
```

## remove

移除 Cookie，若设置 Cookie 时，`options` 指定了 `path` 和 `domain`，则调用此函数时需要传入这些参数与设置时相同的 `options`。

```js
yourModel.storage.remove(key: string, options?: CookieAttributes);
```
