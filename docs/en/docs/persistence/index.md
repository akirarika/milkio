# Persistence

You may have discovered that the data we saved to the model, mentioned in the previous article, **will be lost after the page is refreshed**.

Don't worry, this is because we did not configure the storage driver. The storage driver determines where we store the data. Different drivers have the same usage in addition, deletion, modification, and checking, but some drivers may provide you with some additional proprietary APIs.

## Use Driver

Let's add the driver `LocalStorage` to the model. Install the driver as following shows:

```sh
npm i kurimudb-driver-localstorage@5
```

Just declare the driver we want to use in the model:

```js {4,9}
// /models/configState.js

import { SyncModels } from 'kurimudb';
import { localStorageDriverFactory } from 'kurimudb-driver-localstorage';

export default new (class ConfigState extends SyncModels.keyValue {
  constructor() {
    super({
      driver: localStorageDriverFactory,
    });
  }
})();
```

Try again now, the data should not be lost now. In the following driver chapters, we will give you a detailed introduction to the various drivers provided by Kurimudb and teach you how to write your own drivers to fully control the logic of data storage.