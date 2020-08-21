export default {
  hook() {
    this.table().hook(
      "updating",
      (modifications, primKey, obj, transaction) => {
        setTimeout(() => {
          for (const query of this.queryResults) {
            if (!query.watch) continue;
            for (const object of query.results) {
              if (object.id === obj.id) {
                if (!("updating" in query.watch)) continue;
                this.with(query.with);
                query.watch.updating(this.query(query.query, ...query.args));
                break;
              }
            }
          }
        }, 0);
      }
    );
  },
};
