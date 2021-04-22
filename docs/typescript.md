# TypeScript

Kurimudb 支持 TypeScript，除了为你带来代码提示以外，还可以依靠泛型，限制存入数据的格式和类型。

## 键值对模型

```ts {11,12}
import { Models } from "kurimudb";
import { LocalStorageDriver } from "kurimudb-driver-localstorage";

interface ThemeInterface {
  color: string;
  fontSize: number;
  background: string;
}

class ThemeState extends Models.keyValue<
  ThemeInterface, // 限制模型的数据格式，即 `themeState.data` 的格式
  LocalStorageDriver // 若传入驱动，可获得驱动专有 Api 的代码提示
> {
  constructor() {
    super({
      name: "themeState",
      type: "string",
      driver: LocalStorageDriver,
    });
  }
}

export default new ThemeState();
```

## 集合模型

```ts {10,11}
import { Models } from "kurimudb";
import { LocalStorageDriver } from "kurimudb-driver-localstorage";

interface NoteItemInterface {
  title: string;
  content: string;
}

class NoteList extends Models.collection<
  NoteItemInterface, // 限制集合模型中，每个子项目的格式
  LocalStorageDriver // 若传入驱动，可获得驱动专有 Api 的代码提示
> {
  constructor() {
    super({
      name: "noteList",
      type: "number",
      driver: LocalStorageDriver,
    });
  }
}

export default new NoteList();
```
