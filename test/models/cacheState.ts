import { Models } from "../../kurimudb";
import { VueDriver } from "../../drivers/kurimudb-driver-vue";

interface TestInterface {
  name?: string;
}

export default new (class CacheState extends Models.keyValue<
  TestInterface,
  null
> {
  constructor() {
    super({
      name: "cacheState",
      type: "string",
      cacheDriver: VueDriver,
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
