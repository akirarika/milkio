import Dexie from "dexie";

export default class Connection {
  private connection: Dexie;

  constructor(database: string, migrations: Function) {
    this.connection = new Dexie(database);
    this.connection.version(1).stores({
      __Kurimudb: "key",
    });
    migrations(this.connection);
  }

  getConnection() {
    return this.connection;
  }
}
