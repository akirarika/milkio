export default class LocalStorageDriver {
    constructor(name, primary, inject) {
        this.async = false; // if true, some functions can return Promise.
        this.name = name;
        this.primary = primary;
        this.db = inject;
    }
    insert(value, key) {
        if (!key) {
            let id = localStorage.getItem(`$table_id__${this.name}`);
            if (!id)
                id = "1";
            key = parseInt(id);
            localStorage.setItem(`$table_id__${this.name}`, `${key + 1}`);
        }
        localStorage.setItem(`$table__${this.name}_${key}`, JSON.stringify(value));
    }
    insertOrUpdate(key, value) {
        localStorage.setItem(`$table__${this.name}_${key}`, JSON.stringify(value));
    }
    update(key, value) {
        localStorage.setItem(`$table__${this.name}_${key}`, JSON.stringify(value));
    }
    select(key) {
        return JSON.parse("" + localStorage.getItem(`$table__${this.name}_${key}`));
    }
    exists(key) {
        return Boolean(localStorage.getItem(`$table__${this.name}_${key}`));
    }
    delete(key) {
        localStorage.removeItem(`$table__${this.name}_${key}`);
    }
    seeding(seeding, model) {
        if (localStorage.getItem(`$seeded__${this.name}`))
            return;
        seeding(model);
        localStorage.setItem(`$seeded__${this.name}`, "1");
    }
    all() {
        throw new Error(`The localstorage driver cannot use the 'all' method.`);
        return [];
    }
}
//# sourceMappingURL=LocalStorageDriver.js.map