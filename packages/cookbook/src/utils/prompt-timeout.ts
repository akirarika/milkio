import consola from "consola";

/**
 * 交互式提示的超时时间（毫秒）。
 *
 * 任何阻塞式的交互式选择 / 输入都会在此时长内未得到响应时自动退出，
 * 避免 ai agent 在无人值守场景下被永久卡住。
 */
export const PROMPT_TIMEOUT_MS = 15000;

/**
 * 包装一个交互式 promise，若在 {@link PROMPT_TIMEOUT_MS} 内未完成，
 * 打印错误信息并退出进程。
 *
 * @param promise  被包装的交互式 promise
 * @param context  场景描述，用于第一句（例如 "select mode"）
 * @param hint     第二句的具体参数提示，告诉调用方如何用命令行参数绕过（例如 "add --mode=test"）
 */
export async function withPromptTimeout<T>(promise: Promise<T>, context: string, hint: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("__PROMPT_TIMEOUT__")), PROMPT_TIMEOUT_MS);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    } catch (err: any) {
        if (err?.message === "__PROMPT_TIMEOUT__") {
            printTimeoutError(context, hint);
            process.exit(1);
        }
        throw err;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

/**
 * 创建一个带超时的 AbortController，用于支持 signal 的提示 API
 * （如 @inquirer/prompts 的 search / select / confirm）。
 *
 * 返回 controller 本身，调用方负责在完成后调用 clearTimeout。
 */
export function createPromptAbortController(): { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROMPT_TIMEOUT_MS);
    return { controller, timeoutId };
}

/**
 * 当 search/select 因 abort 而抛出异常时，打印错误信息并退出。
 *
 * @param err     search 抛出的异常
 * @param context 场景描述
 * @param hint    第二句的具体参数提示
 */
export function handlePromptAbort(err: any, context: string, hint: string): void {
    printTimeoutError(context, hint);
    process.exit(1);
}

function printTimeoutError(context: string, hint: string): void {
    consola.error(
        `Interactive prompt (${context}) was not answered within 15 seconds.\n\n${hint}`,
    );
}
