import type { consola } from "consola";

export type CookbookCommandHandler = (utils: {
    log: typeof consola['log'],
    info: typeof consola['info'],
    warn: typeof consola['warn'],
    error: typeof consola['error'],
    success: typeof consola['success'],
    debug: typeof consola['debug'],
    fatal: typeof consola['fatal'],
    trace: typeof consola['trace'],
    start: typeof consola['start'],
    box: typeof consola['box'],
    prompt: typeof consola['prompt'],
    getScriptPath: () => string,
    getWorkspacePath: () => string,
    getParams: () => {
        command: string;
        commands: Array<string>;
        options: Record<string, string | true>;
        raw: Array<string>;
      },
    inputBoolean: (options: { env: string, message: string, placeholder?: string }) => Promise<boolean>,
    inputString: (options: { env: string, message: string, placeholder?: string }) => Promise<string>,
}) => Promise<void>;

export async function defineCookbookCommand<Handler extends CookbookCommandHandler>(handler: Handler): Promise<Handler> {
    return handler;
}