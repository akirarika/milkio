// oxlint-disable-next-line no-unused-vars

import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

export async function handler(
    context: MilkioContext,
    params: {},
): Promise<{ cors: { hasAllowOrigin: boolean; hasAllowMethods: boolean; hasAllowHeaders: boolean; hasExposeHeaders: boolean; hasCredentials: boolean; hasMaxAge: boolean } }> {
    return {
        cors: {
            hasAllowOrigin: "corsAllowOrigin" in (context.http.cors ?? {}),
            hasAllowMethods: "corsAllowMethods" in (context.http.cors ?? {}),
            hasAllowHeaders: "corsAllowHeaders" in (context.http.cors ?? {}),
            hasExposeHeaders: "corsExposeHeaders" in (context.http.cors ?? {}),
            hasCredentials: "corsAllowCredentials" in (context.http.cors ?? {}),
            hasMaxAge: "corsMaxAge" in (context.http.cors ?? {}),
        },
    };
}
