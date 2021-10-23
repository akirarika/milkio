export function clone(data: any, nonPlainObjectHandler?: (data: unknown) => unknown): any {
    if (null === data || undefined === data) {
        return data;
    } else if ("object" !== typeof data) {
        return data;
    } else if (Array.isArray(data)) {
        const array = [];
        for (let i = 0, l = data.length; i < l; ++i) {
            array.push(clone(data[i], nonPlainObjectHandler));
        }
        return array;
    } else {
        let proto = data;
        while (Object.getPrototypeOf(proto) !== null) {
            proto = Object.getPrototypeOf(proto);
        }
        if (Object.getPrototypeOf(data) === proto) {
            const object = Object.create(null);
            Reflect.ownKeys(data).map((key) => {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    object[String(key)] = clone(data[key], nonPlainObjectHandler);
                }
            });
            return object;
        } else {
            if (undefined !== nonPlainObjectHandler) return nonPlainObjectHandler(data);
            else return data;
        }
    }
}