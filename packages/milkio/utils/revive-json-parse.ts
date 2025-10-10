
export function reviveJSONParse<T>(json: T): T {
    const isoDatePattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(Z|[+-]\d{2}:?\d{2})?$/;

    if (json instanceof Date) return json;
    if (Array.isArray(json)) {
        return json.map((item) => reviveJSONParse(item)) as any;
    }
    if (typeof json === "object" && json !== null) {
        return Object.entries(json).reduce((acc, [key, value]) => {
            acc[key as keyof T] = reviveJSONParse(value);
            return acc;
        }, {} as T);
    }
    if (typeof json === "string") {
        const match = json.match(isoDatePattern);
        if (match) {
            const normalizedDateString = match[2] ? `${match[1]}${match[2].replace(":", "")}` : `${match[1]}Z`;
            return new Date(normalizedDateString) as any;
        }
    }
    return json;
}