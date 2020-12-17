import Dexie from "dexie";
export default class Connection {
    constructor(database, migrations) {
        this._connection = new Dexie(database);
        migrations(this._connection);
    }
    getConnection() {
        return this._connection;
    }
}
//# sourceMappingURL=Connection.js.map