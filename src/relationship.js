export default {
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
        resArr.forEach((r) => {
          anyOfArr.push(...r[foreignKey]);
        });

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
};
