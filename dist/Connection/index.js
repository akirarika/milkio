import Dexie from "dexie";
export default class Connection {
    constructor(database, migrations) {
        this.connection = new Dexie(database);
        migrations(this.connection);
    }
    getConnection() {
        return this.connection;
    }
}
//# sourceMappingURL=index.js.map