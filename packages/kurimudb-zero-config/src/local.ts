import { SyncModels } from 'kurimudb';
import {
  LocalStorageDriver,
  localStorageDriverFactory,
} from 'kurimudb-driver-localstorage';

class Local extends SyncModels.keyValue<
  Record<string, any>,
  LocalStorageDriver
> {
  constructor() {
    super({
      name: 'local',
      driver: localStorageDriverFactory,
    });
  }
}

export const local = new Local();
