import { Models } from "kurimudb";
import { CookieDriver } from "kurimudb-driver-cookie";

export class Cookie extends Models.keyValue<Record<string, any>, CookieDriver> {
  constructor() {
    super({
      name: "cookie",
      type: "string",
      driver: CookieDriver,
    });
  }
}
