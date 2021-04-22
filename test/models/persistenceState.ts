import { Models } from "../../kurimudb";
import { VueDriver } from "../../drivers/kurimudb-driver-vue";
import { LocalStorageDriver } from "../../drivers/kurimudb-driver-localstorage";

interface TestInterface {
  name?: string;
  test: boolean;
}

export default new (class PersistenceState extends Models.keyValue<
  TestInterface,
  LocalStorageDriver
> {
  constructor() {
    super({
      name: "persistenceState",
      type: "string",
      cacheDriver: VueDriver,
      persistenceDriver: LocalStorageDriver,
    });

    // this.seed(() => {
    //   this.data.hello = {
    //     name: "你好世界",
    //   };
    //   console.warn(this.data.hello);
    // });
  }

  test() {
    this.data;
  }
})();
