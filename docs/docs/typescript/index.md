# TypeScript

Kurimudb 支持 TypeScript，除了为你带来代码提示以外，还可以依靠泛型，限制存入数据的格式和类型。

## 键值对模型

```ts
import { SyncModels } from 'kurimudb';
import {
  localStorageDriverFactory,
  LocalStorageDriver,
} from 'kurimudb-driver-localstorage';

interface ThemeInterface {
  color: string;
  fontSize: number;
  background: string;
}

export default new (class ThemeState extends SyncModels.keyValue<
  ThemeInterface, // 限制模型中可存入的数据的格式
  LocalStorageDriver // 若传入驱动的接口，可获得驱动专有函数的代码提示
> {
  constructor() {
    super({
      driver: localStorageDriverFactory,
    });
  }
})();
```

## 集合模型

```ts
import { SyncModels } from 'kurimudb';
import {
  localStorageDriverFactory,
  LocalStorageDriver,
} from 'kurimudb-driver-localstorage';

interface NoteItemInterface {
  title: string;
  content: string;
}

export default new (class NoteList extends SyncModels.collection<
  NoteItemInterface, // 限制集合模型中每个条目的格式
  LocalStorageDriver // 若传入驱动的接口，可获得驱动专有 Api 的代码提示
> {
  constructor() {
  constructor() {
    super({
      driver: localStorageDriverFactory,
    });
  }
  }
})();
```

## 存入额外数据

如果希望一个键值对模型，可以存入非约定键以外的数据，可以这么做：

```ts {11}
import { SyncModels } from 'kurimudb';
import {
  localStorageDriverFactory,
  LocalStorageDriver,
} from 'kurimudb-driver-localstorage';

interface ThemeInterface {
  color: string;
  fontSize: number;
  background: string;
  [other: string]: any;
}

export default new (class ThemeState extends SyncModels.keyValue<
  ThemeInterface, // 限制模型中可存入的数据的格式
  LocalStorageDriver // 若传入驱动的接口，可获得驱动专有函数的代码提示
> {
  constructor() {
    super({
      driver: localStorageDriverFactory,
    });
  }
})();
```
