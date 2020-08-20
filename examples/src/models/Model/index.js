import query from "./query";
import migration from "./migration";
import seed from "./seed";
import method from "./method";

export default class ModexieConnection {
  /**
   * Modexie
   * @param {Dexie} dexieConnection
   * @param {Array} models
   */
  constructor(dexieConnection, models, config = {}) {
    const that = this;
    this.con = dexieConnection;
    this.models = {};

    // 制作并挂载 models 对象
    models.forEach((model) => {
      this.models[model.name] = {
        connection: that,
        table() {
          return dexieConnection[this.name];
        },
        ...migration,
        ...query,
        ...method,
        ...model,
      };

      this.models[model.name].migration();
    });

    seed(this);
  }
}
