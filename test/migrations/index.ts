import Dexie from "dexie";

const db = new Dexie("Kurimudb");

db.version(2).stores({
  configState: "_id",
});

db.version(1).stores({
  _seed: "_id",
});

export default db;
