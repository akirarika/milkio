import type { MilkioResponseReject, Logger } from "../index.ts";

export interface $rejectCode {
    REQUEST_FAIL: any;
    NOT_DEVELOP_MODE: string;
    REQUEST_TIMEOUT: { timeout: number; message: string };
    NOT_FOUND: { path: string };
    PARAMS_TYPE_INCORRECT: { path: string; expected: string; value: any; message: string } | null;
    RESULTS_TYPE_INCORRECT: { path: string; expected: string; value: any; message: string } | null;
    UNACCEPTABLE: { expected: string; message: string };
    PARAMS_TYPE_NOT_SUPPORTED: { expected: string; contentType: string | null; params: string };
    RESULTS_TYPE_NOT_SUPPORTED: { expected: string };
    INTERNAL_SERVER_ERROR: undefined;
    METHOD_NOT_ALLOWED: undefined;
    NETWORK_ERROR: undefined;
}

// reject: 拒绝码形式，第一个参数必须是字符串（拒绝码），第二个参数是具体的错误数据
// 注意：框架内部的 reject 使用宽松类型，用户侧 context.reject 的严格类型由 declares.ts 中的 MilkioRejectFunction 提供
export function reject(code: string, data?: any): MilkioRejectError<any, any> {
    const error = { $milkioReject: true, code, data } as MilkioRejectError<any, any>;
    if (typeof Error.captureStackTrace === "function") Error.captureStackTrace(error);
    return error;
}

// raise: 对象形式，传入一个 { 拒绝码: 错误数据 } 对象，将错误向上抛出（类似 golang 的显式错误处理）
// 注意：框架内部的 raise 使用宽松类型，用户侧 context.raise 的严格类型由 declares.ts 中的 MilkioRaiseFunction 提供
export function raise(obj: Record<string, any>): MilkioRejectError<any, any> {
    const keys = Object.keys(obj);
    const code = keys[0];
    if (code === undefined) throw new Error("raise() requires an object with at least one key as the rejection code");
    const rejectData = obj[code];
    const error = { $milkioReject: true, code, data: rejectData } as MilkioRejectError<any, any>;
    if (typeof Error.captureStackTrace === "function") Error.captureStackTrace(error);
    return error;
}

export type MilkioRejectError<Code extends keyof $rejectCode = keyof $rejectCode, RejectData extends $rejectCode[Code] = $rejectCode[Code]> = { code: Code; data: RejectData; stack: string; $milkioReject: true };

export function exceptionHandler(executeId: string, logger: Logger, error: MilkioRejectError<any, any> | any): MilkioResponseReject {
    if (error instanceof Error && "viteServer" in globalThis) {
        try { (globalThis as any).viteServer.ssrFixStacktrace(error); } catch {}
    }
    const name = error?.code ?? error?.name ?? error?.constructor?.name ?? "Unnamed Exception";

    if (error?.$milkioReject === true && error?.code === "NOT_FOUND") {
        logger.info(name, error?.data?.path ?? "Unknown path");
    } else {
        try {
            const stack = error?.$milkioReject ? (error?.stack ?? "").split("\n").slice(2).join("\n") : (error?.stack ?? "");
            logger.error(name, `\n${JSON.stringify(error?.data)}`, `\n${stack}\n`);
        } catch (_) {
            logger.error(name, `\n${error?.toString()}`, `\n${error?.stack}\n`);
        }
    }

    let result: MilkioResponseReject;

    if (error?.$milkioReject === true) result = { success: false, code: error.code, reject: error.data, executeId };
    else result = { success: false, code: "INTERNAL_SERVER_ERROR", reject: undefined, executeId };

    return result;
}
