export default class Persistence {
    constructor(model) {
        var _a;
        this.model = model;
        this.persistence = new this.model.config.drivers.persistence(this.model.config.name, this.model.primary, this.model.config.drivers.persistenceInject);
        this.async = Boolean((_a = this.persistence) === null || _a === void 0 ? void 0 : _a.async);
    }
    insert(value, key) {
        if (this.persistence.encode)
            value = this.model.encode(value, void 0);
        return this.persistence.insert(value, key);
    }
    insertOrUpdate(key, value) {
        if (this.persistence.encode)
            value = this.model.encode(value, key);
        return this.persistence.insertOrUpdate(key, value);
    }
    update(key, value) {
        if (this.persistence.encode)
            value = this.model.encode(value, key);
        return this.persistence.update(key, value);
    }
    select(key) {
        return this.persistence.select(key);
    }
    exists(key) {
        return this.persistence.exists(key);
    }
    delete(key) {
        this.persistence.delete(key);
    }
    seeding(seeding, model) {
        this.persistence.seeding(seeding, model);
    }
    query() {
        if (!this.persistence.query)
            throw new Error(`This driver does not implement the query function.`);
        return this.persistence.query();
    }
    all() {
        return this.persistence.all();
    }
}
//# sourceMappingURL=persistence.js.map