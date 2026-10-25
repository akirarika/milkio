import type { MilkioResponseFailure } from "../types/index.ts";
import type { Logger } from "../logger/index.ts";

// ---------------------------------------------------------------------------
// fail-code: expected business rejection. warn level, no stack, cheap to build.
// fault-code: unexpected/internal failure. error level, stack/cause, never exposed.
// ---------------------------------------------------------------------------

export type MilkioFailureKind = "fail" | "fault";

// ===== framework built-in codes =====
export interface $failCode {
    NOT_FOUND: { path: string };
    METHOD_NOT_ALLOWED: undefined;
    PARAMS_TYPE_INCORRECT: { path: string; expected: string; value: any; message: string } | null;
    PARAMS_TYPE_NOT_SUPPORTED: { expected: string; contentType: string | null; params: string };
    NOT_DEVELOP_MODE: string;
    UNACCEPTABLE: { expected: string; message: string };
    REQUEST_TOO_LARGE: { maxBodySize: number };
}

export interface $faultCode {
    INTERNAL_SERVER_ERROR: undefined;
    FRAMEWORK_ERROR: { message: string };
    RESULTS_TYPE_INCORRECT: { path: string; expected: string; value: any; message: string } | null;
}

// ===== failure values =====
export interface MilkioFail<Code extends string = string, Data = unknown> {
    readonly $milkioFailure: true;
    readonly kind: "fail";
    readonly code: Code;
    readonly data: Data;
}

export interface MilkioFaultShape<Code extends string = string, Data = unknown> {
    readonly $milkioFailure: true;
    readonly kind: "fault";
    readonly code: Code;
    readonly data: Data;
    readonly stack?: string;
}

export type MilkioFailure = MilkioFail | MilkioFaultShape;

// ===== client-visible fault shape (real fault code/data stay server side) =====
export interface MilkioPublicFault {
    readonly $milkioFailure: true;
    readonly kind: "fault";
    readonly code: "INTERNAL_SERVER_ERROR";
    readonly data?: undefined;
}

// ===== wire types =====
export interface MilkioFailWire<Code extends string = string, Data = unknown> {
    kind: "fail";
    code: Code;
    data: Data;
}

export interface MilkioFaultWire {
    kind: "fault";
    code: "INTERNAL_SERVER_ERROR";
}

export type MilkioFailureWire = MilkioFailWire | MilkioFaultWire;

// ===== constructors =====
/** fail: plain object only — no Error, no stack, no captureStackTrace (hot path). */
export function fail<Code extends string = string>(code: Code, data?: unknown): MilkioFail<Code, unknown> {
    return { $milkioFailure: true, kind: "fail", code, data } as MilkioFail<Code, unknown>;
}

/** fault: Error subclass — captures stack/cause for server-side logs only. */
export class MilkioFaultError extends Error implements MilkioFaultShape {
    readonly $milkioFailure = true as const;
    readonly kind = "fault" as const;
    readonly code: string;
    readonly data: unknown;

    constructor(code: string, data?: unknown, options?: { cause?: unknown; stack?: string }) {
        super(code, options?.cause === undefined ? undefined : { cause: options.cause });
        this.name = "MilkioFault";
        this.code = code;
        this.data = data;
        if (options?.stack !== undefined) this.stack = options.stack;
    }
}

export function fault(code: string, data?: unknown, options?: { cause?: unknown }): MilkioFaultError {
    return new MilkioFaultError(code, data, options);
}

export function isMilkioFailure(value: unknown): value is MilkioFailure {
    return typeof value === "object" && value !== null && (value as any).$milkioFailure === true;
}

export interface MilkioFaultReport {
    executeId: string;
    path?: string;
    routeType?: "action" | "stream" | "raw" | "event";
    kind: "fault";
    code: string;
    data: unknown;
    stack?: string;
    cause?: unknown;
    source: "fault" | "unexpected";
}

// cause chain is where the real reason usually lives (drizzle/fetch put it there)
export function serializeCause(error: unknown): string {
    const seen = new Set<any>();
    const causes: Array<Record<string, unknown>> = [];
    let current = (error as any)?.cause;
    while (current !== null && current !== undefined && typeof current === "object" && !seen.has(current)) {
        seen.add(current);
        const cause: Record<string, unknown> = {};
        for (const key of ["name", "message", "code", "errno", "sqlState", "sqlMessage"]) {
            if ((current as any)[key] !== undefined) cause[key] = (current as any)[key];
        }
        causes.push(cause);
        current = (current as any).cause;
    }
    return causes.length > 0 ? JSON.stringify(causes) : "";
}

function safeStringify(value: unknown): string {
    if (value === undefined) return "undefined";
    try {
        return JSON.stringify(value) ?? "undefined";
    } catch {
        try { return String(value); } catch { return "[unserializable]"; }
    }
}

type Classified =
    | { kind: "fail"; code: string; data: unknown }
    | { kind: "fault"; code: string; data: unknown; stack?: string; cause?: unknown; source: "fault" | "unexpected" };

export function classifyFailure(error: unknown): Classified {
    if (isMilkioFailure(error)) {
        if (error.kind === "fail") return { kind: "fail", code: error.code, data: error.data };
        return { kind: "fault", code: error.code, data: error.data, stack: error.stack, source: "fault" };
    }
    return {
        kind: "fault",
        code: "INTERNAL_SERVER_ERROR",
        data: undefined,
        stack: error instanceof Error ? (error.stack ?? "") : "",
        cause: error,
        source: "unexpected",
    };
}

export function failureHandler(
    executeId: string,
    logger: Logger,
    error: unknown,
    options: {
        path?: string;
        routeType?: MilkioFaultReport["routeType"];
        onError?: (report: MilkioFaultReport) => void;
    } = {},
): { response: MilkioResponseFailure; report?: MilkioFaultReport } {
    const classified = classifyFailure(error);

    if (classified.kind === "fail") {
        // fail: warn, no stack (never captured), data is part of the public contract
        logger.warn(classified.code, safeStringify(classified.data));
        return {
            response: {
                success: false,
                executeId,
                error: { kind: "fail", code: classified.code, data: classified.data },
            },
        };
    }

    // fault: log real code/data/stack/cause; client only learns "fault + generic code"
    try {
        const params: Array<unknown> = [safeStringify(classified.data)];
        const causes = serializeCause(classified.cause ?? error);
        if (causes !== "") params.push(`causes: ${causes}`);
        if (classified.stack !== undefined && classified.stack !== "") params.push(`\n${classified.stack}\n`);
        logger.error(classified.code, ...params);
    } catch (_) {
        logger.error(classified.code, safeStringify(classified.data));
    }

    const report: MilkioFaultReport = {
        executeId,
        path: options.path,
        routeType: options.routeType,
        kind: "fault",
        code: classified.code,
        data: classified.data,
        stack: classified.stack,
        cause: classified.cause,
        source: classified.source,
    };

    if (options.onError !== undefined) {
        try {
            options.onError(report);
        } catch (onErrorError) {
            try {
                logger.error("An error occurred inside onError.", onErrorError);
            } catch { /* never let alerting break error handling */ }
        }
    }

    return {
        response: {
            success: false,
            executeId,
            error: { kind: "fault", code: "INTERNAL_SERVER_ERROR" },
        },
        report,
    };
}
