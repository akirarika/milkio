# TypeScript

Kurimudb supports TypeScript. In addition to bringing you code hints, you can also rely on generics to limit the format and type of data stored.

## key-value model

```ts {11,12}
import { Models } from 'kurimudb';
import { LocalStorageDriver } from 'kurimudb-driver-localstorage';

interface ThemeInterface {
  color: string;
  fontSize: number;
  background: string;
}

export default new (class ThemeState extends Models.keyValue<
  ThemeInterface, // Restrict the data format of the model, namely the form of `themeState.data`
  LocalStorageDriver // If you pass in the driver, you can get the code hint of the driver's proprietary Api
> {
  constructor() {
    super({
      driver: LocalStorageDriver,
    });
  }
})();
```

## Collection model

```ts {10,11}
import { Models } from 'kurimudb';
import { LocalStorageDriver } from 'kurimudb-driver-localstorage';

interface NoteItemInterface {
  title: string;
  content: string;
}

export default new (class NoteList extends Models.collection<
  NoteItemInterface, // Restrict the format of each sub-item in the collection model
  LocalStorageDriver // If you pass in the driver, you can get the code hint of the driver's proprietary Api
> {
  constructor() {
    super({
      driver: LocalStorageDriver,
    });
  }
})();
```
