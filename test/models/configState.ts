import { DexieDriver } from "../../drivers/kurimudb-driver-dexie";
import { Models } from "../../kurimudb";
import migrations from "../migrations";

class ConfigState extends Models.keyValue<any> {
  // db = migrations;

  constructor() {
    super({
      name: "configState", // 模型名称，必须是唯一的
      type: "string", // 模型的主键类型
      // driver: DexieDriver,
    });

    this.seed(() => {
      this.data.foo = "你好";
      this.data.bar = "世界";
      this.data.baz = "！";
    });
  }
}

export default new ConfigState();
