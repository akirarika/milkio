export default {
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
};
