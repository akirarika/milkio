import { AsyncModels } from 'kurimudb';
import { DexieDriver, dexieDriverFactory } from 'kurimudb-driver-dexie';
import migrations from './_migrations';

class DB extends AsyncModels.keyValue<Record<string, any>, DexieDriver> {
  constructor() {
    super({
      name: 'db',
      driver: dexieDriverFactory,
      db: migrations,
    });
  }
}

export const db = new DB();
