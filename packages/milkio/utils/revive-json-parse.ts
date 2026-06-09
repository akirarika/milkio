const isoDatePattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(Z|[+-]\d{2}:?\d{2})?$/;

export function reviveJSONParse<T>(json: T): T {
    if (json === null || json === undefined) return json;
    const type = typeof json;
    if (type === 'object') {
        if (json instanceof Date) return json;
        if (Array.isArray(json)) {
            const len = json.length;
            for (let i = 0; i < len; i++) {
                const result = reviveJSONParse(json[i]);
                if (result !== json[i]) json[i] = result;
            }
            return json;
        }
        const keys = Object.keys(json as object);
        const obj = json as Record<string, unknown>;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = obj[key];
            const result = reviveJSONParse(value);
            if (result !== value) obj[key] = result;
        }
        return json;
    }
    if (type === 'string') {
        const str = json as unknown as string;
        // Quick reject: ISO date strings must start with a digit and contain 'T'
        const len = str.length;
        if (len >= 20 && len <= 32 && str.charCodeAt(0) >= 0x30 && str.charCodeAt(0) <= 0x39 && str.indexOf('T') !== -1) {
            const match = str.match(isoDatePattern);
            if (match !== null) {
                if (match[2]) {
                    const colonPos = match[2].charCodeAt(3) === 58 ? match[1].length + 3 : -1;
                    if (colonPos >= 0) {
                        return new Date(str.substring(0, colonPos) + str.substring(colonPos + 1)) as any;
                    }
                    return new Date(str) as any;
                }
                return new Date(match[1] + 'Z') as any;
            }
        }
    }
    return json;
}