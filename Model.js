const Model = {
  awaitQueues: [], // 要执行的异步函数队列数组，在调用 get 函数后会顺序执行

  relationshipArray: [], // 所需关联查询的数组，每次 query 后会清空

  watchObject: [], // 待监听的对象

  with(relationship) {
    if (Array != relationship.constructor) relationship = [relationship];
    this.relationshipArray = relationship;

    return this;
  },

  async query(name, ...args) {
    // 执行查询，为了方便处理查询结果无论是一条还是多条都会是存为数组 `resultsArr`
    const results = await this.queries[name](this.table(), ...args);
    if (!results) return null;

    const isResultsArr = Array != results.constructor;
    const resultsArr = isResultsArr ? [results] : results;

    await this._loadRelationships(resultsArr, this.relationshipArray);

    this.isWatch = false;
    this.relationshipArray = [];

    return results;
  },

  async watch(
    resultsArr,
    { creating = false, primary = "id" } = { creating: false, primary: "id" }
  ) {
    return this.watchObject.push({
      array: resultsArr,
      primary,
      creating,
    });
  },

  async unwatch(index) {
    return (this.watchObject[index] = void 0);
  },

  async _loadRelationships(resultsArr, relationshipArray) {
    const whereIn = (model, key, resultKey) => {
      return model
        .table()
        .where(key)
        .anyOf(resultsArr.map((result) => result[resultKey]));
    };

    // 处理关联
    for (const r of relationshipArray) {
      const { mount, array, defaults } = this.relationships[r]({
        models: this.connection.models,
        whereIn,
        resultsArr,
      });

      for (let i = 0; i < resultsArr.length; i++) {
        const relationshipArr = await array;
        resultsArr[i][r] = void 0 === defaults ? null : defaults;

        for (let j = 0; j < relationshipArr.length; j++) {
          if (mount(resultsArr[i], relationshipArr[j]))
            resultsArr[i][r] = relationshipArr[j];
        }
      }
    }
  },

  async method(name, ...args) {
    const methods = {
      add(table, arr) {
        if (Array != arr.constructor) arr = [arr];
        return table.bulkAdd(arr);
      },
      delete(table, arr) {
        if (Array != arr.constructor) arr = [arr];
        return table.bulkDelete(arr);
      },
      put(table, arr) {
        if (Array != arr.constructor) arr = [arr];
        return table.bulkPut(arr);
      },
    };

    if (name in methods) return methods[name](this.table(), ...args);
    return await this.methods[name](this.table(), ...args);
  },

  attribute() {
    const attribute = (obj = {}) => {
      const attributes = this.attributes;

      for (const key in attributes) {
        if ("function" === typeof attributes[key])
          obj[key] = attributes[key](this[key]);
        else if (!(key in obj)) obj[key] = attributes[key];
      }

      return obj;
    };

    this.table().hook("creating", function(primKey, obj, transaction) {
      attribute(obj);
    });

    this.table().hook("updating", function(
      modifications,
      primKey,
      obj,
      transaction
    ) {
      return attribute();
    });
  },
};

export default Model;
