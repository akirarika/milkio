import Dexie from "dexie";
export default class Connection {
    constructor(database, migrations) {
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
//# sourceMappingURL=index.js.map