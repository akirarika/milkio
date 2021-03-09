export default class DexieDriver {
    constructor(name, primary, inject) {
        this.async = true; // if true, some functions can return Promise.
        this.name = name;
        this.primary = primary;
        this.db = inject;
    }
    async insert(value, key) {
        return await this._table().add(value);
    }
    async insertOrUpdate(key, value) {
        await this._table().put(value);
    }
    async update(key, value) {
        await this._table().put(value);
    }
    async select(key) {
        return await this._table().get(key);
    }
    async exists(key) {
        return Boolean(await this._table().where(this.primary).equals(key).count());
    }
    async delete(key) {
        await this._table().delete(key);
    }
    async seeding(seedingFunc, model) {
        const table = this.db['_seed'];
        if (await table.get(`${this.name}_is_seeded`))
            return;
        await table.add({
            id: `${this.name}_is_seeded`,
            value: `true`,
        });
        await seedingFunc(model);
    }
    query() {
        return this._table();
    }
    all() {
        return this._table().toArray();
    }
    _table() {
        const table = this.db[this.name];
        if (table)
            return table;
        throw new Error(`table "${this.name}" does not exist in the database. did you forget to add the new version?`);
    }
}
//# sourceMappingURL=DexieDriver.js.map