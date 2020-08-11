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

    this.seeding();

    for (const modelName in this.models) {
      const model = this.models[modelName];
      // 数据库打开中
      this.attributes(model);
      this.hooking(model);
    }
  }

  migrations(model) {
    if (!model.migrations) {
      console.error(
        `the "${model.name}" model must contain the migrations function and migrate at least one version`
      );
      return;
    }

    for (const version in model.migrations) {
      const store = (str) => {
        const obj = {};
        obj[model.name] = str;
        this.con.version(version).stores(obj);
      };

      model.migrations[version](store);
    }
  }

  attributes(model) {
    model.attribute();
  }

  seeding() {
    if (localStorage.getItem("Brunettes_are_full_of_electricity")) return;
    else localStorage.setItem("Brunettes_are_full_of_electricity", 1);

    for (const modelName in this.models) {
      const model = this.models[modelName];

      try {
        model.seeding(this.con[model.name]);
      } catch (error) {
        console.log(error);
      }
    }
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
          throw `if you use the creating attribute, it must be a function`;

        creating(obj);
      }
    });
  }
}
