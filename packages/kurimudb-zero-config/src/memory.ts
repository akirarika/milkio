import { Models } from "kurimudb";

export class Memory extends Models.keyValue<Record<string, any>, null> {
  constructor() {
    super({
      name: "memory",
      type: "string",
    });
  }
}
