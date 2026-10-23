const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/;

function pad(value: number, length = 2): string {
    return `${value}`.padStart(length, "0");
}

/** Format an epoch-ms timestamp in the local time zone with millisecond precision. */
export function formatTimestamp(ts: number): string {
    const date = new Date(ts);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function buildLocal(y: number, month: number, day: number, hour: number, minute: number, second: number, ms: number, raw: string): number {
    const date = new Date(y, month - 1, day, hour, minute, second, ms);
    if (date.getFullYear() !== y || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) {
        throw new Error(`Invalid time value: ${raw}`);
    }
    return date.getTime();
}

/**
 * Parse a `--from` / `--to` value.
 *
 * Supported:
 *  - `YYYY-MM-DD`                     (from → 00:00:00.000, to → 23:59:59.999)
 *  - `YYYY-MM-DD HH:mm`               (from → :00.000, to → :59.999)
 *  - `YYYY-MM-DD HH:mm:ss`            (from → .000, to → .999)
 *  - `YYYY-MM-DDTHH:mm:ss.SSS` + optional `Z` / `+08:00` (exact values)
 *
 * No time zone means the local time zone. `to` is inclusive: a second-only
 * boundary includes that whole second.
 */
export function parseTimeBoundary(raw: string, edge: "from" | "to"): number {
    const input = raw.trim();
    if (!input) throw new Error(`Time value cannot be empty`);

    const dateOnly = DATE_ONLY.exec(input);
    if (dateOnly) {
        const [, y, month, day] = dateOnly;
        if (edge === "from") return buildLocal(Number(y), Number(month), Number(day), 0, 0, 0, 0, raw);
        return buildLocal(Number(y), Number(month), Number(day), 23, 59, 59, 999, raw);
    }

    const parsed = DATE_TIME.exec(input);
    if (!parsed) {
        throw new Error(`Invalid time value: ${raw}. Expected "YYYY-MM-DD", "YYYY-MM-DD HH:mm[:ss]" or an ISO 8601 timestamp.`);
    }

    const [, y, month, day, hour, minute, secondRaw, msRaw, zone] = parsed;
    const second = secondRaw === undefined ? (edge === "to" ? 59 : 0) : Number(secondRaw);
    const ms = msRaw !== undefined ? Number(msRaw.padEnd(3, "0")) : edge === "to" ? 999 : 0;
    const hh = Number(hour);
    const mm = Number(minute);
    const yy = Number(y);
    const mo = Number(month);
    const dd = Number(day);

    if (zone) {
        // Explicit time zone: build an ISO string and let the runtime resolve it.
        const normalizedZone = zone === "Z" ? "Z" : zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
        const value = Date.parse(`${y}-${month}-${day}T${hour}:${minute}:${pad(second)}.${pad(ms, 3)}${normalizedZone}`);
        if (!Number.isFinite(value)) throw new Error(`Invalid time value: ${raw}`);
        return value;
    }

    return buildLocal(yy, mo, dd, hh, mm, second, ms, raw);
}

/** Parse a page-size flag such as `64kb`, `65536`, `65536b`. */
export function parsePageSize(raw: string): number {
    const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb)?$/i.exec(raw.trim());
    if (!match) throw new Error(`Invalid page size: ${raw}. Expected e.g. "64kb", "65536" or "65536b".`);
    const value = Number(match[1]);
    const unit = (match[2] ?? "b").toLowerCase();
    const bytes = Math.round(value * (unit === "kb" ? 1024 : unit === "mb" ? 1024 * 1024 : 1));
    if (!Number.isFinite(bytes) || bytes < 256) throw new Error(`Page size is too small: ${raw} (minimum 256 bytes).`);
    if (bytes > 8 * 1024 * 1024) throw new Error(`Page size is too large: ${raw} (maximum 8 MB).`);
    return bytes;
}
