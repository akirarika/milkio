import { merge, Subject, BehaviorSubject } from "rxjs";
import Cache from "./Cache";
import Data from "./Data";
import Database from "./Database";
export default class Model {
    constructor(connection, [primary, primaryType]) {
        this.inserted$ = new Subject();
        this.deleted$ = new Subject();
        this.updated$ = new Subject();
        this.changed$ = merge(this.inserted$, this.deleted$, this.updated$);
        this.$ = new BehaviorSubject({
            type: "inited",
            key: null,
            value: null,
        });
        this.name = this.constructor.name;
        this.primary = primary;
        this.primaryType = primaryType;
        if (!this.name)
            throw new Error(`'name' not found.`);
        if (connection && !connection.getConnection()[this.name])
            throw new Error(`Table not found. Did you add this table '${this.name}' to the migrations?`);
        this._connection = connection;
        this._database = new Database(this);
        this._cache = new Cache(this);
        this.data = new Data(this);
        this.changed$.subscribe((d) => this.$.next(d));
        if (this["seeding"])
            setTimeout(() => this._seeding(), 0);
    }
    async all(type) {
        if (!this._connection)
            return this._cache.all();
        return this.getResults(this.query(), null, type);
    }
    query() {
        return this._database.query();
    }
    async getResults(query, resultProt = null, type = Object) {
        if (!this._connection)
            throw new Error(`This function can only be used when you have Collection`);
        let querys = await query.toArray();
        if (!(querys instanceof Array))
            throw new Error(`The query result is not a single object. If it's an array, please use 'getresult' instead.`);
        if (null === resultProt)
            resultProt = new type();
        const setResult = (key, value) => {
            if (resultProt instanceof Array)
                resultProt.push(value);
            else
                resultProt[key] = value;
        };
        for (const item of querys) {
            const key = item[this.primary];
            if (this._cache.has(key))
                setResult(key, this._cache.get(key));
            else {
                setResult(key, this._database.decode(item));
                this._cache.add(key, this._database.decode(item));
            }
        }
        return resultProt;
    }
    async getResult(query, resultProt = {}) {
        if (!this._connection)
            throw new Error(`This function can only be used when you have Collection`);
        if (!this._isPlainObject(await query))
            throw new Error(`The query result is not a single array. If it's an object, please use 'getresults' instead.`);
        const item = await query;
        const key = item[this.primary];
        if (this._cache.has(key))
            resultProt[key] = this._cache.get(key);
        else {
            resultProt[key] = this._database.decode(item);
            this._cache.add(key, resultProt[key]);
        }
        return resultProt;
    }
    async has(key) {
        key = this.checkPrimary(key);
        if (this._cache.has(key))
            return true;
        if (this._connection)
            return this._database.has(key);
        else
            return false;
    }
    async set(key, func) {
        key = this.checkPrimary(key);
        const val = await this.data[key];
        await func(val);
        this.data[key] = val;
    }
    checkPrimary(key) {
        if ("number" === this.primaryType && !isNaN(Number(key)))
            return Number(key);
        if (this.primaryType !== typeof key)
            throw new Error(`The model primary type needs to be ${this.primaryType}, not ${typeof key}`);
        return key;
    }
    async _seeding() {
        if (!this._connection)
            return this["seeding"](this.data);
        const table = this._connection.getConnection()["__Kurimudb"];
        if (await table.get(`${this.name}_is_seeded`))
            return;
        this["seeding"](this.data);
        await table.add({
            key: `${this.name}_is_seeded`,
            value: `true`,
        });
    }
    _humpToLine(str) {
        return str
            .replace(/([A-Z])/g, "_$1")
            .toLowerCase()
            .replace(/^_/, "");
    }
    _isPlainObject(obj) {
        if (typeof obj !== "object" || obj === null)
            return false;
        let proto = obj;
        while (Object.getPrototypeOf(proto) !== null) {
            proto = Object.getPrototypeOf(proto);
        }
        // proto = null
        return Object.getPrototypeOf(obj) === proto;
    }
}
//# sourceMappingURL=index.js.map