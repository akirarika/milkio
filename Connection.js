import Model from "./Model";

export default class ModexieConnection {
  /**
   * Modexie
   * @param {Dexie} dexieConnection
   * @param {Array} models
   */
  constructor(dexieConnection, models) {
    const that = this;
    this.con = dexieConnection;
    this.models = {};

    models.forEach((model) => {
      this.models[model.name] = {
        connection: that,
        table() {
          return that.con[this.name];
        },
        ...Model,
        ...model,
      };
    });

    for (const modelName in this.models) {
      const model = this.models[modelName];
      // 数据库打开前
      this.migrations(model);
    }

    for (const modelName in this.models) {
      const model = this.models[modelName];
      // 数据库打开中
      this.attributes(model);
      this.seeding(model);
      this.hooking(model);
    }
  }

  migrations(model) {
    if (!model.migrations) {
      console.error(
        `${model.name} 模型必须包含 migrations 函数且至少迁移一个版本`
      );
      return;
    }

    for (const version in model.migrations) {
      const obj = {};

      obj[model.name] = model.migrations[version];
      this.con.version(version).stores(obj);
    }
  }

  attributes(model) {
    model.attribute();
  }

  seeding(model) {
    if (localStorage.getItem("__modexie:seeded")) return;
    else localStorage.setItem("__modexie:seeded", 1);
    if (!model.seeding) return;

    model.seeding(this.con[model.name]);
  }

  hooking(model) {
    model
      .table()
      .hook("updating", (modifications, primKey, obj, transaction) => {
        for (let i = 0; i < model.watchObject.length; i++) {
          const primary = model.watchObject[i].primary;
          const array = model.watchObject[i].array;

          for (let j = 0; j < array.length; j++) {
            if (array[j][primary] === obj[primary])
              array.splice(j, 1, {
                ...array[j],
                ...modifications,
              });
          }
        }
      });

    model.table().hook("deleting", function(primKey, obj, transaction) {
      if (!obj) return;
      for (let i = 0; i < model.watchObject.length; i++) {
        const primary = model.watchObject[i].primary;
        const array = model.watchObject[i].array;
        const index = array.findIndex((item) => item[primary] === obj[primary]);

        if (!(0 > index)) array.splice(index, 1);
      }
    });

    model.table().hook("creating", function(primKey, obj, transaction) {
      if (!obj) return;

      for (let i = 0; i < model.watchObject.length; i++) {
        const primary = model.watchObject[i].primary;
        const array = model.watchObject[i].array;
        const creating = model.watchObject[i].creating;

        if (!creating) continue;

        if ("function" !== typeof creating)
          throw `若使用 creating 属性，则其必须是一个函数`;

        creating(obj);
      }
    });
  }
}
