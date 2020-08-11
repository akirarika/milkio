const Model = {
  awaitQueues: [], // 要执行的异步函数队列数组，在调用 get 函数后会顺序执行

  relationshipArray: [], // 所需关联查询的数组，每次 query 后会清空

  watchObject: [], // 待监听的对象

  with(relationship) {
    this.relationshipArray = relationship;

    return this;
  },

  async query(name, ...args) {
    // 执行查询，为了方便处理查询结果无论是一条还是多条都会是存为数组 `resultsArr`
    const results = await this.queries[name](this.table(), ...args);
    if (!results) return null;

    const isResultsArr = Array != results.constructor;
    const resultsArr = isResultsArr ? [results] : results;

    await this.loadRelationships(resultsArr, this.relationshipArray);

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

  async loadRelationships(
    resArr,
    relationshipArray,
    currentRelationshipIndex = 0
  ) {
    if (relationshipArray.length <= currentRelationshipIndex) return;

    const rel = relationshipArray[currentRelationshipIndex];

    await this.relationships[rel]({
      hasOne: async ({
        model,
        foreignKey = `${this.name}_id`,
        localKey = "id",
        defaultValue = {},
      }) => {
        const childModel = this.connection.models[model];
        const relResArr = await childModel
          .table()
          .where(foreignKey)
          .anyOf(resArr.map((r) => r[localKey]))
          .toArray();

        for (const parentModel of resArr) {
          parentModel[model] =
            relResArr.find((m) => m[foreignKey] === parentModel[localKey]) ||
            defaultValue;
        }
      },

      belongsTo: async ({
        model,
        foreignKey = void 0,
        localKey = "id",
        defaultValue = {},
      }) => {
        const childModel = this.connection.models[model];

        if (void 0 === foreignKey) foreignKey = `${childModel.name}_id`;

        const relResArr = await childModel
          .table()
          .where(localKey)
          .anyOf(resArr.map((r) => r[foreignKey]))
          .toArray();

        for (const parentModel of resArr) {
          parentModel[model] =
            relResArr.find((m) => m[localKey] === parentModel[foreignKey]) ||
            defaultValue;
        }
      },

      hasMany: async ({
        model,
        foreignKey = `${this.name}_id`,
        localKey = "id",
        defaultValue = [],
      }) => {
        const childModel = this.connection.models[model];
        const relResArr = await childModel
          .table()
          .where(foreignKey)
          .anyOf(resArr.map((r) => r[localKey]))
          .toArray();

        for (const parentModel of resArr) {
          parentModel[model] =
            relResArr.filter((m) => m[foreignKey] === parentModel[localKey]) ||
            defaultValue;
        }
      },

      belongsToMany: async ({
        model,
        foreignKey = void 0,
        localKey = "id",
        defaultValue = [],
      }) => {
        const childModel = this.connection.models[model];

        if (void 0 === foreignKey) foreignKey = `${childModel.name}_id`;

        const anyOfArr = [];
        resArr.forEach((r) => anyOfArr.push(...r[foreignKey]));

        const relResArr = await childModel
          .table()
          .where(localKey)
          .anyOf(anyOfArr)
          .toArray();

        console.log(relResArr);

        for (const parentModel of resArr) {
          parentModel[model] =
            relResArr.filter(
              (m) => -1 < parentModel[foreignKey].indexOf(m[localKey])
            ) || defaultValue;
        }
      },
    });

    return this.loadRelationships(
      resArr,
      relationshipArray,
      ++currentRelationshipIndex
    );
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

    this.table().hook("creating", function (primKey, obj, transaction) {
      attribute(obj);
    });

    this.table().hook("updating", function (
      modifications,
      primKey,
      obj,
      transaction
    ) {
      return attribute(obj);
    });
  },
};

export default Model;
