export default {
  hook() {
    // 表内有更新时
    this.table().hook("updating", (modifications, primKey, obj) => {
      setTimeout(() => {
        for (const query of this.queryResults) {
          if (!query.watch || !("updating" in query.watch)) continue;
          for (const object of query.results) {
            if (!obj || object.id !== obj.id) continue;
            this.with(query.with);
            query.watch.updating(() => this.query(query.query, ...query.args));
            break;
          }
        }
      }, 0);
    });

    // 表内有删除时
    this.table().hook("deleting", (primKey, obj) => {
      //   setTimeout(() => {
      for (const query of this.queryResults) {
        if (!query.watch || !("deleting" in query.watch)) continue;
        for (let index = 0; index < query.results.length; index++) {
          const object = query.results[index];
          if (!obj || object.id !== obj.id) continue;
          query.watch.deleting(index, obj);
          break;
        }
      }
      //   }, 0);
    });

    // 表内有新增时
    this.table().hook("creating", (primKey, obj) => {
      setTimeout(() => {
        for (const query of this.queryResults) {
          if (!query.watch || !("creating" in query.watch)) continue;
          query.watch.creating(obj, () =>
            this.query(query.query, ...query.args)
          );
        }
      }, 0);
    });
  },
};
