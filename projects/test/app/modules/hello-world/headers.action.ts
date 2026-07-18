import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

type Params = {
    /** 要读取的请求头名称列表（返回读取到的值） */
    readHeaders?: string[];
    /** 要设置的响应头 { headerName: value }，可包含重复 key 用于测试覆盖 */
    setHeaders?: Record<string, string>;
    /** 要删除的响应头名称列表（从 setHeaders 的结果中二次删除） */
    deleteHeaders?: string[];
};

type Result = {
    /** key → 读取到的值，null 表示该头不存在 */
    read: Record<string, string | null>;
};

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
    const read: Record<string, string | null> = {};

    // 读取请求头
    if (params.readHeaders) {
        for (const name of params.readHeaders) {
            read[name] = context.http.request.headers.get(name);
        }
    }

    // 设置响应头
    if (params.setHeaders) {
        for (const [name, value] of Object.entries(params.setHeaders)) {
            context.http.response.headers[name] = value;
        }
    }

    // 删除响应头
    if (params.deleteHeaders) {
        for (const name of params.deleteHeaders) {
            delete context.http.response.headers[name];
        }
    }

    return { read };
}
