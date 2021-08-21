import Dexie from "dexie";

const db = new Dexie("Kurimudb");

db.version(1).stores({
  db: "_id",
  _seed: "_id",
});

export default db;
