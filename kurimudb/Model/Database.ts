import { Table } from 'dexie';
import Model from '.';

export default class Database {
    private model: Model;

    constructor(model: Model) {
        this.model = model;
    }

    query(): Table {
        if (!this.model._connection) throw new Error(`This model cannot persist data without a connection.`);
        return this.model._connection.getConnection()[this.model.name];
    }

    async all() {
        return await this.query().toArray();
    }

    async get(key) {
        return this.decode(await this.query().get(key));
    }

    async put(key, value) {
        value = this.encode(value);
        value[this.model.primary] = key;
        await this.query().put(value);
    }

    async add(value, key = void 0, returnPrimary = false) {
        value = this.encode(value);
        if (void 0 !== key) value[this.model.primary] = key;
        const primary = await this.query().add(value);
        if (returnPrimary) return primary;
        return await this.query().get(primary);
    }

    async forget(key) {
        await this.query().delete(key);
    }

    async has(key): Promise<boolean> {
        return !!await this.query().where(this.model.primary).equals(key).count();
    }

    encode(value) {
        if (this.model._isPlainObject(value)) return value;
        return { "$__value": value };
    }

    decode(value) {
        if (void 0 === value || null === value) return null;
        if ("$__value" in value) return value["$__value"];
        return value;
    }
}