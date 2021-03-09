export default class Persistence {
    constructor(model) {
        this.model = model;
        this.persistence = new this.model.config.drivers.persistence(this.model.config.name, this.model.primary, this.model.config.drivers.persistenceInject);
        this.async = Boolean(this.persistence?.async);
    }
    insert(value, key) {
        return this.persistence.insert(this.model.encode(value, void 0), key);
    }
    insertOrUpdate(key, value) {
        return this.persistence.insertOrUpdate(key, this.model.encode(value, key));
    }
    update(key, value) {
        return this.persistence.update(key, this.model.encode(value, key));
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