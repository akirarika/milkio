# TypeScript

Kurimudb supports TypeScript. In addition to bringing you code hints, you can also rely on generics to limit the format and type of data stored.

## Key-value Model

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
  ThemeInterface, // restrict the data format of the model, namely the form of `themeState.data`
  LocalStorageDriver // if you pass in the driver, you can get the code hint of the driver's proprietary Api
> {
  constructor() {
    super({
      driver: localStorageDriverFactory,
    });
  }
})();
```

## Collection Model

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
  NoteItemInterface, // restrict the format of each sub-item in the collection model
  LocalStorageDriver // if you pass in the driver, you can get the code hint of the driver's proprietary Api
> {
  constructor() {
    super({
      driver: localStorageDriverFactory,
    });
  }
})();
```

## Store Additional Data

If you want a key-value pair model that can store data other than non-conventional keys, you can write like this:

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
  ThemeInterface, // restrict the format of each sub-item in the collection model
  LocalStorageDriver // if you pass in the driver, you can get the code hint of the driver's proprietary Api
> {
  constructor() {
    super({
      driver: localStorageDriverFactory,
    });
  }
})();
```
