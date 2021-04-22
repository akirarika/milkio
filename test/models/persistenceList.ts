import { Models } from "../../kurimudb";
import { VueDriver } from "../../drivers/kurimudb-driver-vue";
import { LocalStorageDriver } from "../../drivers/kurimudb-driver-localstorage";

interface TestInterface {
  name?: string;
}

export default new (class PersistenceList extends Models.collection<
  TestInterface,
  LocalStorageDriver
> {
  constructor() {
    super({
      name: "persistenceList",
      type: "number",
      cacheDriver: VueDriver,
      persistenceDriver: LocalStorageDriver,
    });

    // this.seed(() => {
    //   this.insert({
    //     name: "你好世界",
    //   });
    // });
  }

  test() {
    this.data;
  }
})();
