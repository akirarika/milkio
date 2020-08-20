export default {
  queryResults: [
    // {
    //   with: ["author"],
    //   query: "first",
    //   args: [true],
    //   results: [],
    // },
  ],

  listening: false,

  relationshipResults: [],

  /**
   * 查询
   * @param {*} name
   * @param  {...any} args
   */
  async query(name, ...args) {
    const results = await this.queries[name](this.table(), ...args);

    if (!results) return [];
    if (Array != results.constructor)
      throw new Error(`${name} result must be an Array`);

    return await this.queried(name, args, results);
  },

  /**
   * 查询结束
   *
   * @param {*} name
   * @param {*} args
   * @param {*} results
   */
  async queried(name, args, results) {
    if (!this.listening) {
      this.table().hook(
        "updating",
        (modifications, primKey, obj, transaction) => {
          setTimeout(() => {
            this.connection.con.transaction("rw", this.table(), async (tx) => {
              for (const query of this.queryResults) {
                for (const object of query.results) {
                  if (object.id === obj.id) {
                    this.with(query.with);
                    query.results = await this.query(query.name, ...query.args);
                    break;
                  }
                }
              }
            });
          }, 0);
        }
      );

      this.listening = true;
    }

    this.queryResults.push({
      with: this.relationshipResults,
      query: name,
      args: args,
      results: results,
    });

    this.relationshipResults = []; // 执行完一次查询后，重置需加载的关联关系为空

    return results;
  },

  /**
   * 设置关联
   * @param {*} relationship
   */
  with(relationship) {
    this.relationshipResults = relationship;

    return this;
  },
};
