# Taro

> 📜 本驱动正在努力完善中，敬请期待。感谢 [polichan](https://github.com/polichan) 贡献的本驱动 [PR](https://github.com/akirarika/kurimudb/pull/12)。

:::tip 注意事项

[Taro](https://taro.jd.com/) 是一个开放式跨端跨框架解决方案，它在 Web 端会使用 [LocalStorage](https://developer.mozilla.org/docs/Web/API/Window/localStorage)（约 5M），微信小程序端使用 [StorageSync Api](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.setStorageSync.html)（约 10M）。

Taro 驱动会对存入的数据进行 `JSON.stringify`，所以，请勿存入无法被正确 `JSON.stringify` 的对象 (如 `Set`、`Map` 等)。

:::

## 安装

使用 npm 或者 yarn 进行安装

```bash
npm i kurimudb-driver-taro -S

yarn add kurimudb-driver-taro
```

## 示例

```js
import { View, Text } from '@tarojs/components'
import { useEffect } from 'react'
import { SyncModels } from 'kurimudb'
import { TaroDriver, taroDriverFactory } from 'kurimudb-driver-taro'

class Model extends SyncModels.collection<
  string,
  TaroDriver
> {
  constructor () {
    super({
      name: 'model',
      driver: taroDriverFactory,
    })
  }
}

const model = new Modal()

export default function Index () {
  useEffect(() => {
    model.setItem('key', 'value') // set 值
    model.getItem('key')) // 获取值
  }, [])

  return (
    <View className='index'>
      <Text>Hello</Text>
    </View>
  )
}

```

> 📜 感谢 [polichan](https://github.com/polichan) 贡献的本驱动 [PR](https://github.com/akirarika/kurimudb/pull/12)。
