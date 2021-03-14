function setCookie(name, value) {
    document.cookie =
        name +
            "=" +
            encodeURIComponent("object" === typeof value ? JSON.stringify(value) : value) +
            ";max-age=" +
            31525459200 +
            ";path=/";
}
function getCookie(name) {
    if (document.cookie.length > 0) {
        let end;
        let start = document.cookie.indexOf(name + "=");
        if (start != -1) {
            start = start + name.length + 1;
            end = document.cookie.indexOf(";", start);
            if (end == -1)
                end = document.cookie.length;
            let value = decodeURIComponent(document.cookie.substring(start, end));
            try {
                value = JSON.parse(value);
            }
            catch (error) { }
            return value;
        }
    }
    return null;
}
function delCookie(name) {
    let exp = new Date();
    exp.setTime(exp.getTime() - 1);
    let cval = getCookie(name);
    if (cval != null)
        document.cookie = name + "=" + cval + ";max-age=0";
}
export default class LocalStorageDriver {
    constructor(name, primary, inject) {
        this.async = false; // if true, some functions can return Promise.
        this.encode = false; // if true, value will be encoded.
        this.name = name;
        this.primary = primary;
        this.db = inject;
    }
    insert(value, key) {
        if (!key)
            throw new Error(`You must pass in the primary key! (Cookie driver does not support collection model)`);
        setCookie(key, value);
    }
    insertOrUpdate(key, value) {
        setCookie(key, value);
    }
    update(key, value) {
        setCookie(key, value);
    }
    select(key) {
        return getCookie(key);
    }
    exists(key) {
        return Boolean(getCookie(key));
    }
    delete(key) {
        delCookie(key);
    }
    seeding(seeding, model) {
        if (getCookie(`$seeded__${this.name}`))
            return;
        seeding(model);
        setCookie(`$seeded__${this.name}`, "1");
    }
    all() {
        throw new Error(`The cookie driver cannot use the 'all' method.`);
        return [];
    }
}
//# sourceMappingURL=CookieDriver.js.map