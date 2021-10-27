import { SyncModels } from 'kurimudb';

class Memory extends SyncModels.keyValue<Record<string, any>> {
  constructor() {
    super({
      name: 'memory',
    });
  }
}

export const memory = new Memory();
