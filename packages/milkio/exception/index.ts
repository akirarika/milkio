import type { MilkioResponseReject, Logger } from "../index.ts";

export interface $rejectCode {
    REQUEST_FAIL: any;
    NOT_DEVELOP_MODE: string;
    REQUEST_TIMEOUT: { timeout: number; message: string };
    NOT_FOUND: { path: string };
    PARAMS_TYPE_INCORRECT: { path: string; expected: string; value: any; message: string } | null;
    RESULTS_TYPE_INCORRECT: { path: string; expected: string; value: any; message: string } | null;
    UNACCEPTABLE: { expected: string; message: string };
    PARAMS_TYPE_NOT_SUPPORTED: { expected: string };
    RESULTS_TYPE_NOT_SUPPORTED: { expected: string };
    INTERNAL_SERVER_ERROR: undefined;
    METHOD_NOT_ALLOWED: undefined;
}

export function reject<Code extends keyof $rejectCode, RejectData extends $rejectCode[Code]>(code: Code, data: RejectData): MilkioRejectError<Code, RejectData> {
    const error = { $milkioReject: true, code, data } as MilkioRejectError<Code, RejectData>;
    Error.captureStackTrace(error);
    return error;
}

export type MilkioRejectError<Code extends keyof $rejectCode = keyof $rejectCode, RejectData extends $rejectCode[Code] = $rejectCode[Code]> = { code: Code; data: RejectData; stack: string; $milkioReject: true };

export function exceptionHandler(executeId: string, logger: Logger, error: MilkioRejectError<any, any> | any): MilkioResponseReject {
    try {
        if ("viteServer" in globalThis) (globalThis as any).viteServer?.ssrFixStacktrace(error); // fix vite ssr stacktrace
    } catch (error) { }
    if (error instanceof Error && "viteServer" in globalThis) (globalThis as any).viteServer.ssrFixStacktrace(error);
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
