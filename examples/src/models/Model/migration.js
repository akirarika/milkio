export default {
  /**
   * 查询
   * @param {*} name
   * @param  {...any} args
   */
  async migration() {
    if (!this.migrations)
      throw new Error(
        `${this.name} model must contain the migrations function and migrate at least one version`
      );

    for (const version in this.migrations) {
      const store = (str) => {
        const obj = {};
        obj[this.name] = str;
        this.connection.con.version(version).stores(obj);
      };

      this.migrations[version](store);
    }
  },
};
