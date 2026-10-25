import { createWorld, type MilkioInit } from "milkio";
import { generated } from "./.milkio/index.ts";
import { configSchema } from "./.milkio/config-schema.ts";

export async function create(options: MilkioInit) {
    const world = await createWorld(generated, configSchema, {
        ...options,
        // 大请求体回归测试（large-echo / node-adapter）依赖超过默认 10KB 的请求体，
        // 因此测试工程显式放宽限制；产品默认值仍为 10KB。
        http: { bodyLimit: 10 * 1024 * 1024, ...options.http },
        bootstraps: [],
    });

    return world;
}

export type World = Awaited<ReturnType<typeof create>>;
