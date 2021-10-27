import { SyncModels } from 'kurimudb';
import { CookieDriver, cookieDriverFactory } from 'kurimudb-driver-cookie';

class Cookie extends SyncModels.keyValue<Record<string, any>, CookieDriver> {
  constructor() {
    super({
      name: 'cookie',
      driver: cookieDriverFactory,
    });
  }
}

export const cookie = new Cookie();
