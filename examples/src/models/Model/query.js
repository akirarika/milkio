export default {
  queryResults: [
    // {
    //   with: ["author"],
    //   watch: {},
    //   query: "first",
    //   args: [true],
    //   results: [],
    // },
  ],

  relationshipResults: [],
  watchFunc: null,

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

    await this.loadRelationships(results, this.relationshipResults);

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
    this.queryResults.push({
      with: this.relationshipResults,
      watch: this.watchFunc,
      query: name,
      args: args,
      results: results,
    });

    // 重置链式调用的各种参数值
    this.relationshipResults = [];
    this.watchFunc = null;

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

  watch({ updating = null, deleting = null, creating = null }) {
    const watchFunc = [];

    if (updating) watchFunc.updating = updating;
    if (deleting) watchFunc.deleting = deleting;
    if (creating) watchFunc.creating = creating;

    this.watchFunc = watchFunc;

    return this;
  },
};
