import { __awaiter } from "tslib";
export default class DexieDriver {
    constructor(name, primary, inject) {
        this.async = true; // if true, some functions can return Promise.
        this.name = name;
        this.primary = primary;
        this.db = inject;
    }
    insert(value, key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._table().add(value);
        });
    }
    insertOrUpdate(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._table().put(value);
        });
    }
    update(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._table().put(value);
        });
    }
    select(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._table().get(key);
        });
    }
    exists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return Boolean(yield this._table().where(this.primary).equals(key).count());
        });
    }
    delete(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._table().delete(key);
        });
    }
    seeding(seedingFunc, model) {
        return __awaiter(this, void 0, void 0, function* () {
            const table = this.db['_seed'];
            if (yield table.get(`${this.name}_is_seeded`))
                return;
            yield table.add({
                id: `${this.name}_is_seeded`,
                value: `true`,
            });
            yield seedingFunc(model);
        });
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