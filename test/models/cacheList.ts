import { Models } from "../../kurimudb";
import { VueDriver } from "../../drivers/kurimudb-driver-vue";

interface TestInterface {
  name?: string;
}

export default new (class CacheList extends Models.collection<
  TestInterface,
  null
> {
  constructor() {
    super({
      name: "cacheList",
      type: "number",
      cacheDriver: VueDriver,
    });

    // this.seed(() => {
    //   console.warn(
    //     this.insert({
    //       name: "你好世界",
    //     })
    //   );
    // });
  }

  test() {
    this.data;
  }
})();
