import { createClient } from "client";

export default {
  client: () => createClient({ baseUrl: "http://localhost:9000/", memoryStorage: true }),
  async onBootstrap() {
    // ..
  },
  async onBefore() {
    return {
      // The content returned here will be mixed into the test object
    }
  }
}