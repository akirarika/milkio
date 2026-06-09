import { expect, test } from "vitest";

// Copy of reviveJSONParse for testing (same implementation as milkio-stargate and milkio/utils)
const isoDatePattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(Z|[+-]\d{2}:?\d{2})?$/;

function reviveJSONParse<T>(json: T): T {
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

test.sequential("shallow date string is converted to Date", () => {
    const result = reviveJSONParse({ date: "2024-01-15T10:30:00.000Z" });
    expect(result.date).toBeInstanceOf(Date);
    expect((result.date as any as Date).toISOString()).toBe("2024-01-15T10:30:00.000Z");
});

test.sequential("deeply nested date string is converted to Date", () => {
    const result = reviveJSONParse({
        level1: {
            level2: {
                level3: {
                    date: "2024-06-01T08:00:00.000Z",
                },
            },
        },
    });
    expect(result.level1.level2.level3.date).toBeInstanceOf(Date);
    expect((result.level1.level2.level3.date as unknown as Date).toISOString()).toBe("2024-06-01T08:00:00.000Z");
});

test.sequential("date in array is converted to Date", () => {
    const result = reviveJSONParse({
        items: ["2024-03-20T12:00:00.000Z", "hello", 42],
    });
    expect(result.items[0]).toBeInstanceOf(Date);
    expect((result.items[0] as unknown as Date).toISOString()).toBe("2024-03-20T12:00:00.000Z");
    expect(result.items[1]).toBe("hello");
    expect(result.items[2]).toBe(42);
});

test.sequential("date with timezone offset is converted", () => {
    const result = reviveJSONParse({ date: "2024-01-15T10:30:00.000+08:00" });
    expect(result.date).toBeInstanceOf(Date);
    expect((result.date as unknown as Date).toISOString()).toBe("2024-01-15T02:30:00.000Z");
});

test.sequential("date without timezone gets Z appended", () => {
    const result = reviveJSONParse({ date: "2024-01-15T10:30:00.000" });
    expect(result.date).toBeInstanceOf(Date);
    expect((result.date as unknown as Date).toISOString()).toBe("2024-01-15T10:30:00.000Z");
});

test.sequential("non-date strings are not converted", () => {
    const result = reviveJSONParse({
        name: "hello",
        number: "12345",
        short: "2024-01-15",
    });
    expect(result.name).toBe("hello");
    expect(result.number).toBe("12345");
    expect(result.short).toBe("2024-01-15");
});

test.sequential("null and undefined are preserved", () => {
    const result = reviveJSONParse({ a: null, b: undefined });
    expect(result.a).toBeNull();
    expect(result.b).toBeUndefined();
});

test.sequential("existing Date objects are not modified", () => {
    const original = new Date("2024-01-15T10:30:00.000Z");
    const result = reviveJSONParse({ date: original });
    expect(result.date).toBe(original);
});

test.sequential("mixed object with dates and non-dates", () => {
    const result = reviveJSONParse({
        createdAt: "2024-01-15T10:30:00.000Z",
        name: "test",
        count: 10,
        tags: ["a", "2024-01-15T10:30:00.000Z"],
        nested: { updatedAt: "2024-06-01T08:00:00.000Z", active: true },
    });
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.name).toBe("test");
    expect(result.count).toBe(10);
    expect(result.tags[0]).toBe("a");
    expect(result.tags[1]).toBeInstanceOf(Date);
    expect(result.nested.updatedAt).toBeInstanceOf(Date);
    expect(result.nested.active).toBe(true);
});

test.sequential("array of date strings at top level", () => {
    const result = reviveJSONParse(["2024-01-15T10:30:00.000Z", "2024-06-01T08:00:00.000Z"]);
    expect(result[0]).toBeInstanceOf(Date);
    expect(result[1]).toBeInstanceOf(Date);
});

test.sequential("roundtrip: JSON.stringify then JSON.parse then reviveJSONParse", () => {
    const original = {
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        name: "test",
        nested: { updatedAt: new Date("2024-06-01T08:00:00.000Z") },
    };
    const json = JSON.stringify(original);
    const parsed = JSON.parse(json);
    const revived = reviveJSONParse(parsed);
    expect(revived.createdAt).toBeInstanceOf(Date);
    expect((revived.createdAt as Date).getTime()).toBe(original.createdAt.getTime());
    expect(revived.name).toBe("test");
    expect(revived.nested.updatedAt).toBeInstanceOf(Date);
    expect((revived.nested.updatedAt as Date).getTime()).toBe(original.nested.updatedAt.getTime());
});
