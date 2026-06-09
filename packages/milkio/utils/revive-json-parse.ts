const isoDatePattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(Z|[+-]\d{2}:?\d{2})?$/;

function tryParseDate(str: string): Date | null {
    const len = str.length;
    if (len >= 20 && len <= 32 && str.charCodeAt(0) >= 0x30 && str.charCodeAt(0) <= 0x39 && str.indexOf('T') !== -1) {
        const match = isoDatePattern.exec(str);
        if (match !== null) {
            if (match[2]) {
                const colonPos = match[2].charCodeAt(3) === 58 ? match[1].length + 3 : -1;
                if (colonPos >= 0) {
                    return new Date(str.substring(0, colonPos) + str.substring(colonPos + 1));
                }
                return new Date(str);
            }
            return new Date(match[1] + 'Z');
        }
    }
    return null;
}

export function reviveJSONParse<T>(json: T): T {
    if (json === null || json === undefined) return json;
    if (typeof json === 'object') {
        if (json instanceof Date) return json;
        if (Array.isArray(json)) {
            const len = json.length;
            for (let i = 0; i < len; i++) {
                const v = json[i];
                if (typeof v === 'string') {
                    const d = tryParseDate(v);
                    if (d !== null) json[i] = d;
                } else if (typeof v === 'object' && v !== null) {
                    reviveJSONParse(v);
                }
            }
            return json;
        }
        const obj = json as Record<string, unknown>;
        for (const key in obj) {
            const v = obj[key];
            if (typeof v === 'string') {
                const d = tryParseDate(v);
                if (d !== null) obj[key] = d;
            } else if (typeof v === 'object' && v !== null) {
                reviveJSONParse(v);
            }
        }
        return json;
    }
    if (typeof json === 'string') {
        const d = tryParseDate(json);
        if (d !== null) return d as any;
    }
    return json;
}