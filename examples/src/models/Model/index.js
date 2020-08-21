import query from "./query";
import seed from "./seed";
import method from "./method";
import relationship from "./relationship";
import hook from "./hook";

export default class ModexieConnection {
  /**
   * Modexie
   * @param {Dexie} dexieConnection
   * @param {Array} models
   */
  constructor(dexieConnection, migrations, models, config = {}) {
    const that = this;
    this.con = dexieConnection;
    this.models = {};

    migrations(dexieConnection);

    // 制作并挂载 models 对象
    models.forEach((model) => {
      this.models[model.name] = {
        connection: that,
        table() {
          return dexieConnection[this.name];
        },
        ...query,
        ...relationship,
        ...method,
        ...hook,
        ...model,
      };

      this.models[model.name].hook();
    });

    seed(this);
  }
}
