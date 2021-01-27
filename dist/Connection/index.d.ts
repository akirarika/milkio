import Dexie from "dexie";
export default class Connection {
    private connection;
    constructor(database: string, migrations: Function);
    getConnection(): Dexie;
}
